// Fogwright Forge: the rules engine. compute(ch) turns the player's choices into a finished sheet,
// and toVTT(ch) writes that sheet in the format Fogwright VTT imports (sheets.py clean()).
(function () {
  "use strict";
  const SRD = window.SRD, X = window.EXTRA;
  // the Artificer (Forge of the Artificer, data/artificer.js) joins the SRD classes
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
  // "Name "Nickname"", or whichever of the two there is
  const fullName = ch => ch.name && ch.nick ? ch.name + " \u201c" + ch.nick + "\u201d" : (ch.name || ch.nick || "Unnamed");

  function blank() {
    return {
      fv: 1, id: "c" + Math.random().toString(36).slice(2, 10), name: "", nick: "", player: "", created: Date.now(), updated: Date.now(),
      classes: [{ id: "", lv: 1, sub: "" }],
      hp: { method: "avg", rolls: {} },
      sp: { id: "", size: "", line: "", abil: "", skill: "", keen: "", feat: "", featData: {}, bio: { rolled: {}, pick: {}, custom: "" } },
      bg: { id: "", mode: "21", p2: "", p1: "", p111: [], tool: "", featData: {} },
      ab: { method: "array", base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, assign: {}, rolled: [] },
      skills: [], exp: [],
      ch: { fightingStyle: "", divineOrder: "", primalOrder: "", mastery: [], invocations: [], instruments: [], monkTool: "", langs: [], plans: [] },
      spells: { cantrips: [], prepared: [], extra: [] },
      equip: { cls: "", bg: "", picks: {} }, items: [], gp: 0,
      det: { appearance: "", personality: "", backstory: "", notes: "" },
      asi: {}, lvNotes: {}
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

  // ---------------------------------------------------------------- levels

  const clvOf = ch => Math.max(1, Math.min(20, (ch.classes[0] || {}).lv || 1));
  // the levels of this class that give an Ability Score Improvement or an Epic Boon: [{lv, boon}]
  function asiLevels(c) {
    const out = [];
    if (!c) return out;
    for (let lv = 2; lv <= 20; lv++) levelRow(c, lv).f.forEach(fid => {
      if (fid.endsWith("-ability-score-improvement")) out.push({ lv, boon: false });
      else if (fid.endsWith("-epic-boon")) out.push({ lv, boon: true });
    });
    return out;
  }
  // the class level where the subclass is chosen
  function subLevel(c) {
    if (!c) return 3;
    for (let lv = 1; lv <= 20; lv++) if (levelRow(c, lv).f.some(f => f.endsWith("-subclass"))) return lv;
    return 3;
  }
  const hasFightingStyle = (id, lv) => id === "fighter" || ((id === "paladin" || id === "ranger") && lv >= 2);
  // how many of each scaling choice the character has at their level
  function counts(ch) {
    const c = cls(ch), id = clsId(ch), lv = clvOf(ch);
    let wm = 0, inv = 0;
    for (let i = 1; i <= lv; i++) { const r = levelRow(c, i).cs || {}; wm = Math.max(wm, r.weapon_mastery || 0); inv = Math.max(inv, r.eldritch_invocations || 0); }
    if (id === "warlock" && !inv) inv = 1;
    const exp = id === "rogue" ? (lv >= 6 ? 4 : 2) : id === "bard" ? (lv >= 9 ? 4 : lv >= 2 ? 2 : 0) :
      id === "ranger" ? (lv >= 9 ? 3 : lv >= 2 ? 1 : 0) : id === "wizard" ? (lv >= 2 ? 1 : 0) : 0;
    const langs = 2 + (id === "ranger" && lv >= 2 ? 2 : 0);
    return { mastery: wm, invocations: inv, expertise: exp, langs, fightingStyle: hasFightingStyle(id, lv) ? 1 : 0 };
  }
  // feats a level-up may give: general feats, origin feats, fighting styles (if the class has them), epic boons at 19
  function levelFeats(ch, boon) {
    const id = clsId(ch), out = [];
    const all = Object.assign({}, SRD.feats, X.feats);
    Object.keys(all).forEach(k => {
      const f = all[k], t = f.type || "origin";
      if (k === "ability-score-improvement") return;
      if (t === "fighting-style" && !hasFightingStyle(id, 2)) return;
      if (t === "epic-boon" && !boon) return;
      out.push(k);
    });
    return out;
  }
  // Artificer magic item plans (Replicate Magic Item): how many, which tables are open, the plans chosen
  function plans(ch) {
    if (clsId(ch) !== "artificer" || !A) return null;
    const lv = clvOf(ch), cs = levelRow(cls(ch), lv).cs || {};
    if (!cs.plans_known) return null;
    const armor = (ch.classes[0] || {}).sub === "armorer" && lv >= 9 ? 1 : 0;
    const tiers = Object.keys(A.plans).map(Number).filter(t => t <= lv);
    const all = {};
    Object.keys(A.plans).forEach(t => A.plans[t].forEach(([id, n, att, gen]) => { all[id] = { id, n, att, gen: !!gen, tier: +t }; }));
    const chosen = (ch.ch.plans || []).map(p => Object.assign({}, all[p.id] || { id: p.id, n: p.id, att: "", tier: 99 }, { item: p.item || "", spell: p.spell || "", tattoo: !!p.tattoo }));
    return { known: cs.plans_known + armor, items: cs.magic_items + armor, attune: lv >= 18 ? 6 : lv >= 14 ? 5 : lv >= 10 ? 4 : 3, armor: !!armor,
      tiers, all, chosen, rare: 0 };
  }
  // Magic on an inventory item: a plain +N, or an Artificer plan the item was made from.
  // kind: w = weapon (needs: ranged/thrown/ammo), a = body armor, s = shield. b = bonus to attack+damage or AC.
  const PLAN_FX = {
    "weapon-1": { k: "w", b: 1 }, "weapon-2": { k: "w", b: 2 },
    "repeating-shot": { k: "w", b: 1, need: "ammunition", ranged: true, note: "Repeating Shot: ignores Loading, makes its own ammunition" },
    "returning-weapon": { k: "w", b: 1, need: "thrown", note: "Returning Weapon: flies back to your hand after a ranged attack" },
    "dazzling-weapon": { k: "w", b: 1, note: "Dazzling Weapon: light at will; 4 charges, Reaction when hit: attacker DC 15 Con save or Blinded" },
    "dagger-of-venom": { k: "w", b: 1, note: "Dagger of Venom: once per dawn, coat it in poison" },
    "weapon-of-warning": { k: "w", b: 0, note: "Weapon of Warning: Advantage on Initiative; you and allies within 30 ft can't be surprised" },
    "flame-tongue": { k: "w", b: 0, note: "Flame Tongue: Bonus Action to ignite, +2d6 Fire while lit" },
    "armor-1": { k: "a", b: 1 }, "armor-2": { k: "a", b: 2 }, "elven-chain": { k: "a", b: 1, note: "Elven Chain" },
    "armor-of-resistance": { k: "a", b: 0, note: "Armor of Resistance: Resistance to one damage type" },
    "shield-1": { k: "s", b: 1 }, "shield-2": { k: "s", b: 2 },
    "repulsion-shield": { k: "s", b: 1, note: "Repulsion Shield: 4 charges, Reaction push a melee attacker 15 ft" },
    "sentinel-shield": { k: "s", b: 0, note: "Sentinel Shield: Advantage on Initiative and Wisdom (Perception)" },
    "arrow-catching-shield": { k: "s", b: 0, note: "Arrow-Catching Shield: +2 AC against ranged attacks; Reaction to take a ranged attack meant for someone near you" }
  };
  const kindOf = it => !it ? "" : it.dmg ? "w" : it.ac === undefined ? "" : it.cats.includes("shields") ? "s" : "a";
  // the magic options an item can take: [value, label]
  function magicOptions(ch, ref) {
    const it = item(ref), k = kindOf(it);
    if (!k) return [];
    const out = [["+1", "+1"], ["+2", "+2"], ["+3", "+3"]];
    const pl = plans(ch);
    if (pl) pl.chosen.forEach(p => { const fx = PLAN_FX[p.id];
      if (fx && fx.k === k && (!fx.need || it.props.includes(fx.need))) out.push(["plan:" + p.id, p.n]); });
    return out;
  }
  // what the magic does: {b, label, note, off}
  function magicOf(ch, i) {
    const v = i.magic || "", it = item(i.ref);
    if (!v || !it) return { b: 0, label: "", note: "" };
    if (/^\+\d$/.test(v)) return { b: +v.slice(1), label: v, note: "" };
    const id = v.slice(5), fx = PLAN_FX[id], pl = plans(ch);
    if (!fx) return { b: 0, label: "", note: "" };
    const name = (pl && pl.all[id] || {}).n || id;
    const off = !pl || !pl.chosen.some(p => p.id === id);
    return { b: off ? 0 : fx.b, label: !fx.note && fx.b ? "+" + fx.b : name, note: fx.note || "", ranged: fx.ranged, noLoad: id === "repeating-shot", off };
  }
  // a plan that holds a spell (Spellwrought Tattoo): the spell levels its open plan allows
  const tattooLevels = p => !(p.tattoo || /tattoo/i.test(p.item || "")) ? null : p.id === "common" ? [0, 1] : p.id === "uncommon-w" ? [2] : p.id === "rare-w" ? [3, 4, 5] : null;
  // plans saved with the UA 2024 tables move to the Forge of the Artificer ones
  function migratePlans(ch) {
    if (!A || !ch.ch || !Array.isArray(ch.ch.plans)) return;
    const rows = {};
    Object.keys(A.plans).forEach(t => A.plans[t].forEach(r => { rows[r[0]] = r; }));
    const byName = n => Object.values(rows).find(r => !r[3] && r[1].toLowerCase() === String(n || "").toLowerCase());
    ch.ch.plans = ch.ch.plans.map(p => {
      if (rows[p.id]) return p;
      const named = byName(p.item);
      if (named) return { id: named[0], item: "" };
      const to = (A.planMoves || {})[p.id];
      return to ? Object.assign({}, p, { id: to }) : p;
    });
  }
  const planName = p => p.gen ? (p.item ? p.item + " (" + p.n.replace(/\s*\(.*\)/, "") + ")" : p.n + " - item not named yet") : p.n;

  // the +1 a general feat or an epic boon gives: allowed abilities, and the cap
  function featPlus(id) {
    const f = feat(id);
    if (!f) return null;
    if (f.type === "epic-boon") return { from: ABILS, max: 30 };
    const m = /Increase your ([A-Z][a-z]+(?:, [A-Z][a-z]+)*(?:,? or [A-Z][a-z]+)?) score by 1/.exec(f.t || "");
    if (!m) return null;
    const names = m[1].split(/,? or |, /).map(n => ABILS.find(k => ABIL_NAMES[k] === n)).filter(Boolean);
    return names.length ? { from: names, max: 20 } : null;
  }

  // feats the character has: [{id, from, data}]
  function feats(ch) {
    const out = [];
    const bg = background(ch);
    if (bg) out.push({ id: bg.feat, from: "bg", data: ch.bg.featData || {}, fixedCls: bg.featCls || "" });
    const s = species(ch);
    if (s && s.originFeat && ch.sp.feat) out.push({ id: ch.sp.feat, from: "sp", data: ch.sp.featData || {} });
    if (ch.ch.fightingStyle && hasFightingStyle(clsId(ch), clvOf(ch))) out.push({ id: ch.ch.fightingStyle, from: "cls", data: {} });
    const lv = clvOf(ch);
    asiLevels(cls(ch)).forEach(a => {
      const x = (ch.asi || {})[a.lv];
      if (a.lv <= lv && x && x.mode === "feat" && x.feat) out.push({ id: x.feat, from: "lvl", lv: a.lv, data: x.featData || {} });
    });
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

  // increases from level-ups: {str: n, ...} up to 20, and boon: {...} that may go to 30
  function asiBonus(ch) {
    const b = {}, boon = {}, lv = clvOf(ch);
    ABILS.forEach(k => { b[k] = 0; boon[k] = 0; });
    asiLevels(cls(ch)).forEach(a => {
      const x = (ch.asi || {})[a.lv];
      if (a.lv > lv || !x) return;
      if (x.mode === "asi") (x.a || []).forEach(k => { if (k && b[k] !== undefined) b[k]++; });
      else if (x.mode === "feat" && x.plus) {
        const fp = featPlus(x.feat);
        if (fp && fp.from.includes(x.plus)) (fp.max > 20 ? boon : b)[x.plus]++;
      }
    });
    return { b, boon };
  }

  function scores(ch) {
    const base = baseScores(ch), bon = bgBonus(ch), up = asiBonus(ch), out = {};
    ABILS.forEach(k => { out[k] = Math.min(30, Math.min(20, base[k] + bon[k] + up.b[k]) + up.boon[k]); });
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
    if (c && clsId(ch) === "artificer") push("mending", "Tinker's Magic", "Tinker's Magic: always known, doesn't count against your cantrips.", true, c.cast);
    const sub = SRD.subclasses[(ch.classes[0] || {}).sub];
    if (sub && c) sub.f.forEach(f => Object.keys(f.spells || {}).forEach(k => { if (clvOf(ch) >= +k) f.spells[k].forEach(id => push(id, sub.n, sub.n + ": always prepared, doesn't count against your prepared spells.", true, c.cast)); }));
    const pl = plans(ch);
    if (pl) pl.chosen.forEach(p => { if (p.spell) push(p.spell, "Replicate Magic Item", (p.item || "Spellwrought Tattoo") + ": cast it once with no slot (pick \"No slot\"), then it is used up; you can make it again after a Long Rest.", true, "item"); });
    (ch.spells.extra || []).forEach(e => push(e.id, "Other", e.note || "", true, ""));
    return out;
  }

  function spellLimits(ch) {
    const c = cls(ch), id = clsId(ch), row = levelRow(c, clvOf(ch));
    if (!c || !c.cast || (!row.can && !row.prep && !row.slots.some(Boolean))) return null;
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

  // ---------------------------------------------------------------- Grafted bionics (tables/grafted-bionics.md)

  const BIO_SLOTS = [["core", "core", 6], ["g1", "grafts", 20], ["g2", "grafts", 20], ["look", "look", 8], ["quirk", "quirk", 12], ["perk", "perk", 10]];
  function bionics(ch) {
    const s = species(ch);
    if (!s || !s.bionics) return null;
    const b = ch.sp.bio || { rolled: {}, pick: {} }, out = {};
    BIO_SLOTS.forEach(([k, tbl]) => {
      const i = b.pick[k] !== undefined && b.pick[k] !== "" ? +b.pick[k] : (b.rolled[k] !== undefined ? +b.rolled[k] : -1);
      const row = s.bionics[tbl][i];
      out[k] = row === undefined ? null : { i, row, text: tbl === "core" ? row[0] : tbl === "perk" ? row[0] + ": " + row[1] : row };
      if (out[k] && tbl === "grafts" && i === 19 && b.custom) out[k].text = b.custom;
    });
    const rolledAll = BIO_SLOTS.every(([k]) => b.rolled[k] !== undefined);
    out.swaps = rolledAll ? BIO_SLOTS.filter(([k]) => b.pick[k] !== undefined && b.pick[k] !== "" && +b.pick[k] !== +b.rolled[k]).length : 0;
    out.done = BIO_SLOTS.every(([k]) => out[k]);
    return out;
  }
  function rollBionics(ch) {
    const d = n => Math.floor(Math.random() * n);
    const r = {};
    BIO_SLOTS.forEach(([k, , n]) => { r[k] = d(n); });
    while (r.g2 === r.g1) r.g2 = d(20);
    ch.sp.bio = { rolled: r, pick: {}, custom: "" };
  }

  // ---------------------------------------------------------------- the sheet

  function compute(ch) {
    const c = cls(ch), id = clsId(ch), L = level(ch), pb = pbOf(L), s = species(ch), ln = line(ch), bg = background(ch);
    const sc = scores(ch), m = {};
    ABILS.forEach(k => { m[k] = mod(sc[k]); });
    const t = training(ch);
    const sk = skillProfs(ch);
    const clv = clvOf(ch);
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
    const shieldI = worn.find(i => item(i.ref).cats.includes("shields")), shield = !!shieldI;
    const bodyI = body && worn.find(i => item(i.ref) === body);
    let ac, acNote;
    if (body) {
      ac = body.ac + (body.dex ? (body.max != null ? Math.min(body.max, m.dex) : m.dex) : 0);
      acNote = body.n;
      const mg = magicOf(ch, bodyI);
      if (mg.b) { ac += mg.b; acNote += " " + (mg.label.startsWith("+") ? mg.label : "(" + mg.label + ")"); }
      if (mg.off) warn.push(body.n + ": you no longer know the " + mg.label + " plan.");      const kind = body.cats.find(x => /^(light|medium|heavy)-armor$/.test(x));
      if (kind && !t.armor.has(kind.replace("-armor", ""))) warn.push("Not trained with " + body.n + ": Disadvantage on Str/Dex tests, no spells.");
      if (body.strmin && sc.str < body.strmin) warn.push(body.n + " needs Strength " + body.strmin + ": Speed −10 ft.");
    } else if (id === "barbarian") { ac = 10 + m.dex + m.con; acNote = "Unarmored Defense"; }
    else if (id === "monk" && !shield) { ac = 10 + m.dex + m.wis; acNote = "Unarmored Defense"; }
    else { ac = 10 + m.dex; acNote = "No armor"; }
    if (shield) { const mg = magicOf(ch, shieldI); ac += 2 + mg.b; acNote += " + shield" + (mg.b ? " +" + mg.b : "");
      if (mg.off) warn.push("Shield: you no longer know the " + mg.label + " plan."); if (!t.armor.has("shield")) warn.push("Not trained with shields."); }
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
    if (id === "rogue") langs.push("Gutter-cant");
    if (id === "druid") langs.push("Root-sign");

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
      const bio = tr.n === "Bionic Body" ? bionics(ch) : null;
      if (bio && bio.done) text = "**Your bionics.** Core: " + bio.core.text + " Grafts: " + bio.g1.text + " " + bio.g2.text + " Look: " + bio.look.text + " Quirk: " + bio.quirk.text + " Perk: " + bio.perk.text + "\n\n" + text;
      if (ln && /Lineage|Life Core|Ancestry/.test(tr.n)) text = "**Your choice: " + ln.n + ".**\n\n" + text;
      const u = s.uses && s.uses[tr.n];
      const [n, rc] = usesOf(u);
      features.push({ name: tr.n, text, uses: n, recharge: rc, src: s.n });
    });
    { const bio = bionics(ch); if (bio && bio.perk) features.push({ name: "Perk: " + bio.perk.row[0], text: bio.perk.row[1] + " (Never helps in combat; the GM can veto it in a scene.)", uses: 0, recharge: "", src: "Bionics" }); }
    if (ln && ln.uses) Object.keys(ln.uses).forEach(k => { const [n, rc] = usesOf(ln.uses[k]); features.push({ name: k, text: "", uses: n, recharge: rc, src: s.n }); });
    feats(ch).forEach(f => {
      const ft = feat(f.id);
      if (!ft) return;
      let text = ft.t;
      if (f.id === "magic-initiate") text = "**List: " + cap(f.data.cls || f.fixedCls || "?") + ", ability: " + (ABIL_NAMES[f.data.abil] || "?") + ".**\n\n" + text;
      const [n, rc] = usesOf(ft.uses);
      const x = f.from === "lvl" ? ch.asi[f.lv] || {} : {};
      if (x.plus) text = "**+1 " + ABIL_NAMES[x.plus] + ".**\n\n" + text;
      features.push({ name: ft.n + (f.from === "cls" ? " (Fighting Style)" : ""), text, uses: n, recharge: rc, src: f.from === "bg" ? "Background" : f.from === "sp" ? "Species" : f.from === "lvl" ? (c ? c.n + " " + f.lv : "Level " + f.lv) : "Class" });
    });
    if (c) {
      for (let lv = 1; lv <= clv; lv++) levelRow(c, lv).f.forEach(fid => {
        const f = SRD.features[fid];
        if (!f || fid.endsWith("-subclass")) return;
        if (fid.endsWith("-ability-score-improvement") || fid.endsWith("-epic-boon")) {
          const x = (ch.asi || {})[lv];
          if (x && x.mode === "asi" && (x.a || []).filter(Boolean).length) features.push({ name: f.n, text: "**" + (x.a[0] === x.a[1] ? "+2 " + ABIL_NAMES[x.a[0]] : x.a.filter(Boolean).map(k => "+1 " + ABIL_NAMES[k]).join(", ")) + ".**", uses: 0, recharge: "", src: c.n + " " + lv });
          return;  // a feat taken here is listed with the feats
        }
        let text = f.t;
        if (fid === "cleric-divine-order" && ch.ch.divineOrder) text = "**Your choice: " + X.divineOrder[ch.ch.divineOrder].n + ".**\n\n" + text;
        if (fid === "druid-primal-order" && ch.ch.primalOrder) text = "**Your choice: " + X.primalOrder[ch.ch.primalOrder].n + ".**\n\n" + text;
        if (fid.endsWith("-weapon-mastery") && ch.ch.mastery.length) text = "**Your weapons:** " + ch.ch.mastery.map(w => itemName(w) + " (" + ((SRD.mastery[(item(w) || {}).mastery] || {}).n || "?") + ")").join(", ") + ".\n\n" + text;
        if (fid === "artificer-replicate-magic-item") {
          const pl = plans(ch);
          if (pl) text = "**Plans known (" + pl.chosen.length + "/" + pl.known + "):** " + (pl.chosen.map(p => planName(p) + (p.att === "Yes" ? " (attunement)" : "")).join(", ") || "none yet") +
            ".\n**Items after a Long Rest:** up to " + pl.items + ", each from a different plan" + (pl.armor ? " (one must be armor)" : "") + (pl.rare ? "; at most " + pl.rare + " Rare at a time" : "") +
            ". **Attunement:** up to " + pl.attune + " items.\n\n" +
            pl.chosen.map(p => (A.uaItems || []).find(u => (p.item && u[0] === p.item) || (!u[2] && u[0] === p.n))).filter(u => u && u[4] !== "DMG").map(u => "**" + u[0] + ".** " + u[3]).join("\n") +
            "\n\n" + text;
        }
        if (fid.endsWith("-fighting-style") && ch.ch.fightingStyle) text = "**Your choice: " + ((feat(ch.ch.fightingStyle) || {}).n || "") + ".**\n\n" + text;
        if (/-(expertise|scholar|deft-explorer)$/.test(fid) && ch.exp.length) text = "**Your skills:** " + ch.exp.map(k => SKILL_NAMES[k]).join(", ") + ".\n\n" + text;
        const [n, rc] = usesOf(X.uses[fid]);
        features.push({ name: f.n, text, uses: n, recharge: rc, src: c.n + " " + lv });
      });
      const sub = SRD.subclasses[(ch.classes[0] || {}).sub];
      if (sub) sub.f.filter(f => f.lv <= clv).forEach(f => { const [n, rc] = usesOf(f.u); features.push({ name: f.n, text: f.t, uses: n, recharge: rc, src: sub.n + " " + f.lv }); });
      { const pl = plans(ch); if (pl) pl.chosen.filter(p => p.spell && spell(p.spell)).forEach(p => features.push({ name: (p.item || "Spellwrought Tattoo").slice(0, 60), text: "Spellwrought Tattoo holding **" + spell(p.spell).n + "**. Cast it once with no spell slot (the tattoo's own numbers from the DMG table, not yours), then it is used up. Replicate Magic Item can make it again after a Long Rest (it counts as one of the items you make).", uses: 1, recharge: "long", src: "Replicate Magic Item" })); }
      Object.keys(ch.lvNotes || {}).filter(k => +k <= clv && ch.lvNotes[k]).sort((a, b) => a - b).forEach(k => features.push({ name: "Level " + k + " choices", text: ch.lvNotes[k], uses: 0, recharge: "", src: c.n + " " + k }));
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
      if (!it || !it.dmg || seen.has(i.ref + "|" + (i.magic || ""))) return;
      seen.add(i.ref + "|" + (i.magic || ""));
      const mg = magicOf(ch, i);
      const ranged = it.cats.includes("ranged-weapons");
      const finesse = it.props.includes("finesse");
      const monkW = martialArts && (it.cats.includes("simple-melee-weapons") || (it.cats.includes("martial-melee-weapons") && it.props.includes("light")));
      const am = ranged ? m.dex : (finesse || monkW ? Math.max(m.str, m.dex) : m.str);
      const prof = weaponProficient(ch, i.ref, t);
      const notes = [];
      let bonus = am + (prof ? pb : 0) + (ranged && ch.ch.fightingStyle === "archery" ? 2 : 0);
      let die = it.dmg;
      const mb = mg.ranged && !ranged ? 0 : mg.b;
      bonus += mb;
      if (mg.off) warn.push(it.n + ": you no longer know the " + mg.label + " plan.");
      if (mg.note) notes.push(mg.note);
      if (monkW && +die.split("d")[1] < martialArts) die = "1d" + martialArts;
      if (it.two) notes.push("Versatile " + it.two);
      if (it.props.includes("thrown") && it.thr && it.thr.normal) notes.push("Thrown " + it.thr.normal + "/" + it.thr.long + " ft");
      if (ch.ch.mastery.includes(i.ref) && it.mastery) notes.push("Mastery: " + ((SRD.mastery[it.mastery] || {}).n || it.mastery));
      const props = it.props.filter(p => !["versatile", "thrown", "ammunition", "monk"].concat(mg.noLoad && !mg.off ? ["loading"] : []).includes(p)).map(p => cap(p.replace(/-/g, " ")));
      if (props.length) notes.push(props.join(", "));
      if (!prof) notes.push("Not proficient");
      const range = ranged ? it.rng.normal + "/" + it.rng.long + " ft" : (it.props.includes("reach") ? "10 ft" : "5 ft");
      attacks.push({ name: it.n + (mg.label ? (mg.label.startsWith("+") ? " " + mg.label : " (" + mg.label + ")") : ""), bonus: sign(bonus), damage: die + (am + mb ? sign(am + mb) : "") + " " + it.dt.toLowerCase(), range, notes: notes.join("; ") });
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
    if (c && clv >= subLevel(c) && !(ch.classes[0] || {}).sub) warn.push("Choose a subclass.");
    if (c) asiLevels(c).filter(a => a.lv <= clv).forEach(a => {
      const x = (ch.asi || {})[a.lv] || {};
      const ok = x.mode === "asi" ? (x.a || []).filter(Boolean).length === 2 : x.mode === "feat" ? !!x.feat && (!featPlus(x.feat) || !!x.plus) : false;
      if (!ok) warn.push("Level " + a.lv + ": choose an Ability Score Improvement or a feat.");
    });
    if (c && ch.hp.method === "roll") for (let i = 2; i <= clv; i++) if (!ch.hp.rolls[i]) { warn.push("Level " + i + ": roll Hit Points (or the average is used)."); break; }
    if (c) {
      const n = counts(ch);
      if (ch.ch.mastery.length < n.mastery) warn.push("Choose " + (n.mastery - ch.ch.mastery.length) + " more Weapon Mastery weapon(s).");
      if (clsId(ch) === "warlock" && ch.ch.invocations.length < n.invocations) warn.push("Choose " + (n.invocations - ch.ch.invocations.length) + " more Eldritch Invocation(s).");
      if (ch.exp.length < n.expertise) warn.push("Choose " + (n.expertise - ch.exp.length) + " more Expertise skill(s).");
      if (n.fightingStyle && !ch.ch.fightingStyle) warn.push("Choose a Fighting Style.");
      const pl = plans(ch);
      if (pl) {
        if (pl.chosen.length < pl.known) warn.push("Choose " + (pl.known - pl.chosen.length) + " more magic item plan(s).");
        if (pl.chosen.length > pl.known) warn.push("Too many magic item plans: remove " + (pl.chosen.length - pl.known) + ".");
        if (pl.chosen.some(p => p.gen && !p.item)) warn.push("Name the item for each open magic item plan.");
        if (pl.chosen.some(p => tattooLevels(p) && !p.spell)) warn.push("Choose the spell in each Spellwrought Tattoo plan.");
        if (pl.chosen.some(p => pl && p.tier > clv)) warn.push("A magic item plan needs a higher Artificer level.");
      }
      if ((ch.ch.langs || []).filter(Boolean).length < n.langs) warn.push("Choose " + (n.langs - ch.ch.langs.filter(Boolean).length) + " more language(s).");
    }

    const sub = SRD.subclasses[(ch.classes[0] || {}).sub];
    return {
      name: fullName(ch), level: L, pb, scores: sc, mods: m, saves: c ? c.saves : [], skills: sk.prof, skillSrc: sk.src,
      skillBonus, hp, hd: L + "d" + hd, ac, acNote, speed, senses, passive, init, res: [...res], langs, training: t,
      features, attacks, spells, slots: lim ? lim.slots : [0, 0, 0, 0, 0, 0, 0, 0, 0], castAbil,
      dc: castAbil ? 8 + pb + m[castAbil] : 0, spellAtk: castAbil ? pb + m[castAbil] : 0,
      clsText: c ? c.n + " " + clv + (sub ? " (" + sub.n + ")" : (ch.classes[0] || {}).sub === "other" && ch.classes[0].subName ? " (" + ch.classes[0].subName + ")" : "") : "",
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
    const items = ch.items.map(i => ({ name: i.name + (i.magic ? (m => m.label.startsWith("+") ? " " + m.label : " (" + m.label + ")")(magicOf(ch, i)) : ""), qty: i.qty, equipped: !!i.equipped, cat: i.cat || "", notes: i.notes || "" }));
    if (ch.gp) items.push({ name: "Shins", qty: ch.gp, equipped: false, cat: "Money", notes: "" });
    return {
      kind: "pc", name: fullName(ch).slice(0, 60), owner: (ch.player || "").slice(0, 40), level: s.level, cr: "",
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
    blank, fullName, clvOf, asiLevels, subLevel, counts, plans, planName, magicOptions, magicOf, tattooLevels, migratePlans, levelFeats, featPlus, asiBonus, hasFightingStyle, BIO_SLOTS, bionics, rollBionics, cls, clsId, level, species, line, background, feat, feats, spell, item, itemName, levelRow,
    baseScores, pointsSpent, bgBonus, scores, training, weaponProficient, skillProfs, spellList, spellLimits,
    classSpells, startingGear, expandEquip, compute, toVTT
  };
})();
