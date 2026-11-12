"""Serve Fogwright Forge from this PC, like Fogwright VTT does, with player accounts.

    py -3 serve.py [port]        (default port 8766; the VTT uses 8765)

Players open http://<your Hamachi IP>:8766/ in their browser. Only this PC (127.x) and Hamachi
addresses (25.x) are let in.

Accounts: the GM signs in with the name "GM" and the GM key printed when the server starts
(kept in forge-data/config.json). The GM creates the players' accounts on the Players page.
Each player sees only their own characters; the GM sees everyone's.
Characters are saved as files in forge-data/characters/, one .json each. Back up that folder.
"""
import functools
import hashlib
import hmac
import http.server
import json
import os
import re
import secrets
import socket
import sys
import threading
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "forge-data")
CHARS = os.path.join(DATA, "characters")
CONFIG = os.path.join(DATA, "config.json")
SESSIONS_FILE = os.path.join(DATA, "sessions.json")
GM = "GM"
SESSION_DAYS = 60
MAX_BODY = 2_000_000

LOCK = threading.Lock()
FAILS = {}  # ip -> [count, last time]
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _read(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def _write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


os.makedirs(CHARS, exist_ok=True)
CFG = _read(CONFIG, {})
CFG.setdefault("gm_key", secrets.token_urlsafe(9))
CFG.setdefault("accounts", {})  # lower-case name -> {name, salt, hash}
_write(CONFIG, CFG)
SESSIONS = {t: s for t, s in _read(SESSIONS_FILE, {}).items() if s.get("exp", 0) > time.time()}


def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(salt), 200_000).hex()


def check_login(name, pw):
    """Returns the account's display name, or None."""
    if name.strip().lower() == GM.lower():
        return GM if hmac.compare_digest(pw, CFG["gm_key"]) else None
    acc = CFG["accounts"].get(name.strip().lower())
    if acc and hmac.compare_digest(hash_pw(pw, acc["salt"]), acc["hash"]):
        return acc["name"]
    return None


def set_password(name, pw):
    salt = secrets.token_hex(16)
    key = name.lower()
    old = CFG["accounts"].get(key, {})
    CFG["accounts"][key] = {"name": old.get("name", name), "salt": salt, "hash": hash_pw(pw, salt)}
    _write(CONFIG, CFG)


def drop_sessions(name):
    for t in [t for t, s in SESSIONS.items() if s["name"].lower() == name.lower()]:
        del SESSIONS[t]
    _write(SESSIONS_FILE, SESSIONS)


def char_path(cid):
    return os.path.join(CHARS, cid + ".json")


def all_chars():
    out = []
    for fn in sorted(os.listdir(CHARS)):
        if fn.endswith(".json"):
            rec = _read(os.path.join(CHARS, fn), None)
            if rec and isinstance(rec.get("character"), dict):
                out.append(rec)
    return out


def can_see(user, rec):
    return user == GM or rec.get("owner", "").lower() == user.lower()


class Handler(http.server.SimpleHTTPRequestHandler):
    def setup(self):
        super().setup()
        ip = self.client_address[0].replace("::ffff:", "")
        if not ip.startswith(("127.", "25.")) and ip != "::1":
            self.connection.close()
            raise ConnectionAbortedError("refused " + ip)

    def handle(self):
        try:
            super().handle()
        except ConnectionAbortedError:
            pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass

    # never serve the accounts and characters as plain files
    def translate_path(self, path):
        p = super().translate_path(path)
        if os.path.abspath(p).startswith(DATA):
            return os.path.join(ROOT, "__nothing__")
        return p

    # ------------------------------------------------------------ API helpers

    def reply(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("too big")
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}

    def user(self):
        auth = self.headers.get("Authorization", "")
        tok = auth[7:] if auth.startswith("Bearer ") else ""
        s = SESSIONS.get(tok)
        if not s or s["exp"] < time.time():
            return None
        if s["name"] != GM and s["name"].lower() not in CFG["accounts"]:
            return None
        return s["name"]

    def api(self, method):
        path = self.path.split("?")[0]
        if not path.startswith("/api/"):
            return False
        try:
            with LOCK:
                self.route(method, path[5:].strip("/").split("/"))
        except ValueError:
            self.reply(400, {"error": "bad request"})
        return True

    def do_GET(self):
        if not self.api("GET"):
            super().do_GET()

    def do_POST(self):
        if not self.api("POST"):
            self.send_error(405)

    def do_PUT(self):
        if not self.api("PUT"):
            self.send_error(405)

    def do_DELETE(self):
        if not self.api("DELETE"):
            self.send_error(405)

    # ------------------------------------------------------------ routes

    def route(self, m, parts):
        head = parts[0]
        if head == "login" and m == "POST":
            ip = self.client_address[0]
            n, last = FAILS.get(ip, [0, 0])
            if n >= 5 and time.time() - last < 60:
                return self.reply(429, {"error": "Too many tries. Wait a minute."})
            d = self.body()
            name = check_login(str(d.get("name", "")), str(d.get("password", "")))
            if not name:
                FAILS[ip] = [n + 1, time.time()]
                return self.reply(401, {"error": "Wrong name or password."})
            FAILS.pop(ip, None)
            tok = secrets.token_urlsafe(24)
            SESSIONS[tok] = {"name": name, "exp": time.time() + SESSION_DAYS * 86400}
            _write(SESSIONS_FILE, SESSIONS)
            return self.reply(200, {"token": tok, "name": name, "gm": name == GM})

        user = self.user()
        if head == "me" and m == "GET":
            return self.reply(200, {"name": user, "gm": user == GM} if user else {"name": None})
        if not user:
            return self.reply(401, {"error": "Sign in first."})

        if head == "logout" and m == "POST":
            tok = self.headers.get("Authorization", "")[7:]
            SESSIONS.pop(tok, None)
            _write(SESSIONS_FILE, SESSIONS)
            return self.reply(200, {"ok": True})

        if head == "password" and m == "POST":
            d = self.body()
            if user == GM:
                return self.reply(400, {"error": "The GM key is changed in forge-data/config.json."})
            if not check_login(user, str(d.get("old", ""))):
                return self.reply(401, {"error": "The current password is wrong."})
            new = str(d.get("new", ""))
            if len(new) < 4:
                return self.reply(400, {"error": "Use at least 4 characters."})
            set_password(user, new)
            return self.reply(200, {"ok": True})

        if head == "chars":
            cid = parts[1] if len(parts) > 1 else ""
            if m == "GET" and not cid:
                return self.reply(200, {"chars": [r for r in all_chars() if can_see(user, r)]})
            if not ID_RE.match(cid):
                return self.reply(400, {"error": "bad id"})
            old = _read(char_path(cid), None)
            if old and not can_see(user, old):
                return self.reply(403, {"error": "That character belongs to someone else."})
            if m == "PUT":
                d = self.body()
                ch = d.get("character")
                if not isinstance(ch, dict):
                    return self.reply(400, {"error": "no character"})
                ch["id"] = cid
                owner = old["owner"] if old else user
                if user == GM and d.get("owner"):  # the GM may give a character to a player
                    o = str(d["owner"]).lower()
                    owner = GM if o == GM.lower() else CFG["accounts"].get(o, {}).get("name", owner)
                rec = {"owner": owner, "updated": time.time(), "character": ch}
                _write(char_path(cid), rec)
                return self.reply(200, {"owner": owner})
            if m == "DELETE":
                if old:
                    os.remove(char_path(cid))
                return self.reply(200, {"ok": True})

        if head == "accounts":
            if user != GM:
                return self.reply(403, {"error": "Only the GM."})
            name = parts[1] if len(parts) > 1 else ""
            if m == "GET" and not name:
                counts = {}
                for r in all_chars():
                    counts[r.get("owner", "").lower()] = counts.get(r.get("owner", "").lower(), 0) + 1
                return self.reply(200, {"accounts": [{"name": a["name"], "chars": counts.get(k, 0)}
                                                     for k, a in sorted(CFG["accounts"].items())]})
            if m == "POST" and not name:  # create, or reset the password
                d = self.body()
                n = str(d.get("name", "")).strip()
                pw = str(d.get("password", ""))
                if not re.match(r"^[\w .'-]{1,32}$", n) or n.lower() == GM.lower():
                    return self.reply(400, {"error": "Use a name of up to 32 letters or numbers."})
                if len(pw) < 4:
                    return self.reply(400, {"error": "Use a password of at least 4 characters."})
                set_password(n, pw)
                drop_sessions(n)
                return self.reply(200, {"ok": True})
            if m == "DELETE" and name:
                key = name.lower()
                if key in CFG["accounts"]:
                    del CFG["accounts"][key]
                    _write(CONFIG, CFG)
                    drop_sessions(name)
                return self.reply(200, {"ok": True})

        return self.reply(404, {"error": "unknown"})


def hamachi_ip():
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            if info[4][0].startswith("25."):
                return info[4][0]
    except OSError:
        pass
    return "<your Hamachi IP>"


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), functools.partial(Handler, directory=ROOT))
    print("Fogwright Forge")
    print("  On this PC:      http://localhost:%d/" % PORT)
    print("  Players (Hamachi): http://%s:%d/" % (hamachi_ip(), PORT))
    print("  GM sign-in: name GM, key %s" % CFG["gm_key"])
    print("Close this window to stop.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
