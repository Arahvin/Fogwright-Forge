// Fogwright Forge: the rules engine. compute(ch) turns the player's choices into a finished sheet,
// and toVTT(ch) writes that sheet in the format Fogwright VTT imports (sheets.py clean()).
(function () {
  "use strict";
  const SRD = window.SRD, X = window.EXTRA;
  // the Artificer (UA 2024, data/artificer.js) joins the SRD classes
  const A = window.ARTIFICER;
  if (A && !SRD.classes.artificer) {
    SRD.classes.artificer = A.cls;
    Object.assign(SRD.features, A.features);
    Object.keys(A.subclasses).forEach(k => { SRD.subclasses[k] = A.subclasses[k]; });
    Object.keys(A.spells).forEach(k => { if (!SRD.spells[k]) SRD.spells[k] = A.spells[k]; });
    A.list.forEach(k => { const s = SRD.spells[k]; if (s && !s.cls.includes("artificer")) s.cls.push("artificer"); });
    X.classEquip.artificer = A.equip;
    X.labels.artificer = A.label;
    Object.assign(X.uses, A.uses);
  }
  const SPECIES = {};
  (window.SPECIES || []).forEach(s => { SPECIES[s.id] = s; });

  const ABILS = ["str", "dex", "con", "int", "wis", "cha"];
  const ABIL_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
  const SKILLS = {
    acrobatics: "dex", animal_handling: "wis", arcana: "int", athletics: "str", deception: "cha", history: "int",
    insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis", nature: "int", perception: "wis",
    performance: "cha", persuasion: "cha", religion: "int", sleight_of_hand: "dex", stealth: "dex", survival: "wis"
  };
  const SKILL_NAMES = {};
  Object.keys(SKILLS).forEach(k => { SKILL_NAMES[k] = k.split("_").map(w => w === "of" ? w : w[0].toUpperCase() + w.slice(1)).join(" "); });

  const mod = s => Math.floor((s - 10) / 2);
  const sign = n => (n >= 0 ? "+" : "") + n;
  const pbOf = lv => Math.ceil(Math.max(1, lv) / 4) + 1;
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  function blank() {
    return {
      fv: 1, id: "c" + Math.random().toString(36).slice(2, 10), name: "", player: "", created: Date.now(), updated: Date.now(),
      classes: [{ id: "", lv: 1, sub: "" }],
      hp: { method: "avg", rolls: {} },
      sp: { id: "", size: "", line: "", abil: "", skill: "", keen: "", feat: "", featData: {} },
      bg: { id: "", mode: "21", p2: "", p1: "", p111: [], tool: "", featData: {} },
      ab: { method: "array", base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, assign: {}, rolled: [] },
      skills: [], exp: [],
      ch: { fightingStyle: "", divineOrder: "", primalOrder: "", mastery: [], invocations: [], instruments: [], monkTool: "", langs: [] },
      spells: { cantrips: [], prepared: [], extra: [] },
      equip: { cls: "", bg: "", picks: {} }, items: [], gp: 0,
      det: { appearance: "", personality: "", backstory: "", notes: "" }
    };
  }

  // ---------------------------------------------------------------- lookups

  const cls = ch => SRD.classes[(ch.classes[0] || {}).id] || null;
  const clsId = ch => (ch.classes[0] || {}).id || "";
  const level = ch => ch.classes.reduce((a, c) => a + (c.lv || 0), 0) || 1;
  const species = ch => SPECIES[ch.sp.id] || null;
  const line = ch => { const s = species(ch); return s && s.lines ? s.lines[ch.sp.line] || null : null; };
  const background = ch => X.backgrounds[ch.bg.id] || null;
  const feat = id => X.feats[id] || SRD.feats[id] || null;
  const spell = id => SRD.spells[id] || null;
  const item = id => SRD.equipment[id] || X.packs[id] || null;
  const levelRow = (c, lv) => (c && c.lv[lv]) || { f: [], cs: {}, can: 0, prep: 0, slots: [0, 0, 0, 0, 0, 0, 0, 0, 0] };

  // feats the character has: [{id, from, data}]
  function feats(ch) {
    const out = [];
    const bg = background(ch);
    if (bg) out.push({ id: bg.feat, from: "bg", data: ch.bg.featData || {}, fixedCls: bg.featCls || "" });
    const s = species(ch);
    if (s && s.originFeat && ch.sp.feat) out.push({ id: ch.sp.feat, from: "sp", data: ch.sp.featData || {} });
    if (ch.ch.fightingStyle) out.push({ id: ch.ch.fightingStyle, from: "cls", data: {} });
    return out;
  }
  const hasFeat = (ch, id) => feats(ch).some(f => f.id === id);

  // ---------------------------------------------------------------- abilities

  const STANDARD = [15, 14, 13, 12, 10, 8];
  const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

  function baseScores(ch) {
    const a = ch.ab, out = {};
    ABILS.forEach(k => {
      if (a.method === "array" || a.method === "roll") {
        const pool = a.method === "array" ? STANDARD : (a.rolled || []);
        const i = a.assign[k];
        out[k] = i === undefined || i === null || i === "" || pool[i] === undefined ? 8 : pool[i];
      } else out[k] = a.base[k] || 8;
    });
    return out;
  }
  function pointsSpent(ch) { return ABILS.reduce((t, k) => t + (POINT_COST[ch.ab.base[k]] ?? 99), 0); }

  function bgBonus(ch) {
    const b = {}, bg = background(ch);
    ABILS.forEach(k => { b[k] = 0; });
    if (!bg) return b;
    if (ch.bg.mode === "111") (ch.bg.p111 || []).forEach(k => { if (bg.abil.includes(k)) b[k] += 1; });
    else {
      if (bg.abil.includes(ch.bg.p2)) b[ch.bg.p2] += 2;
      if (bg.abil.includes(ch.bg.p1) && ch.bg.p1 !== ch.bg.p2) b[ch.bg.p1] += 1;
    }
    return b;
  }

  function scores(ch) {
    const base = baseScores(ch), bon = bgBonus(ch), out = {};
    ABILS.forEach(k => { out[k] = Math.min(20, base[k] + bon[k]); });
    return out;
  }

  // ---------------------------------------------------------------- proficiencies

  function training(ch) {
    const c = cls(ch), id = clsId(ch);
    const t = { armor: new Set(), weapons: new Set(), tools: new Set(), simple: false, martial: false, martialIf: null };
    if (!c) return t;
    c.prof.forEach(p => {
      if (p === "all-armor") ["light", "medium", "heavy"].forEach(a => t.armor.add(a));
      else if (p.endsWith("-armor")) t.armor.add(p.replace("-armor", ""));
      else if (p === "shields") t.armor.add("shield");
      else if (p === "simple-weapons") t.simple = true;
      else if (p === "martial-weapons") t.martial = true;
      else if (p.startsWith("tool-") || p.endsWith("-kit") || p.endsWith("-tools") || p.endsWith("-supplies")) t.tools.add(itemName(p.replace("tool-", "")));
      else t.weapons.add(p.replace(/s$/, "").replace(/-/g, " "));
    });
    const wp = X.weaponProf[id];
    if (wp) { t.weapons.clear(); t.simple = !!wp.simple; t.martial = false; t.martialIf = wp.martialIf; }
    if (id === "cleric" && ch.ch.divineOrder === "protector") { t.martial = true; t.armor.add("heavy"); }
    if (id === "druid" && ch.ch.primalOrder === "warden") { t.martial = true; t.armor.add("medium"); }
    const bg = background(ch);
    if (bg && bg.tool) t.tools.add(bg.tool.startsWith("@") ? (ch.bg.tool ? itemName(ch.bg.tool) : "") : bg.tool);
    if (id === "bard") (ch.ch.instruments || []).forEach(i => i && t.tools.add(itemName(i)));
    if ((id === "monk" || id === "artificer") && ch.ch.monkTool) t.tools.add(itemName(ch.ch.monkTool));
    feats(ch).forEach(f => ((f.data && f.data.tools) || []).forEach(x => x && t.tools.add(itemName(x))));
    feats(ch).forEach(f => ((f.data && f.data.picks) || []).forEach(x => { if (x && !SKILLS[x]) t.tools.add(itemName(x)); }));
    t.tools.delete("");
    return t;
  }

  function weaponProficient(ch, w, t) {
    t = t || training(ch);
    const it = item(w);
    if (!it || !it.dmg) return false;
    const martial = it.cats.includes("martial-weapons");
    if (!martial && t.simple) return true;
    if (martial && t.martial) return true;
    if (martial && t.martialIf && t.martialIf.some(p => it.props.includes(p))) return true;
    const n = it.n.toLowerCase();
    return [...t.weapons].some(x => n === x || n.replace(/,.*/, "") === x || x.replace(/s$/, "") === n);
  }

  function skillProfs(ch) {
    const out = {}, src = {};
    const add = (k, why) => { if (SKILLS[k]) { out[k] = 1; (src[k] = src[k] || []).push(why); } };
    const bg = background(ch), s = species(ch);
    if (bg) bg.skills.forEach(k => add(k, "background"));
    (ch.skills || []).forEach(k => add(k, "class"));
    if (s && s.skill === "any" && ch.sp.skill) add(ch.sp.skill, "species");
    if (s && s.keen && ch.sp.keen) add(ch.sp.keen, "species");
    feats(ch).forEach(f => ((f.data && f.data.picks) || []).forEach(k => add(k, "feat")));
    (ch.exp || []).forEach(k => { if (out[k]) out[k] = 2; });
    return { prof: out, src };
  }

  // ---------------------------------------------------------------- spells

  // [{id, lv, why, prepared, notes, abil}]
  function spellList(ch) {
    const out = [], seen = new Set(), L = level(ch), c = cls(ch);
    const push = (id, why, notes, prepared, abil) => {
      const sp = spell(id);
      if (!sp || seen.has(id)) return;
      seen.add(id);
      out.push({ id, n: sp.n, lv: sp.lv, why, notes: notes || "", prepared: prepared !== false, abil: abil || "" });
    };
    if (c && c.cast) {
      (ch.spells.cantrips || []).forEach(id => push(id, c.n, "", true, c.cast));
      (ch.spells.prepared || []).forEach(id => push(id, c.n, "", true, c.cast));
    }
    const s = species(ch), ln = line(ch);
    const sa = (s && s.spAbil) || ch.sp.abil || "";
    const spLv = (map, who) => Object.keys(map || {}).forEach(k => {
      if (L >= +k) map[k].forEach(id => {
        const sp = spell(id);
        push(id, who, sp && sp.lv > 0 ? "Species: cast once per Long Rest without a slot; always prepared." : "Species", true, sa);
      });
    });
    if (s) { spLv(s.sp, s.n); if (ln) spLv(ln.sp, s.n + " (" + ln.n + ")"); }
    feats(ch).forEach(f => {
      if (f.id !== "magic-initiate") return;
      const d = f.data || {};
      (d.cantrips || []).forEach(id => push(id, "Magic Initiate", "Magic Initiate (" + cap(d.cls || f.fixedCls) + ")", true, d.abil));
      if (d.spell) push(d.spell, "Magic Initiate", "Magic Initiate: cast once per Long Rest without a slot; always prepared.", true, d.abil);
    });
    (ch.spells.extra || []).forEach(e => push(e.id, "Other", e.note || "", true, ""));
    return out;
  }

  function spellLimits(ch) {
    const c = cls(ch), id = clsId(ch), row = levelRow(c, (ch.classes[0] || {}).lv || 1);
    if (!c || !c.cast) return null;
    let can = row.can;
    if (id === "cleric" && ch.ch.divineOrder === "thaumaturge") can += 1;
    if (id === "druid" && ch.ch.primalOrder === "magician") can += 1;
    const maxLv = row.slots.reduce((m, n, i) => n ? i + 1 : m, 0);
    return { cantrips: can, prepared: row.prep, maxLv, slots: row.slots };
  }

  const classSpells = (clsName, lv) => Object.keys(SRD.spells).filter(k => {
    const s = SRD.spells[k];
    return s.cls.includes(clsName) && (lv === undefined || s.lv === lv);
  }).sort((a, b) => SRD.spells[a].lv - SRD.spells[b].lv || SRD.spells[a].n.localeCompare(SRD.spells[b].n));

  // ---------------------------------------------------------------- items

  function itemName(id) {
    if (!id) return "";
    if (id.startsWith("cat:")) return (SRD.cats[id.slice(4)] || {}).n || id;
    const it = item(id);
    return it ? it.n : id;
  }
  function itemCat(id) {
    const it = item(id);
    if (!it) return "Gear";
    const c = it.cats || [];
    if (c.includes("weapons")) return "Weapons";
    if (c.includes("armor")) return "Armor";
    if (c.includes("tools")) return "Tools";
    if (c.includes("ammunition")) return "Ammunition";
    if (c.some(x => x.endsWith("-foci") || x === "holy-symbols")) return "Focus";
    return "Gear";
  }

  // An equipment list from extra.js -> [{ref, name, qty, notes}], gp. Packs are opened into their contents.
  function expandEquip(list, picks) {
    const items = [];
    let gp = 0;
    const add = (ref, qty, note) => {
      const it = item(ref);
      if (it && it.contents) { it.contents.forEach(([r, q]) => add(r, q * qty, "")); return; }
      const name = itemName(ref) + (note ? " (" + note + ")" : "");
      const old = items.find(x => x.name === name);
      if (old) old.qty += qty;
      else items.push({ ref: it ? ref : "", name, qty, notes: "" });
    };
    (list || []).forEach(e => {
      let ref = e, qty = 1, note = "";
      if (Array.isArray(e)) [ref, qty, note] = [e[0], e[1] || 1, e[2] || ""];
      if (ref === "gp") { gp += qty; return; }
      if (ref.startsWith("@")) {
        const p = picks[ref];
        if (!p) { items.push({ ref: "", name: "(" + ref.slice(1) + ": not chosen)", qty, notes: "" }); return; }
        ref = p;
      }
      add(ref, qty, note);
    });
    return { items, gp };
  }

  // the starting gear for the choices made, as inventory rows
  function startingGear(ch) {
    const id = clsId(ch), bg = background(ch);
    const picks = Object.assign({}, ch.equip.picks, { "@bgTool": ch.bg.tool, "@monkTool": ch.ch.monkTool });
    if (id === "bard" && !picks["@instrument"]) picks["@instrument"] = (ch.ch.instruments || [])[0];
    const out = { items: [], gp: 0 };
    const merge = r => { r.items.forEach(i => { const o = out.items.find(x => x.name === i.name); if (o) o.qty += i.qty; else out.items.push(i); }); out.gp += r.gp; };
    const ce = X.classEquip[id];
    if (ce && ch.equip.cls) merge(expandEquip(ce["abc".indexOf(ch.equip.cls)], picks));
    if (bg && ch.equip.bg) merge(expandEquip(ch.equip.bg === "a" ? bg.equip : [["gp", 50]], picks));
    out.items.forEach(i => {
      const it = item(i.ref);
      i.cat = itemCat(i.ref);
      i.equipped = !!(it && (it.ac !== undefined || it.dmg));
    });
    // only one body armor worn
    let worn = false;
    out.items.forEach(i => { const it = item(i.ref); if (it && it.ac !== undefined && !it.cats.includes("shields")) { if (worn) i.equipped = false; worn = true; } });
    return out;
  }

  // ---------------------------------------------------------------- the sheet

  function compute(ch) {
    const c = cls(ch), id = clsId(ch), L = level(ch), pb = pbOf(L), s = species(ch), ln = line(ch), bg = background(ch);
    const sc = scores(ch), m = {};
    ABILS.forEach(k => { m[k] = mod(sc[k]); });
    const t = training(ch);
    const sk = skillProfs(ch);
    const clv = (ch.classes[0] || {}).lv || 1;
    const warn = [];

    // hit points
    let hp = 0;
    const hd = c ? c.hd : 8;
    for (let i = 1; i <= L; i++) {
      const roll = i === 1 ? hd : (ch.hp.method === "roll" && ch.hp.rolls[i] ? +ch.hp.rolls[i] : hd / 2 + 1);
      hp += Math.max(1, roll + m.con);
    }
    if (s && s.hpPerLevel) hp += s.hpPerLevel * L;
    feats(ch).forEach(f => { const ft = feat(f.id); if (ft && ft.hpPerLevel) hp += ft.hpPerLevel * L; });

    // armor class
    const worn = ch.items.filter(i => i.equipped && item(i.ref) && item(i.ref).ac !== undefined);
    const body = worn.map(i => item(i.ref)).filter(it => !it.cats.includes("shields")).sort((a, b) => b.ac - a.ac)[0];
    const shield = worn.some(i => item(i.ref).cats.includes("shields"));
    let ac, acNote;
    if (body) {
      ac = body.ac + (body.dex ? (body.max != null ? Math.min(body.max, m.dex) : m.dex) : 0);
      acNote = body.n;
      const kind = body.cats.find(x => /^(light|medium|heavy)-armor$/.test(x));
      if (kind && !t.armor.has(kind.replace("-armor", ""))) warn.push("Not trained with " + body.n + ": Disadvantage on Str/Dex tests, no spells.");
      if (body.strmin && sc.str < body.strmin) warn.push(body.n + " needs Strength " + body.strmin + ": Speed −10 ft.");
    } else if (id === "barbarian") { ac = 10 + m.dex + m.con; acNote = "Unarmored Defense"; }
    else if (id === "monk" && !shield) { ac = 10 + m.dex + m.wis; acNote = "Unarmored Defense"; }
    else { ac = 10 + m.dex; acNote = "No armor"; }
    if (shield) { ac += 2; acNote += " + shield"; if (!t.armor.has("shield")) warn.push("Not trained with shields."); }
    if (body && ch.ch.fightingStyle === "defense") { ac += 1; acNote += " + Defense"; }

    // speed, senses
    let speed = (ln && ln.speed) || (s ? s.speed : 30);
    if (id === "monk" && clv >= 2 && !body && !shield) speed += levelRow(c, clv).cs.unarmored_movement_bonus || 0;
    const dv = (ln && ln.dv) || (s ? s.dv : 0);
    const skillBonus = k => m[SKILLS[k]] + (sk.prof[k] || 0) * pb + (!sk.prof[k] && id === "bard" && clv >= 2 ? Math.floor(pb / 2) : 0);
    const passive = 10 + skillBonus("perception");
    const senses = [dv ? "Darkvision " + dv + " ft" : "", "Passive Perception " + passive].filter(Boolean).join(", ");
    let init = m.dex + (hasFeat(ch, "alert") ? pb : (id === "bard" && clv >= 2 ? Math.floor(pb / 2) : 0));

    // resistances
    const res = new Set([...(s && s.res || []), ...(ln && ln.res || [])]);

    // languages
    const langs = [X.languages.common, ...(ch.ch.langs || []).filter(Boolean)];
    if (id === "rogue") langs.push("Thieves' Cant");
    if (id === "druid") langs.push("Druidic");

    // features
    const features = [];
    const usesOf = (spec) => {
      if (!spec) return [0, ""];
      let [n, rc] = spec;
      const row = levelRow(c, clv);
      if (n === "pb") n = pb;
      else if (typeof n === "string" && n.startsWith("cs:")) n = row.cs[n.slice(3)] || 0;
      else if (typeof n === "string" && n.startsWith("mod:")) n = Math.max(1, m[n.slice(4)]);
      else if (n === "lv5") n = 5 * clv;
      return [Math.min(99, n || 0), rc || ""];
    };
    if (s) s.traits.forEach(tr => {
      if ((tr.n === "Celestial Revelation" && L < 3) || (tr.n === "Draconic Flight" && L < 5)) return;
      let text = tr.t;
      if (ln && /Lineage|Life Core|Ancestry/.test(tr.n)) text = "**Your choice: " + ln.n + ".**\n\n" + text;
      const u = s.uses && s.uses[tr.n];
      const [n, rc] = usesOf(u);
      features.push({ name: tr.n, text, uses: n, recharge: rc, src: s.n });
    });
    if (ln && ln.uses) Object.keys(ln.uses).forEach(k => { const [n, rc] = usesOf(ln.uses[k]); features.push({ name: k, text: "", uses: n, recharge: rc, src: s.n }); });
    feats(ch).forEach(f => {
      const ft = feat(f.id);
      if (!ft) return;
      let text = ft.t;
      if (f.id === "magic-initiate") text = "**List: " + cap(f.data.cls || f.fixedCls || "?") + ", ability: " + (ABIL_NAMES[f.data.abil] || "?") + ".**\n\n" + text;
      const [n, rc] = usesOf(ft.uses);
      features.push({ name: ft.n + (f.from === "cls" ? " (Fighting Style)" : ""), text, uses: n, recharge: rc, src: f.from === "bg" ? "Background" : f.from === "sp" ? "Species" : "Class" });
    });
    if (c) {
      for (let lv = 1; lv <= clv; lv++) levelRow(c, lv).f.forEach(fid => {
        const f = SRD.features[fid];
        if (!f || fid.endsWith("-subclass")) return;
        let text = f.t;
        if (fid === "cleric-divine-order" && ch.ch.divineOrder) text = "**Your choice: " + X.divineOrder[ch.ch.divineOrder].n + ".**\n\n" + text;
        if (fid === "druid-primal-order" && ch.ch.primalOrder) text = "**Your choice: " + X.primalOrder[ch.ch.primalOrder].n + ".**\n\n" + text;
        if (fid.endsWith("-weapon-mastery") && ch.ch.mastery.length) text = "**Your weapons:** " + ch.ch.mastery.map(w => itemName(w) + " (" + ((SRD.mastery[(item(w) || {}).mastery] || {}).n || "?") + ")").join(", ") + ".\n\n" + text;
        if (fid === "rogue-expertise" && ch.exp.length) text = "**Your skills:** " + ch.exp.map(k => SKILL_NAMES[k]).join(", ") + ".\n\n" + text;
        const [n, rc] = usesOf(X.uses[fid]);
        features.push({ name: f.n, text, uses: n, recharge: rc, src: c.n + " " + lv });
      });
      const sub = SRD.subclasses[(ch.classes[0] || {}).sub];
      if (sub) sub.f.filter(f => f.lv <= clv).forEach(f => features.push({ name: f.n, text: f.t, uses: 0, recharge: "", src: sub.n }));
      (ch.ch.invocations || []).forEach(k => { const v = SRD.invocations[k]; if (v) features.push({ name: "Invocation: " + v.n, text: v.t, uses: 0, recharge: "", src: "Warlock" }); });
      ch.ch.mastery.forEach(w => {
        const mp = SRD.mastery[(item(w) || {}).mastery];
        if (mp && !features.some(f => f.name === "Mastery: " + mp.n)) features.push({ name: "Mastery: " + mp.n, text: mp.t, uses: 0, recharge: "", src: "Weapon Mastery" });
      });
    }
    features.push({ name: "Cyphers", text: X.house.cypherLimit.replace("{n}", pb + 1) + "\n\n" + X.house.intrusion, uses: 0, recharge: "", src: "House rules" });
    const profText = [
      "**Armor:** " + (["light", "medium", "heavy", "shield"].filter(a => t.armor.has(a)).map(a => a === "shield" ? "Shields" : cap(a)).join(", ") || "none"),
      "**Weapons:** " + ([t.simple ? "Simple" : "", t.martial ? "Martial" : "", t.martialIf ? "Martial with " + t.martialIf.map(cap).join(" or ") : "", ...t.weapons].filter(Boolean).join(", ") || "none"),
      "**Tools:** " + ([...t.tools].join(", ") || "none"),
      "**Languages:** " + langs.join(", ")
    ].join("\n");
    features.push({ name: "Training & Proficiencies", text: profText, uses: 0, recharge: "", src: "" });

    // attacks
    const attacks = [];
    const martialArts = id === "monk" ? levelRow(c, clv).cs.martial_arts_die || 6 : 0;
    const seen = new Set();
    ch.items.forEach(i => {
      const it = item(i.ref);
      if (!it || !it.dmg || seen.has(i.ref)) return;
      seen.add(i.ref);
      const ranged = it.cats.includes("ranged-weapons");
      const finesse = it.props.includes("finesse");
      const monkW = martialArts && (it.cats.includes("simple-melee-weapons") || (it.cats.includes("martial-melee-weapons") && it.props.includes("light")));
      const am = ranged ? m.dex : (finesse || monkW ? Math.max(m.str, m.dex) : m.str);
      const prof = weaponProficient(ch, i.ref, t);
      let bonus = am + (prof ? pb : 0) + (ranged && ch.ch.fightingStyle === "archery" ? 2 : 0);
      let die = it.dmg;
      if (monkW && +die.split("d")[1] < martialArts) die = "1d" + martialArts;
      const notes = [];
      if (it.two) notes.push("Versatile " + it.two);
      if (it.props.includes("thrown") && it.thr && it.thr.normal) notes.push("Thrown " + it.thr.normal + "/" + it.thr.long + " ft");
      if (ch.ch.mastery.includes(i.ref) && it.mastery) notes.push("Mastery: " + ((SRD.mastery[it.mastery] || {}).n || it.mastery));
      const props = it.props.filter(p => !["versatile", "thrown", "ammunition", "monk"].includes(p)).map(p => cap(p.replace(/-/g, " ")));
      if (props.length) notes.push(props.join(", "));
      if (!prof) notes.push("Not proficient");
      const range = ranged ? it.rng.normal + "/" + it.rng.long + " ft" : (it.props.includes("reach") ? "10 ft" : "5 ft");
      attacks.push({ name: it.n, bonus: sign(bonus), damage: die + (am ? sign(am) : "") + " " + it.dt.toLowerCase(), range, notes: notes.join("; ") });
    });
    {
      let die = "1", am = m.str;
      if (martialArts) { die = "1d" + martialArts; am = Math.max(m.str, m.dex); }
      else if (hasFeat(ch, "tavern-brawler")) die = "1d4";
      const dmg = die === "1" ? String(Math.max(1, 1 + am)) : die + (am ? sign(am) : "");
      attacks.push({ name: "Unarmed Strike", bonus: sign(am + pb), damage: dmg + " bludgeoning", range: "5 ft", notes: martialArts ? "Martial Arts" : "" });
    }

    // spells
    const lim = spellLimits(ch);
    const castAbil = c && c.cast ? c.cast : "";
    const spells = spellList(ch);
    if (lim) {
      const nc = (ch.spells.cantrips || []).length, np = (ch.spells.prepared || []).length;
      if (nc < lim.cantrips) warn.push("Choose " + (lim.cantrips - nc) + " more cantrip(s).");
      if (np < lim.prepared) warn.push("Choose " + (lim.prepared - np) + " more prepared spell(s).");
    }

    // what is still missing
    if (!c) warn.push("Choose a class.");
    if (!bg) warn.push("Choose a background.");
    if (!s) warn.push("Choose a species.");
    if (s && s.lines && !ln) warn.push("Choose your " + s.lineLabel + ".");
    if (c && c.skills && (ch.skills || []).length < c.skills.n) warn.push("Choose " + (c.skills.n - ch.skills.length) + " more class skill(s).");

    const sub = SRD.subclasses[(ch.classes[0] || {}).sub];
    return {
      name: ch.name || "Unnamed", level: L, pb, scores: sc, mods: m, saves: c ? c.saves : [], skills: sk.prof, skillSrc: sk.src,
      skillBonus, hp, hd: L + "d" + hd, ac, acNote, speed, senses, passive, init, res: [...res], langs, training: t,
      features, attacks, spells, slots: lim ? lim.slots : [0, 0, 0, 0, 0, 0, 0, 0, 0], castAbil,
      dc: castAbil ? 8 + pb + m[castAbil] : 0, spellAtk: castAbil ? pb + m[castAbil] : 0,
      clsText: c ? c.n + " " + clv + (sub ? " (" + sub.n + ")" : "") : "",
      label: X.labels[id] || "",
      speciesText: s ? s.n + (ln ? ", " + ln.n.replace(/\s*\(.*\)/, "") : "") : "",
      size: ch.sp.size || (s ? s.size[0] : ""), bgText: bg ? bg.n : "", warn
    };
  }

  // ---------------------------------------------------------------- export for Fogwright VTT

  function toVTT(ch, version) {
    const s = compute(ch);
    const conc = id => !!(spell(id) || {}).conc;
    const det = ch.det || {};
    const notes = [
      s.label ? "**Ninth World:** " + s.label + "." : "",
      det.appearance ? "## Appearance\n" + det.appearance : "",
      det.personality ? "## Personality\n" + det.personality : "",
      det.backstory ? "## Backstory\n" + det.backstory : "",
      det.notes ? "## Notes\n" + det.notes : "",
      "_Made with Fogwright Forge " + (version || "") + "._"
    ].filter(Boolean).join("\n\n");
    const items = ch.items.map(i => ({ name: i.name, qty: i.qty, equipped: !!i.equipped, cat: i.cat || "", notes: i.notes || "" }));
    if (ch.gp) items.push({ name: "Shins", qty: ch.gp, equipped: false, cat: "Money", notes: "1 shin = 1 gp" });
    return {
      kind: "pc", name: (ch.name || "Unnamed").slice(0, 60), owner: (ch.player || "").slice(0, 40), level: s.level, cr: "",
      cls: s.clsText.slice(0, 80), species: s.speciesText.slice(0, 60), background: s.bgText, size: s.size,
      abil: s.scores, saves: s.saves, skills: s.skills, ac: s.ac, ac_note: s.acNote.slice(0, 80), hp_max: s.hp,
      hit_dice: s.hd, speed: s.speed + " ft", init: s.init, pb: s.pb, senses: s.senses.slice(0, 120),
      languages: s.langs.join(", ").slice(0, 160), resist: s.res.join(", "), immune: "", vuln: "",
      attacks: s.attacks.map(a => ({ name: a.name, bonus: a.bonus, damage: a.damage, range: a.range, notes: a.notes.slice(0, 300) })),
      spell_abil: s.castAbil || (s.spells.find(x => x.abil) || {}).abil || "",
      slots: s.slots,
      spells: s.spells.map(x => ({ name: x.n, level: x.lv, prepared: x.lv > 0 && x.prepared, conc: conc(x.id), notes: (x.notes || "").slice(0, 300) })),
      features: s.features.map(f => ({ name: f.name.slice(0, 80), text: f.text.slice(0, 3000), uses: f.uses || 0, recharge: f.recharge || "" })),
      items, inventory: "", notes,
      state: { hp: s.hp, temp: 0, ds_ok: 0, ds_fail: 0, hd_used: 0, slots_used: [0, 0, 0, 0, 0, 0, 0, 0, 0], uses_used: {},
               conditions: [], exhaustion: 0, inspiration: !!(species(ch) && species(ch).id === "humans"), concentration: "", stable: false, dead: false }
    };
  }

  window.Rules = {
    ABILS, ABIL_NAMES, SKILLS, SKILL_NAMES, SPECIES, STANDARD, POINT_COST, mod, sign, pbOf, cap,
    blank, cls, clsId, level, species, line, background, feat, feats, spell, item, itemName, levelRow,
    baseScores, pointsSpent, bgBonus, scores, training, weaponProficient, skillProfs, spellList, spellLimits,
    classSpells, startingGear, expandEquip, compute, toVTT
  };
})();
