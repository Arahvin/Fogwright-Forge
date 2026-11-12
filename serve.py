"""Serve Fogwright Forge from this PC, like Fogwright VTT does.

    py -3 serve.py [port]        (default port 8766; the VTT uses 8765)

Players open http://<your Hamachi IP>:8766/ in their browser. Only this PC (127.x) and Hamachi
addresses (25.x) are let in. Characters are still kept in each player's own browser.
"""
import functools
import http.server
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
ROOT = os.path.dirname(os.path.abspath(__file__))


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
    print("Close this window to stop.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
