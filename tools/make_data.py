"""Build data/srd.js and data/species.js for Fogwright Forge.

    python tools/make_data.py [--src DIR] [--species DIR]

--src      folder with the 5e-bits 2024 JSON files (5e-SRD-Classes.json ...) and the reForged Warlock.md.
           Missing files are downloaded from GitHub.
--species  the campaign's world/species folder (Lantern Marches - Party/world/species). The traits section of
           each species file is copied; the GM-only parts are never read.

Rules data: D&D System Reference Document 5.2.1 by Wizards of the Coast LLC, CC BY 4.0, via the
5e-bits/5e-database project (MIT) and oldmanumby/dnd.srd.5.2.1.
"""
import argparse
import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BITS = "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/"
FORGED = "https://raw.githubusercontent.com/oldmanumby/dnd.srd.5.2.1/main/03_Character_Classes/Character_Classes_Each/"
FILES = ["Classes", "Subclasses", "Levels", "Features", "Backgrounds", "Feats", "Equipment", "Spells",
         "Weapon-Mastery-Properties", "Equipment-Categories"]
ABILS = ["str", "dex", "con", "int", "wis", "cha"]


def fetch(src, name, url):
    path = os.path.join(src, name)
    if not os.path.exists(path):
        os.makedirs(src, exist_ok=True)
        with urllib.request.urlopen(url) as r, open(path, "wb") as f:
            f.write(r.read())
    with open(path, encoding="utf-8") as f:
        return f.read()


def fix(text):
    """PDF leftovers: "ex- pended" -> "expended", mojibake, stray spaces."""
    t = (text or "").replace("â€™", "’").replace("â€”", "—").replace("--", "—")
    t = re.sub(r"(\w)- (?=[a-z])", r"\1", t)
    t = re.sub(r"\n[ \t]+", "\n", t)
    return t.strip()


def skill_id(index):  # "skill-sleight-of-hand" -> "sleight_of_hand"
    return index.replace("skill-", "").replace("-", "_")


def items_of(option):
    """A starting-equipment option -> (items [[id, qty, note]], gp)."""
    out, gp = [], 0
    t = option.get("option_type")
    if t == "money":
        return [], option.get("count", 0)
    parts = option.get("items", []) if t == "multiple" else [option]
    for p in parts:
        if p.get("option_type") == "money":
            gp += p.get("count", 0)
        elif p.get("option_type") == "counted_reference":
            of = p["of"]
            kind = "cat:" if "equipment-categories" in of.get("url", "") else ""
            out.append([kind + of["index"], p.get("count", 1), of.get("note", "")])
    return out, gp


def equip_options(opts):
    res = []
    for o in opts or []:
        letters = re.findall(r"\(([a-cA-C])\)", o.get("desc", ""))
        for i, op in enumerate(o["from"]["options"]):
            items, gp = items_of(op)
            res.append({"key": "abc"[i], "items": items, "gp": gp})
        res_desc = o.get("desc", "")
    return {"desc": fix(res_desc) if opts else "", "options": res}


def build_srd(src):
    j = {f: json.loads(fetch(src, "5e-SRD-%s.json" % f, BITS + "5e-SRD-%s.json" % f)) for f in FILES}
    feats_by_cls = {}
    features = {}
    for x in j["Features"]:
        features[x["index"]] = {"n": x["name"], "cls": x["class"]["index"],
                                "lv": int(x["level"]["index"].rsplit("-", 1)[1]),
                                "sub": (x.get("subclass") or {}).get("index", ""), "t": fix(x["description"])}
    levels = {}
    for x in j["Levels"]:
        if x.get("subclass"):
            continue
        c = x["class"]["index"]
        sc = x.get("spellcasting") or {}
        levels.setdefault(c, {})[x["level"]] = {
            "f": [f["index"] for f in x["features"]],
            "cs": x.get("class_specific") or {},
            "can": sc.get("cantrips_known", 0), "prep": sc.get("prepared_spells", 0),
            "slots": [sc.get("spell_slots_level_%d" % i, 0) for i in range(1, 10)] if sc else [0] * 9,
        }
    subclasses = {}
    for s in j["Subclasses"]:
        subclasses[s["index"]] = {"n": s["name"], "cls": s["class"]["index"], "sum": s.get("summary", ""),
                                  "t": fix(s.get("description", "")),
                                  "f": [{"n": f["name"], "lv": f["level"], "t": fix(f["description"])} for f in s["features"]]}
    classes = {}
    for c in j["Classes"]:
        profs = [p["index"] for p in c["proficiencies"] if not p["index"].startswith("saving-throw")]
        sk, tools = None, []
        for pc in c["proficiency_choices"]:
            opts = [o["item"]["index"] for o in pc["from"]["options"] if "item" in o]
            if opts and all(o.startswith("skill-") for o in opts):
                sk = {"n": pc["choose"], "from": [skill_id(o) for o in opts]}
            else:
                tools.append({"n": pc["choose"], "desc": fix(pc["desc"]), "from": opts})
        sc = c.get("spellcasting")
        mc = c.get("multi_classing") or {}
        classes[c["index"]] = {
            "n": c["name"], "hd": c["hit_die"], "saves": [s["index"] for s in c["saving_throws"]],
            "prof": profs, "skills": sk, "tools": tools,
            "equip": equip_options(c.get("starting_equipment_options")),
            "cast": sc["spellcasting_ability"]["index"] if sc else "",
            "lv": levels[c["index"]], "subs": [s["index"] for s in c["subclasses"]],
            "mc": {"pre": [[p["ability_score"]["index"], p["minimum_score"]] for p in mc.get("prerequisites", [])],
                   "prof": [p["index"] for p in mc.get("proficiencies", [])]},
        }
    equipment = {}
    for e in j["Equipment"]:
        cats = [x["index"] for x in e["equipment_categories"]]
        it = {"n": e["name"], "cats": cats, "cost": "%s %s" % (e["cost"]["quantity"], e["cost"]["unit"]),
              "wt": e.get("weight", 0)}
        if "damage" in e:
            it.update(dmg=e["damage"]["damage_dice"], dt=e["damage"]["damage_type"]["name"],
                      props=[p["index"] for p in e.get("properties", [])],
                      mastery=(e.get("mastery") or {}).get("index", ""),
                      rng=e.get("range", {}), thr=e.get("throw_range", {}),
                      two=(e.get("two_handed_damage") or {}).get("damage_dice", ""))
        if "armor_class" in e:
            ac = e["armor_class"]
            it.update(ac=ac["base"], dex=ac.get("dex_bonus", False), max=ac.get("max_bonus"),
                      strmin=e.get("str_minimum", 0), stealth=e.get("stealth_disadvantage", False))
        if "contents" in e:
            it["contents"] = [[x["item"]["index"], x["quantity"]] for x in e["contents"]]
        if e.get("quantity"):
            it["qty"] = e["quantity"]
        if e.get("description"):
            it["t"] = fix(e["description"])
        equipment[e["index"]] = it
    cats = {c["index"]: {"n": c["name"], "items": [x["index"] for x in c.get("equipment", [])]} for c in j["Equipment-Categories"]}
    spells = {}
    for s in j["Spells"]:
        spells[s["index"]] = {"n": s["name"], "lv": s["level"], "sch": s["school"]["name"], "ct": s["casting_time"],
                              "r": s["range"], "c": ", ".join(s["components"]) + (" (%s)" % s["material"] if s.get("material") else ""),
                              "d": s["duration"], "conc": s["concentration"], "rit": s["ritual"],
                              "cls": [c["index"] for c in s["classes"]], "t": fix(s["description"]),
                              "hi": fix(s.get("higher_level", ""))}
    feats = {f["index"]: {"n": f["name"], "type": f.get("type", ""), "t": fix(f.get("description", "")),
                          "pre": f.get("prerequisite", "") or ""} for f in j["Feats"]}
    backgrounds = {}
    for b in j["Backgrounds"]:
        pro = [p["index"] for p in b["proficiencies"]]
        backgrounds[b["index"]] = {"n": b["name"], "abil": [a["index"] for a in b["ability_scores"]],
                                   "feat": b["feat"]["index"], "featNote": b["feat"].get("note", ""),
                                   "skills": [skill_id(p) for p in pro if p.startswith("skill-")],
                                   "tools": [p.replace("tool-", "") for p in pro if not p.startswith("skill-")],
                                   "equip": equip_options(b.get("equipment_options")), "src": "SRD"}
    mastery = {m["index"]: {"n": m["name"], "t": fix(m["description"])} for m in j["Weapon-Mastery-Properties"]}
    invocations = parse_invocations(fetch(src, "Warlock.md", FORGED + "Warlock.md"))
    return {"classes": classes, "features": features, "subclasses": subclasses, "equipment": equipment,
            "cats": cats, "spells": spells, "feats": feats, "backgrounds": backgrounds, "mastery": mastery,
            "invocations": invocations}


def parse_invocations(md):
    part = md.split("## Eldritch Invocation Options", 1)[1].split("## Warlock Spell List", 1)[0]
    out = {}
    for blk in part.split("\n### ")[1:]:
        head, _, body = blk.partition("\n")
        pre = ""
        m = re.search(r"Prerequisite:\s*(.+)", head)
        if m:
            head, pre = head[:m.start()].strip(), m.group(1)
        m = re.search(r"^\*Prerequisite:\s*(.+?)\*\s*$", body, re.M)
        if m:
            pre = m.group(1)
            body = body[:m.start()] + body[m.end():]
        name = head.strip()
        lvl = re.search(r"Level (\d+)\+", pre)
        out[re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")] = {
            "n": name, "pre": pre.strip(), "lv": int(lvl.group(1)) if lvl else 1,
            "rep": "Repeatable" in body, "t": fix(body.replace("***", "**").replace(" ,", ","))}
    return out


# ---------------------------------------------------------------- species (Ninth World names, 2024 rules)

SPECIES = {
    "humans": {"n": "Human", "rules": "Human", "size": ["Medium", "Small"], "speed": 30, "dv": 0,
               "skill": "any", "originFeat": True},
    "grafted": {"n": "Grafted", "rules": "Tiefling", "size": ["Medium", "Small"], "speed": 30, "dv": 60, "spellAbil": True,
                "lineLabel": "Life Core", "lines": {
                    "reactor": {"n": "Reactor", "res": ["fire"], "sp": {1: ["fire-bolt"], 3: ["hellish-rebuke"], 5: ["darkness"]}},
                    "black-pump": {"n": "Black Pump", "res": ["necrotic"], "sp": {1: ["chill-touch"], 3: ["false-life"], 5: ["ray-of-enfeeblement"]}},
                    "filter-lungs": {"n": "Filter Lungs", "res": ["poison"], "sp": {1: ["poison-spray"], 3: ["ray-of-sickness"], 5: ["hold-person"]}},
                    "storm-battery": {"n": "Storm Battery", "res": ["lightning"], "sp": {1: ["shocking-grasp"], 3: ["thunderwave"], 5: ["shatter"]}}},
                "sp": {1: ["thaumaturgy"]}},
    "warbred": {"n": "Warbred", "rules": "Orc", "size": ["Medium"], "speed": 30, "dv": 120,
                "uses": {"Adrenaline Rush": ["pb", "short"], "Relentless Endurance": [1, "long"]}},
    "firstborn": {"n": "Firstborn", "rules": "Elf", "size": ["Medium"], "speed": 30, "dv": 60, "spellAbil": True,
                  "keen": ["insight", "perception", "survival"], "lineLabel": "Lineage", "lines": {
                      "dusk": {"n": "Dusk (Drow)", "dv": 120, "sp": {1: ["dancing-lights"], 3: ["faerie-fire"], 5: ["darkness"]}},
                      "bright": {"n": "Bright (High Elf)", "sp": {1: ["prestidigitation"], 3: ["detect-magic"], 5: ["misty-step"]}},
                      "green": {"n": "Green (Wood Elf)", "speed": 35, "sp": {1: ["druidcraft"], 3: ["longstrider"], 5: ["pass-without-trace"]}}}},
    "lightborn": {"n": "Lightborn", "rules": "Aasimar", "size": ["Medium", "Small"], "speed": 30, "dv": 60,
                  "res": ["necrotic", "radiant"], "sp": {1: ["light"]}, "spAbil": "cha",
                  "uses": {"Healing Hands": [1, "long"], "Celestial Revelation": [1, "long", 3]}},
    "ashmaw": {"n": "Ashmaw", "rules": "Dragonborn", "size": ["Medium"], "speed": 30, "dv": 60,
               "lineLabel": "Scales (Draconic Ancestry)", "lines": {
                   k.lower(): {"n": "%s (%s)" % (k, v), "res": [v.lower()]} for k, v in
                   [("Black", "Acid"), ("Blue", "Lightning"), ("Brass", "Fire"), ("Bronze", "Lightning"), ("Copper", "Acid"),
                    ("Gold", "Fire"), ("Green", "Poison"), ("Red", "Fire"), ("Silver", "Cold"), ("White", "Cold")]},
               "uses": {"Breath Weapon": ["pb", "long"], "Draconic Flight": [1, "long", 5]}},
    "stonebound": {"n": "Stonebound", "rules": "Dwarf", "size": ["Medium"], "speed": 30, "dv": 120, "res": ["poison"],
                   "hpPerLevel": 1, "uses": {"Stonecunning": ["pb", "long"]}},
    "tinkerfolk": {"n": "Tinkerfolk", "rules": "Gnome", "size": ["Small"], "speed": 30, "dv": 60, "spellAbil": True,
                   "lineLabel": "Lineage", "lines": {
                       "hall": {"n": "Hall (Rock Gnome)", "sp": {1: ["mending", "prestidigitation"]}},
                       "thicket": {"n": "Thicket (Forest Gnome)", "sp": {1: ["minor-illusion", "speak-with-animals"]},
                                   "uses": {"Speak with Animals (free casts)": ["pb", "long"]}}}},
}
ORDER = ["humans", "grafted", "warbred", "firstborn", "lightborn", "ashmaw", "stonebound", "tinkerfolk"]


def species_traits(path):
    """The traits section of a species file -> (lore paragraph, [{n, t}])."""
    with open(path, encoding="utf-8") as f:
        md = f.read()
    intro = md.split("\n## ", 1)[0]
    intro = "\n\n".join(p.strip() for p in intro.split("\n\n")[1:]
                        if p.strip() and not p.startswith(("**Tags", "**Rules")))
    sec = re.search(r"\n## [^\n]*traits\n(.*?)(?=\n## )", md, re.S).group(1)
    traits, cur = [], None
    for line in sec.split("\n"):
        m = re.match(r"^\*\*(.+?)\.\*\*\s*(.*)$", line)
        if m and not line.startswith(("**Creature", "**Size", "**Speed")):
            cur = {"n": m.group(1), "t": m.group(2)}
            traits.append(cur)
        elif cur is not None and not line.startswith("As a"):
            cur["t"] += "\n" + line
    for t in traits:
        t["t"] = re.sub(r"\n{3,}", "\n\n", t["t"]).strip()
    return intro, traits


def build_species(folder):
    out = []
    for key in ORDER:
        sp = dict(SPECIES[key], id=key)
        intro, traits = species_traits(os.path.join(folder, key + ".md"))
        sp["lore"], sp["traits"] = intro, traits
        out.append(sp)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "tools", "cache"))
    ap.add_argument("--species", default="")
    a = ap.parse_args()
    srd = build_srd(a.src)
    with open(os.path.join(ROOT, "data", "srd.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/make_data.py. D&D SRD 5.2.1 (Wizards of the Coast LLC), CC BY 4.0.\n")
        f.write("window.SRD = " + json.dumps(srd, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("srd.js:", {k: len(v) for k, v in srd.items()})
    if a.species:
        sp = build_species(a.species)
        with open(os.path.join(ROOT, "data", "species.js"), "w", encoding="utf-8") as f:
            f.write("// Generated by tools/make_data.py from the campaign's world/species files (traits only).\n")
            f.write("window.SPECIES = " + json.dumps(sp, ensure_ascii=False, indent=1) + ";\n")
        print("species.js:", [s["n"] for s in sp])


if __name__ == "__main__":
    main()
