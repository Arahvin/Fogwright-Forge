// Fogwright Forge: the builder screens.
(function () {
  "use strict";
  const VERSION = "v1";
  const R = window.Rules, SRD = window.SRD, X = window.EXTRA;
  const KEY = "forge-chars-v1", PREF = "forge-prefs-v1";

  // ---------------------------------------------------------------- storage (never required: the page works without it)

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  let chars = store.get(KEY, []);
  const prefs = Object.assign({ lang: "en", theme: "" }, store.get(PREF, {}));
  let cur = null, tab = "class", armed = "", search = {};
  const save = () => { if (cur) cur.updated = Date.now(); store.set(KEY, chars); };
  const savePrefs = () => store.set(PREF, prefs);

  // ---------------------------------------------------------------- helpers

  const T = s => (prefs.lang === "pt" && window.I18N.pt[s]) || s;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const attr = esc;
  const $ = s => document.querySelector(s);
  const AB = R.ABILS, AN = R.ABIL_NAMES, SN = R.SKILL_NAMES;

  function md(text) {
    const lines = String(text || "").split("\n");
    let html = "", list = false, table = [];
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/_(.+?)_/g, "<i>$1</i>");
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter(r => !/^\|[\s|:-]+\|$/.test(r.trim()));
      html += "<table>" + rows.map((r, i) => "<tr>" + r.trim().replace(/^\||\|$/g, "").split("|").map(c => (i ? "<td>" : "<th>") + inline(c.trim()) + (i ? "</td>" : "</th>")).join("") + "</tr>").join("") + "</table>";
      table = [];
    };
    lines.forEach(l => {
      if (/^\s*\|/.test(l)) { if (list) { html += "</ul>"; list = false; } table.push(l); return; }
      flushTable();
      const b = l.match(/^\s*[-*]\s+(.*)/);
      if (b) { if (!list) { html += "<ul>"; list = true; } html += "<li>" + inline(b[1]) + "</li>"; return; }
      if (list) { html += "</ul>"; list = false; }
      const h = l.match(/^#+\s+(.*)/);
      if (h) { html += "<p><b>" + inline(h[1]) + "</b></p>"; return; }
      if (l.trim()) html += "<p>" + inline(l) + "</p>";
    });
    flushTable();
    if (list) html += "</ul>";
    return '<div class="md">' + html + "</div>";
  }

  function getPath(o, p) { return p.split(".").reduce((a, k) => (a == null ? a : a[k]), o); }
  function setPath(o, p, v) {
    const ks = p.split("."), last = ks.pop();
    const t = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), o);
    t[last] = v;
  }
  function toast(msg) {
    const d = document.createElement("div");
    d.className = "toast"; d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const slug = s => (s || "character").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";

  // a group of chips: pick up to max values. path is an array in the character.
  function chips(path, options, max, opts) {
    opts = opts || {};
    const val = getPath(cur, path) || [];
    const full = val.length >= max;
    return '<div class="chips">' + options.map(o => {
      const [v, label, lock] = Array.isArray(o) ? o : [o, o, false];
      const on = val.includes(v);
      if (lock) return '<span class="chip lock on" title="' + attr(lock) + '">' + esc(label) + "</span>";
      return '<button class="chip' + (on ? " on" : "") + '" data-multi="' + attr(path) + '" data-v="' + attr(v) + '" data-max="' + max + '"' +
        (!on && full && max > 1 ? " disabled" : "") + ">" + esc(label) + "</button>";
    }).join("") + "</div>";
  }
  // one choice out of many
  function pick(path, options, opts) {
    opts = opts || {};
    const val = getPath(cur, path);
    return '<div class="chips">' + options.map(o => {
      const [v, label] = Array.isArray(o) ? o : [o, o];
      return '<button class="chip' + (val === v ? " on" : "") + '" data-one="' + attr(path) + '" data-v="' + attr(v) + '"' + (opts.reset ? ' data-reset="' + attr(opts.reset) + '"' : "") + ">" + esc(label) + "</button>";
    }).join("") + "</div>";
  }
  function select(path, options, placeholder) {
    const val = getPath(cur, path) || "";
    return '<select data-set="' + attr(path) + '"><option value="">' + esc(placeholder || "—") + "</option>" +
      options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + attr(v) + '"' + (v === val ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select>";
  }
  const status = (have, need) => have >= need ? '<span class="done">✓ ' + T("Done") + "</span>" : '<span class="need">' + (need - have) + " " + T("to choose") + "</span>";
  const catItems = cat => ((SRD.cats[cat] || {}).items || []).map(id => [id, R.itemName(id)]);

  // ---------------------------------------------------------------- what each step still needs

  function stepNeeds(ch) {
    const c = R.cls(ch), id = R.clsId(ch), s = R.species(ch), bg = R.background(ch), n = {};
    const missing = [];
    // class
    if (!c) missing.push("class");
    else {
      if (c.skills && ch.skills.length < c.skills.n) missing.push("class");
      if (id === "fighter" && !ch.ch.fightingStyle) missing.push("class");
      if (id === "cleric" && !ch.ch.divineOrder) missing.push("class");
      if (id === "druid" && !ch.ch.primalOrder) missing.push("class");
      const wm = (R.levelRow(c, 1).cs || {}).weapon_mastery || 0;
      if (wm && ch.ch.mastery.length < wm) missing.push("class");
      if (id === "rogue" && ch.exp.length < 2) missing.push("class");
      if (id === "warlock" && ch.ch.invocations.length < 1) missing.push("class");
      if (id === "bard" && ch.ch.instruments.length < 3) missing.push("class");
      if (id === "monk" && !ch.ch.monkTool) missing.push("class");
    }
    // background
    if (!bg) missing.push("background");
    else {
      if (ch.bg.mode === "111" ? ch.bg.p111.length < 3 : !(ch.bg.p2 && ch.bg.p1 && ch.bg.p2 !== ch.bg.p1)) missing.push("background");
      if (bg.tool.startsWith("@") && !ch.bg.tool) missing.push("background");
      if (!featDone(bg.feat, ch.bg.featData, bg.featCls)) missing.push("background");
    }
    // species
    if (!s) missing.push("species");
    else {
      if (s.lines && !ch.sp.line) missing.push("species");
      if (s.size.length > 1 && !ch.sp.size) missing.push("species");
      if (s.spellAbil && !ch.sp.abil) missing.push("species");
      if (s.skill === "any" && !ch.sp.skill) missing.push("species");
      if (s.keen && !ch.sp.keen) missing.push("species");
      if (s.originFeat && (!ch.sp.feat || !featDone(ch.sp.feat, ch.sp.featData))) missing.push("species");
    }
    // abilities
    const a = ch.ab;
    if (a.method === "array" && AB.some(k => a.assign[k] === undefined || a.assign[k] === "")) missing.push("abilities");
    if (a.method === "roll" && (a.rolled.length < 6 || AB.some(k => a.assign[k] === undefined || a.assign[k] === ""))) missing.push("abilities");
    if (a.method === "point" && R.pointsSpent(ch) > 27) missing.push("abilities");
    // equipment
    if (!ch.items.length && !ch.gp) missing.push("equipment");
    // spells
    const lim = R.spellLimits(ch);
    if (lim && (ch.spells.cantrips.length < lim.cantrips || ch.spells.prepared.length < lim.prepared)) missing.push("spells");
    // details
    if (!ch.name || ch.ch.langs.filter(Boolean).length < 2) missing.push("details");
    ["class", "background", "species", "abilities", "equipment", "spells", "details"].forEach(k => { n[k] = !missing.includes(k); });
    return n;
  }
  function featDone(id, data, fixedCls) {
    data = data || {};
    if (id === "skilled") return (data.picks || []).length >= 3;
    if (id === "magic-initiate") return !!((data.cls || fixedCls) && data.abil && (data.cantrips || []).length >= 2 && data.spell);
    if (id === "crafter" || id === "musician") return (data.tools || []).length >= 3;
    return true;
  }

  // ---------------------------------------------------------------- feat choices (background, species)

  function featChoices(id, base, fixedCls) {
    const f = R.feat(id);
    if (!f) return "";
    const data = getPath(cur, base) || {};
    let h = "<details><summary>" + esc(f.n) + (f.src === "PHB" ? ' <span class="badge">PHB</span>' : "") + "</summary>" + md(f.t) + "</details>";
    if (id === "skilled") {
      const opts = Object.keys(R.SKILLS).map(k => [k, SN[k]]);
      const tools = [...catItems("artisans-tools"), ...catItems("musical-instruments"), ...catItems("gaming-sets"), ...catItems("other-tools")];
      h += '<p class="small muted">' + T("Choose") + " 3 (" + T("Skills") + " " + T("or") + " tools) " + status((data.picks || []).length, 3) + "</p>" +
        chips(base + ".picks", opts, 3) + '<details><summary class="small">Tools</summary>' + chips(base + ".picks", tools, 3) + "</details>";
    }
    if (id === "crafter") h += '<p class="small muted">' + T("Choose") + " 3 " + status((data.tools || []).length, 3) + "</p>" + chips(base + ".tools", catItems("artisans-tools"), 3);
    if (id === "musician") h += '<p class="small muted">' + T("Choose") + " 3 " + status((data.tools || []).length, 3) + "</p>" + chips(base + ".tools", catItems("musical-instruments"), 3);
    if (id === "magic-initiate") {
      const list = fixedCls || data.cls;
      h += '<div class="form" style="margin-top:8px">';
      if (!fixedCls) h += "<span>" + T("List") + "</span><div>" + pick(base + ".cls", [["cleric", "Cleric"], ["druid", "Druid"], ["wizard", "Wizard"]], { reset: base + ".cantrips," + base + ".spell" }) + "</div>";
      else h += "<span>" + T("List") + "</span><div><b>" + R.cap(fixedCls) + "</b></div>";
      h += "<span>" + T("Spellcasting ability") + "</span><div>" + pick(base + ".abil", [["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]]) + "</div></div>";
      if (list) {
        h += '<p class="small muted">' + T("Cantrips") + ": " + T("Choose") + " 2 " + status((data.cantrips || []).length, 2) + "</p>" + spellChips(base + ".cantrips", R.classSpells(list, 0), 2);
        h += '<p class="small muted">' + T("Level 1 spell") + " " + status(data.spell ? 1 : 0, 1) + "</p>" + spellPick(base + ".spell", R.classSpells(list, 1));
      }
    }
    return h;
  }

  function spellCard(id, on, control) {
    const s = R.spell(id);
    if (!s) return "";
    const tag = [s.lv ? "Level " + s.lv : "Cantrip", s.sch, s.conc ? "Concentration" : "", s.rit ? "Ritual" : ""].filter(Boolean).join(" · ");
    return '<div class="sp' + (on ? " on" : "") + '"><label>' + control + esc(s.n) + '</label><div class="s">' + esc(tag) + "</div>" +
      "<details><summary>" + esc(s.ct + " · " + s.r + " · " + s.d) + "</summary>" + md(s.t + (s.hi ? "\n\n**Higher levels.** " + s.hi : "")) + '<p class="s">' + esc(s.c) + "</p></details></div>";
  }
  function spellChips(path, ids, max) {
    const val = getPath(cur, path) || [];
    const full = val.length >= max;
    return '<div class="splist">' + ids.map(id => {
      const on = val.includes(id);
      return spellCard(id, on, '<input type="checkbox" data-multi="' + attr(path) + '" data-v="' + attr(id) + '" data-max="' + max + '"' + (on ? " checked" : "") + (!on && full ? " disabled" : "") + ">");
    }).join("") + "</div>";
  }
  function spellPick(path, ids) {
    const val = getPath(cur, path) || "";
    return '<div class="splist">' + ids.map(id => spellCard(id, val === id, '<input type="radio" name="' + attr(path) + '" data-one="' + attr(path) + '" data-v="' + attr(id) + '"' + (val === id ? " checked" : "") + ">")).join("") + "</div>";
  }

  // ---------------------------------------------------------------- steps

  function stepClass() {
    const ch = cur, id = R.clsId(ch), c = R.cls(ch);
    let h = '<div class="panel"><h2>' + T("Class") + '</h2><div class="cards">' + Object.keys(SRD.classes).map(k => {
      const x = SRD.classes[k];
      return '<button class="card' + (k === id ? " on" : "") + '" data-act="setClass" data-v="' + k + '"><div class="t">' + esc(x.n) + ' <span class="badge acc">' + esc(X.labels[k] || "") + '</span></div><div class="s">' +
        T("Hit Die") + " d" + x.hd + " · " + T("Saves") + " " + x.saves.map(s => s.toUpperCase()).join(", ") + (x.cast ? " · " + T("Spells") + " (" + x.cast.toUpperCase() + ")" : "") + "</div></button>";
    }).join("") + "</div></div>";
    if (!c) return h;
    const row = R.levelRow(c, 1), bg = R.background(ch);
    h += '<div class="panel"><h2>' + esc(c.n) + ' <span class="badge acc">' + esc(T("Ninth World")) + ": " + esc(X.labels[id] || "") + "</span></h2>";
    h += "<h3>" + T("Level 1 features") + "</h3>" + row.f.map(fid => { const f = SRD.features[fid]; return f ? "<details><summary>" + esc(f.n) + "</summary>" + md(f.t) + "</details>" : ""; }).join("");
    if (c.skills) {
      const bgSk = bg ? bg.skills : [];
      const opts = c.skills.from.map(k => bgSk.includes(k) ? [k, SN[k] + " (" + T("Background") + ")", T("Background")] : [k, SN[k]]);
      h += '<div class="choice"><h4>' + T("Skills") + " " + status(ch.skills.length, c.skills.n) + '</h4><p class="small muted">' + T("Choose") + " " + c.skills.n + "</p>" + chips("skills", opts, c.skills.n) + "</div>";
    }
    if (id === "fighter") {
      h += '<div class="choice"><h4>' + T("Fighting Style") + " " + status(ch.ch.fightingStyle ? 1 : 0, 1) + "</h4>" +
        pick("ch.fightingStyle", Object.keys(SRD.feats).filter(k => SRD.feats[k].type === "fighting-style").map(k => [k, SRD.feats[k].n])) +
        (ch.ch.fightingStyle ? md(SRD.feats[ch.ch.fightingStyle].t) : "") + "</div>";
    }
    if (id === "cleric") h += '<div class="choice"><h4>' + T("Divine Order") + " " + status(ch.ch.divineOrder ? 1 : 0, 1) + "</h4>" + pick("ch.divineOrder", Object.keys(X.divineOrder).map(k => [k, X.divineOrder[k].n]), { reset: "spells.cantrips" }) + (ch.ch.divineOrder ? '<p class="small">' + esc(X.divineOrder[ch.ch.divineOrder].t) + "</p>" : "") + "</div>";
    if (id === "druid") h += '<div class="choice"><h4>' + T("Primal Order") + " " + status(ch.ch.primalOrder ? 1 : 0, 1) + "</h4>" + pick("ch.primalOrder", Object.keys(X.primalOrder).map(k => [k, X.primalOrder[k].n]), { reset: "spells.cantrips" }) + (ch.ch.primalOrder ? '<p class="small">' + esc(X.primalOrder[ch.ch.primalOrder].t) + "</p>" : "") + "</div>";
    const wm = row.cs.weapon_mastery || 0;
    if (wm) {
      const t = R.training(ch), mode = X.masteryFrom[id];
      const ws = Object.keys(SRD.equipment).filter(k => {
        const it = SRD.equipment[k];
        if (!it.dmg || !it.mastery) return false;
        if (mode === "melee" && !it.cats.includes("melee-weapons")) return false;
        if (mode === "proficient-finesse-light" && !(it.props.includes("finesse") || it.props.includes("light"))) return false;
        return R.weaponProficient(ch, k, t);
      }).sort((a, b) => SRD.equipment[a].n.localeCompare(SRD.equipment[b].n));
      h += '<div class="choice"><h4>' + T("Weapon Mastery") + " " + status(ch.ch.mastery.length, wm) + '</h4><p class="small muted">' + T("Choose") + " " + wm + "</p>" +
        chips("ch.mastery", ws.map(k => [k, SRD.equipment[k].n + " · " + ((SRD.mastery[SRD.equipment[k].mastery] || {}).n || "")]), wm) + "</div>";
    }
    if (id === "rogue") {
      const sk = Object.keys(R.skillProfs(ch).prof);
      h += '<div class="choice"><h4>' + T("Expertise") + " " + status(ch.exp.length, 2) + '</h4><p class="small muted">' + T("Choose") + " 2 (" + T("Skills") + ")</p>" +
        (sk.length ? chips("exp", sk.map(k => [k, SN[k]]), 2) : '<p class="small muted">—</p>') + "</div>";
    }
    if (id === "warlock") {
      const inv = Object.keys(SRD.invocations).filter(k => SRD.invocations[k].lv <= 1 && !/Invocation|Pact of the/.test(SRD.invocations[k].pre));
      h += '<div class="choice"><h4>' + T("Eldritch Invocation") + " " + status(ch.ch.invocations.length, 1) + "</h4>" + chips("ch.invocations", inv.map(k => [k, SRD.invocations[k].n]), 1) +
        ch.ch.invocations.map(k => md(SRD.invocations[k].t)).join("") + "</div>";
    }
    if (id === "bard") h += '<div class="choice"><h4>' + T("Musical instruments") + " " + status(ch.ch.instruments.length, 3) + "</h4>" + chips("ch.instruments", catItems("musical-instruments"), 3) + "</div>";
    if (id === "monk") h += '<div class="choice"><h4>' + T("Tool or instrument") + " " + status(ch.ch.monkTool ? 1 : 0, 1) + "</h4>" + select("ch.monkTool", [...catItems("artisans-tools"), ...catItems("musical-instruments")]) + "</div>";
    return h + "</div>";
  }

  function stepBackground() {
    const ch = cur, bg = R.background(ch);
    let h = '<div class="panel"><h2>' + T("Background") + '</h2><div class="cards">' + Object.keys(X.backgrounds).map(k => {
      const b = X.backgrounds[k], f = R.feat(b.feat);
      return '<button class="card' + (k === ch.bg.id ? " on" : "") + '" data-act="setBg" data-v="' + k + '"><div class="t">' + esc(b.n) + ' <span class="badge">' + b.src + '</span></div><div class="s">' +
        b.abil.map(a => a.toUpperCase()).join(", ") + " · " + esc(f ? f.n : b.feat) + (b.featCls ? " (" + R.cap(b.featCls) + ")" : "") + "<br>" + b.skills.map(s => SN[s]).join(", ") + "</div></button>";
    }).join("") + "</div></div>";
    if (!bg) return h;
    h += '<div class="panel"><h2>' + esc(bg.n) + "</h2>";
    if (bg.src === "PHB") h += '<p class="small muted">Player\'s Handbook background: the numbers are here, the full text is in your book.</p>';
    h += '<p><b>' + T("Skills") + ":</b> " + bg.skills.map(s => SN[s]).join(", ") + " · <b>" + T("Tool") + ":</b> " + esc(bg.tool.startsWith("@") ? "(" + T("Choose") + ")" : bg.tool) + "</p>";
    const done = ch.bg.mode === "111" ? ch.bg.p111.length >= 3 : !!(ch.bg.p2 && ch.bg.p1 && ch.bg.p1 !== ch.bg.p2);
    h += '<div class="choice"><h4>' + T("Ability scores") + " " + status(done ? 1 : 0, 1) + "</h4>" + pick("bg.mode", [["21", T("+2 and +1")], ["111", T("+1 to all three")]]);
    if (ch.bg.mode === "111") h += '<p class="small">+1: ' + bg.abil.map(a => AN[a]).join(", ") + "</p>";
    else h += '<div class="form" style="margin-top:8px"><span>+2</span><div>' + pick("bg.p2", bg.abil.map(a => [a, AN[a]])) + "</div><span>+1</span><div>" + pick("bg.p1", bg.abil.filter(a => a !== ch.bg.p2).map(a => [a, AN[a]])) + "</div></div>";
    h += "</div>";
    if (bg.tool.startsWith("@")) {
      const cat = { "@gaming": "gaming-sets", "@artisan": "artisans-tools", "@instrument": "musical-instruments" }[bg.tool];
      h += '<div class="choice"><h4>' + T("Tool") + " " + status(ch.bg.tool ? 1 : 0, 1) + "</h4>" + select("bg.tool", catItems(cat)) + "</div>";
    }
    h += '<div class="choice"><h4>' + T("Origin feat") + " " + status(featDone(bg.feat, ch.bg.featData, bg.featCls) ? 1 : 0, 1) + "</h4>" + featChoices(bg.feat, "bg.featData", bg.featCls) + "</div>";
    return h + "</div>";
  }

  function stepSpecies() {
    const ch = cur, s = R.species(ch);
    let h = '<div class="panel"><h2>' + T("Species") + '</h2><p class="small muted">Ninth World species, with the 2024 rules unchanged. Species give no ability score increases (those come from the background).</p><div class="cards">' +
      Object.values(R.SPECIES).map(x => '<button class="card' + (x.id === ch.sp.id ? " on" : "") + '" data-act="setSpecies" data-v="' + x.id + '"><div class="t">' + esc(x.n) + ' <span class="badge">' + esc(x.rules) + '</span></div><div class="s">' +
        x.size.join(" / ") + " · " + x.speed + " ft" + (x.dv ? " · Darkvision " + x.dv : "") + "</div></button>").join("") + "</div></div>";
    if (!s) return h;
    h += '<div class="panel"><h2>' + esc(s.n) + ' <span class="badge">' + esc(s.rules) + "</span></h2>" + md(s.lore);
    if (s.size.length > 1) h += '<div class="choice"><h4>' + T("Size") + " " + status(ch.sp.size ? 1 : 0, 1) + "</h4>" + pick("sp.size", s.size) + "</div>";
    if (s.lines) h += '<div class="choice"><h4>' + esc(s.lineLabel) + " " + status(ch.sp.line ? 1 : 0, 1) + "</h4>" + pick("sp.line", Object.keys(s.lines).map(k => [k, s.lines[k].n])) + "</div>";
    if (s.spellAbil) h += '<div class="choice"><h4>' + T("Spellcasting ability") + " " + status(ch.sp.abil ? 1 : 0, 1) + "</h4>" + pick("sp.abil", [["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]]) + "</div>";
    if (s.keen) h += '<div class="choice"><h4>Keen Senses ' + status(ch.sp.keen ? 1 : 0, 1) + "</h4>" + pick("sp.keen", s.keen.map(k => [k, SN[k]])) + "</div>";
    if (s.skill === "any") h += '<div class="choice"><h4>Skillful ' + status(ch.sp.skill ? 1 : 0, 1) + "</h4>" + select("sp.skill", Object.keys(R.SKILLS).map(k => [k, SN[k]])) + "</div>";
    if (s.originFeat) {
      const origin = [...Object.keys(SRD.feats).filter(k => SRD.feats[k].type === "origin"), ...Object.keys(X.feats)].map(k => [k, R.feat(k).n]);
      h += '<div class="choice"><h4>Versatile: ' + T("Origin feat") + " " + status(ch.sp.feat && featDone(ch.sp.feat, ch.sp.featData) ? 1 : 0, 1) + "</h4>" + pick("sp.feat", origin, { reset: "sp.featData" }) +
        (ch.sp.feat ? featChoices(ch.sp.feat, "sp.featData") : "") + "</div>";
    }
    h += '<div class="choice"><h4>' + T("Traits") + "</h4>" + s.traits.map(t => "<details" + (t.n.length ? "" : "") + "><summary>" + esc(t.n) + "</summary>" + md(t.t) + "</details>").join("") + "</div>";
    return h + "</div>";
  }

  function stepAbilities() {
    const ch = cur, a = ch.ab, c = R.cls(ch);
    const base = R.baseScores(ch), bon = R.bgBonus(ch), fin = R.scores(ch);
    let h = '<div class="panel"><h2>' + T("Abilities") + "</h2>" + pick("ab.method", [["array", T("Standard array")], ["point", T("Point buy")], ["roll", T("Roll")], ["manual", T("Manual")]]);
    if (c) h += '<p class="small muted">' + T("Recommended") + ": " + esc(SRD.classes[R.clsId(ch)].n) + " → " + (c.cast ? AN[c.cast] : ({ barbarian: "Strength", fighter: "Strength or Dexterity", monk: "Dexterity and Wisdom", rogue: "Dexterity" })[R.clsId(ch)] || "") + ".</p>";
    if (a.method === "point") h += '<p><b>' + T("Points left") + ": " + (27 - R.pointsSpent(ch)) + "</b> / 27</p>";
    if (a.method === "roll") {
      h += '<div class="row" style="margin:8px 0"><button data-act="roll4d6">' + T("Roll 4d6 (drop lowest)") + '</button><span class="muted small">' + T("or") + ' type them:</span>' +
        [0, 1, 2, 3, 4, 5].map(i => '<input type="number" min="3" max="18" style="width:64px" data-roll="' + i + '" value="' + attr(a.rolled[i] ?? "") + '">').join("") + "</div>";
    }
    const pool = a.method === "array" ? R.STANDARD : a.method === "roll" ? a.rolled : null;
    h += '<div class="tablewrap"><table class="grid"><tr><th></th><th>' + T("Base") + "</th><th>" + T("Background") + "</th><th>" + T("Score") + "</th><th>" + T("Modifier") + "</th></tr>";
    AB.forEach(k => {
      let ctl;
      if (pool) {
        const used = AB.filter(o => o !== k).map(o => a.assign[o]).filter(v => v !== undefined && v !== "");
        ctl = '<select data-assign="' + k + '"><option value="">—</option>' + pool.map((v, i) => used.includes(i) && a.assign[k] !== i ? "" : '<option value="' + i + '"' + (a.assign[k] === i ? " selected" : "") + ">" + v + "</option>").join("") + "</select>";
      } else if (a.method === "point") {
        ctl = '<div class="row"><button class="small" data-act="pb-" data-v="' + k + '"' + (a.base[k] <= 8 ? " disabled" : "") + '>−</button><b style="min-width:22px;text-align:center">' + a.base[k] + '</b><button class="small" data-act="pb+" data-v="' + k + '"' + (a.base[k] >= 15 ? " disabled" : "") + ">+</button></div>";
      } else ctl = '<input type="number" min="1" max="20" style="width:70px" data-set="ab.base.' + k + '" data-num="1" value="' + a.base[k] + '">';
      h += "<tr><td><b>" + AN[k] + "</b></td><td>" + ctl + "</td><td>" + (bon[k] ? "+" + bon[k] : "") + "</td><td><b>" + fin[k] + "</b></td><td>" + R.sign(R.mod(fin[k])) + "</td></tr>";
    });
    h += "</table></div>";
    if (!R.background(ch)) h += '<p class="small muted">Choose a background to add its +2/+1.</p>';
    return h + "</div>";
  }

  function stepEquipment() {
    const ch = cur, id = R.clsId(ch), bg = R.background(ch);
    let h = '<div class="panel"><h2>' + T("Starting gear") + "</h2>";
    const ce = X.classEquip[id];
    const show = list => list.map(e => { let [r, q, n] = Array.isArray(e) ? e : [e, 1, ""]; if (r === "gp") return q + " " + T("gold"); return (q > 1 ? q + " × " : "") + (r.startsWith("@") ? "(" + r.slice(1) + ")" : R.itemName(r)) + (n ? " (" + n + ")" : ""); }).join(", ");
    if (ce) h += "<h4>" + T("Class") + ": " + esc(SRD.classes[id].n) + "</h4>" + pick("equip.cls", ce.map((l, i) => ["abc"[i], "abc"[i].toUpperCase() + ") " + show(l)]));
    else h += '<p class="muted">' + T("Choose") + " " + T("Class").toLowerCase() + ".</p>";
    if (bg) h += "<h4 style=\"margin-top:10px\">" + T("Background") + ": " + esc(bg.n) + "</h4>" + pick("equip.bg", [["a", "A) " + show(bg.equip)], ["b", "B) 50 " + T("gold")]]);
    const needs = new Set();
    const scan = l => (l || []).forEach(e => { const r = Array.isArray(e) ? e[0] : e; if (r.startsWith("@") && !["@bgTool", "@monkTool"].includes(r)) needs.add(r); });
    if (ce && ch.equip.cls) scan(ce["abc".indexOf(ch.equip.cls)]);
    if (bg && ch.equip.bg === "a") scan(bg.equip);
    const catOf = { "@instrument": "musical-instruments", "@holy": "holy-symbols", "@gaming": "gaming-sets", "@artisan": "artisans-tools" };
    if (needs.size) h += '<div class="form" style="margin-top:10px">' + [...needs].map(n => "<span>" + esc(n.slice(1)) + "</span><div>" + select("equip.picks." + n, catItems(catOf[n])) + "</div>").join("") + "</div>";
    h += '<div class="row" style="margin-top:12px"><button class="primary" data-act="applyGear"' + (ch.equip.cls || ch.equip.bg ? "" : " disabled") + ">" +
      (armed === "applyGear" ? T("Click again to replace the inventory") : T("Apply starting gear")) + "</button></div></div>";

    h += '<div class="panel"><h2>' + T("Inventory") + '</h2><div class="row" style="margin-bottom:8px"><label>' + T("Shins") + ' <input type="number" min="0" style="width:100px" data-set="gp" data-num="1" value="' + (ch.gp || 0) + '"></label></div>';
    h += '<div class="tablewrap"><table class="grid"><tr><th>' + T("Name") + "</th><th>" + T("Qty") + "</th><th>" + T("Worn") + "</th><th>" + T("Notes") + "</th><th></th></tr>" +
      ch.items.map((it, i) => "<tr><td>" + esc(it.name) + ' <span class="badge">' + esc(it.cat || "") + '</span></td><td><input type="number" min="0" style="width:64px" data-set="items.' + i + '.qty" data-num="1" value="' + it.qty + '"></td>' +
        '<td><input type="checkbox" data-check="items.' + i + '.equipped"' + (it.equipped ? " checked" : "") + '></td><td><input style="width:100%" data-set="items.' + i + '.notes" value="' + attr(it.notes || "") + '"></td>' +
        '<td><button class="small danger" data-act="delItem" data-v="' + i + '">' + T("Remove") + "</button></td></tr>").join("") + "</table></div>";
    const groups = {};
    Object.keys(SRD.equipment).forEach(k => { const it = SRD.equipment[k]; const g = it.dmg ? "Weapons" : it.ac !== undefined ? "Armor" : (it.cats || []).includes("tools") ? "Tools" : "Gear"; (groups[g] = groups[g] || []).push(k); });
    h += '<div class="row" style="margin-top:10px"><select id="addItem"><option value="">' + T("Add item") + "…</option>" +
      Object.keys(groups).map(g => '<optgroup label="' + g + '">' + groups[g].sort((a, b) => SRD.equipment[a].n.localeCompare(SRD.equipment[b].n)).map(k => '<option value="' + k + '">' + esc(SRD.equipment[k].n) + " (" + esc(SRD.equipment[k].cost) + ")</option>").join("") + "</optgroup>").join("") +
      '</select><button data-act="addItem">' + T("Add item") + '</button><input id="customItem" placeholder="' + attr(T("Custom item")) + '"><button data-act="addCustom">+</button></div>';
    return h + "</div>";
  }

  function stepSpells() {
    const ch = cur, c = R.cls(ch), lim = R.spellLimits(ch), s = R.compute(ch);
    let h = '<div class="panel"><h2>' + T("Spells") + "</h2>";
    if (lim) {
      const id = R.clsId(ch);
      h += '<p><b>' + T("Spellcasting ability") + ":</b> " + AN[c.cast] + " · <b>" + T("Spell save DC") + ":</b> " + s.dc + " · <b>" + T("Spell attack") + ":</b> " + R.sign(s.spellAtk) + "</p>";
      if (lim.cantrips) h += '<div class="choice"><h4>' + T("Cantrips") + " " + status(ch.spells.cantrips.length, lim.cantrips) + '</h4><p class="small muted">' + T("Choose") + " " + lim.cantrips + "</p>" + spellChips("spells.cantrips", R.classSpells(id, 0), lim.cantrips) + "</div>";
      const lv = []; for (let i = 1; i <= lim.maxLv; i++) lv.push(...R.classSpells(id, i));
      h += '<div class="choice"><h4>' + T("Prepared spells") + " " + status(ch.spells.prepared.length, lim.prepared) + '</h4><p class="small muted">' + T("Choose") + " " + lim.prepared + "</p>" + spellChips("spells.prepared", lv, lim.prepared) + "</div>";
    } else h += '<p class="muted">' + (c ? esc(c.n) + " has no spellcasting at level 1." : T("Choose") + " " + T("Class").toLowerCase() + ".") + "</p>";
    const other = s.spells.filter(x => x.why !== (c && c.n) && x.why !== "Other");
    if (other.length) h += '<div class="choice"><h4>From species and feats</h4><div class="splist">' + other.map(x => spellCard(x.id, true, "")).join("") + "</div></div>";
    h += '<div class="choice"><h4>' + T("Other spells") + '</h4><p class="small muted">For anything else the GM allows (Pact of the Tome, an artifact...).</p>' +
      ch.spells.extra.map((e, i) => '<div class="row"><b>' + esc((R.spell(e.id) || {}).n || e.id) + '</b><input style="flex:1" data-set="spells.extra.' + i + '.note" value="' + attr(e.note || "") + '" placeholder="' + attr(T("Notes")) + '"><button class="small danger" data-act="delSpell" data-v="' + i + '">' + T("Remove") + "</button></div>").join("") +
      '<div class="row" style="margin-top:8px"><select id="addSpell"><option value="">' + T("Add a spell") + "…</option>" +
      Object.keys(SRD.spells).sort((a, b) => SRD.spells[a].lv - SRD.spells[b].lv || SRD.spells[a].n.localeCompare(SRD.spells[b].n)).map(k => '<option value="' + k + '">' + (SRD.spells[k].lv || "C") + " · " + esc(SRD.spells[k].n) + "</option>").join("") +
      '</select><button data-act="addSpell">+</button></div></div>';
    return h + "</div>";
  }

  function stepDetails() {
    const ch = cur, L = X.languages;
    const langs = [...L.standard, ...L.rare.filter(x => !["Druidic", "Thieves' Cant"].includes(x))];
    let h = '<div class="panel"><h2>' + T("Details") + '</h2><div class="form">' +
      "<span>" + T("Character name") + '</span><input data-set="name" value="' + attr(ch.name) + '">' +
      "<span>" + T("Player (VTT name)") + '</span><div><input data-set="player" value="' + attr(ch.player) + '"><div class="small muted">The name the player logs in with in Fogwright VTT, so the sheet is theirs.</div></div>' +
      "</div>";
    h += '<div class="choice"><h4>' + T("Languages") + " " + status(ch.ch.langs.filter(Boolean).length, 2) + '</h4><p class="small muted">' + esc(L.common) + " + 2. " + T("Choose") + " 2.</p>" + chips("ch.langs", langs, 2) + "</div>";
    ["appearance", "personality", "backstory", "notes"].forEach(k => {
      h += '<div class="choice"><h4>' + T(R.cap(k)) + '</h4><textarea data-set="det.' + k + '">' + esc(ch.det[k] || "") + "</textarea></div>";
    });
    return h + "</div>";
  }

  function stepSheet() {
    const ch = cur, s = R.compute(ch);
    let h = '<div class="panel"><div class="row"><div><h2 style="margin:0">' + esc(s.name) + '</h2><div class="muted">' +
      esc([s.clsText, s.speciesText, s.bgText, s.size].filter(Boolean).join(" · ")) + (s.label ? ' <span class="badge acc">' + esc(s.label) + "</span>" : "") + "</div></div>" +
      '<div class="spacer"></div><div class="row noprint"><button class="primary" data-act="exportVTT">' + T("Export for Fogwright VTT") + '</button><button data-act="saveFile">' + T("Save Forge file") + '</button><button data-act="print">' + T("Print") + "</button></div></div>";
    h += '<details class="noprint"><summary class="small">' + T("How to bring it into the VTT") + '</summary><p class="small">' +
      esc(prefs.lang === "pt" ? T("vttHelp") : "In Fogwright VTT, the GM opens the Sheets tab, presses Import and picks this .json file. The sheet arrives as it is here, owned by the player named in \"Player\".") + "</p></details>";
    if (s.warn.length) h += '<div style="margin-top:8px">' + s.warn.map(w => '<div class="warn">' + esc(w) + "</div>").join("") + "</div>";
    h += "</div>";
    h += '<div class="panel"><div class="abil">' + AB.map(k => '<div class="abox"><div class="k">' + AN[k] + '</div><div class="v">' + s.scores[k] + '</div><div class="m">' + R.sign(s.mods[k]) + "</div></div>").join("") + "</div>";
    h += '<div class="stats" style="margin-top:10px">' + [[T("Armor Class"), s.ac], [T("Hit Points"), s.hp], [T("Speed"), s.speed + " ft"], [T("Initiative"), R.sign(s.init)], [T("Proficiency"), "+" + s.pb], ["Hit Dice", s.hd], ["Passive Perc.", s.passive]]
      .map(([k, v]) => '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + "</div></div>").join("") + '</div><p class="small muted">AC: ' + esc(s.acNote) + " · " + esc(s.senses) + (s.res.length ? " · Resistance: " + esc(s.res.join(", ")) : "") + "</p></div>";
    h += '<div class="panel"><div class="layout" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div><h3>' + T("Saves") + '</h3><table class="grid">' + AB.map(k => "<tr><td>" + (s.saves.includes(k) ? "●" : "○") + " " + AN[k] + "</td><td>" + R.sign(s.mods[k] + (s.saves.includes(k) ? s.pb : 0)) + "</td></tr>").join("") + "</table></div>" +
      "<div><h3>" + T("Skills") + '</h3><table class="grid">' + Object.keys(R.SKILLS).map(k => "<tr><td>" + (s.skills[k] === 2 ? "◆" : s.skills[k] ? "●" : "○") + " " + SN[k] + ' <span class="muted small">' + R.SKILLS[k].toUpperCase() + "</span></td><td>" + R.sign(s.skillBonus(k)) + "</td></tr>").join("") + "</table></div></div></div>";
    h += '<div class="panel"><h3>' + T("Attacks") + '</h3><div class="tablewrap"><table class="grid"><tr><th>' + T("Name") + "</th><th>" + T("Bonus") + "</th><th>Damage</th><th>Range</th><th>" + T("Notes") + "</th></tr>" +
      s.attacks.map(a => "<tr><td>" + esc(a.name) + "</td><td>" + esc(a.bonus) + "</td><td>" + esc(a.damage) + "</td><td>" + esc(a.range) + '</td><td class="small">' + esc(a.notes) + "</td></tr>").join("") + "</table></div></div>";
    if (s.spells.length) {
      h += '<div class="panel"><h3>' + T("Spells") + "</h3>" + (s.castAbil ? "<p>" + T("Spell save DC") + " <b>" + s.dc + "</b> · " + T("Spell attack") + " <b>" + R.sign(s.spellAtk) + "</b> · Slots: " + s.slots.map((n, i) => n ? "L" + (i + 1) + "×" + n : "").filter(Boolean).join(", ") + "</p>" : "") +
        '<table class="grid"><tr><th>' + T("Level") + "</th><th>" + T("Name") + "</th><th>" + T("Notes") + "</th></tr>" + s.spells.sort((a, b) => a.lv - b.lv).map(x => "<tr><td>" + (x.lv || "C") + "</td><td>" + esc(x.n) + ((R.spell(x.id) || {}).conc ? " (C)" : "") + '</td><td class="small">' + esc(x.notes || x.why) + "</td></tr>").join("") + "</table></div>";
    }
    h += '<div class="panel"><h3>' + T("Features") + "</h3>" + s.features.map(f => "<details><summary>" + esc(f.name) + (f.uses ? ' <span class="badge acc">' + f.uses + "/" + (f.recharge === "short" ? "short rest" : "long rest") + "</span>" : "") + (f.src ? ' <span class="badge">' + esc(f.src) + "</span>" : "") + "</summary>" + md(f.text) + "</details>").join("") + "</div>";
    h += '<div class="panel"><h3>' + T("Inventory") + "</h3><ul>" + ch.items.map(i => "<li>" + (i.qty > 1 ? i.qty + " × " : "") + esc(i.name) + (i.equipped ? " <span class=\"badge acc\">" + T("Worn") + "</span>" : "") + "</li>").join("") + "<li>" + (ch.gp || 0) + " shins</li></ul></div>";
    return h;
  }

  // ---------------------------------------------------------------- side summary

  function side() {
    const s = R.compute(cur), need = stepNeeds(cur);
    const todo = s.warn;
    return '<div class="panel side mini"><h3>' + esc(s.name) + '</h3><div class="muted small">' + esc([s.clsText, s.speciesText, s.bgText].filter(Boolean).join(" · ") || "—") + "</div>" +
      '<div class="abil" style="grid-template-columns:repeat(3,1fr);margin:10px 0">' + AB.map(k => '<div class="abox"><div class="k">' + k + '</div><div class="v" style="font-size:1.15rem">' + s.scores[k] + '</div><div class="m">' + R.sign(s.mods[k]) + "</div></div>").join("") + "</div>" +
      [[T("Hit Points"), s.hp], [T("Armor Class"), s.ac], [T("Speed"), s.speed + " ft"], [T("Initiative"), R.sign(s.init)], [T("Proficiency"), "+" + s.pb]].map(([k, v]) => '<div class="line"><span>' + k + "</span><b>" + v + "</b></div>").join("") +
      '<h4 style="margin-top:12px">' + T("Still to do") + "</h4>" + (todo.length || Object.values(need).includes(false) ? todo.slice(0, 6).map(w => '<div class="warn">' + esc(w) + "</div>").join("") +
        Object.keys(need).filter(k => !need[k]).map(k => '<div class="warn">' + T(R.cap(k)) + "</div>").join("") : '<div class="okbox">' + T("All choices made.") + "</div>") + "</div>";
  }

  // ---------------------------------------------------------------- pages

  const STEPS = ["class", "background", "species", "abilities", "equipment", "spells", "details", "sheet"];

  function home() {
    let h = '<div class="panel"><div class="row"><h2 style="margin:0">' + T("Characters") + '</h2><div class="spacer"></div><button class="primary" data-act="new">' + T("New character") + '</button>' +
      '<label class="row" style="gap:6px"><button data-act="importPick">' + T("Import a Forge file") + '</button><input type="file" id="importFile" accept=".json,application/json" hidden></label></div>' +
      '<p class="small muted">' + esc(prefs.lang === "pt" ? T("homeHelp") : "Characters are kept in this browser. Use \"Save Forge file\" to keep a copy or move to another computer.") + "</p>";
    if (!chars.length) h += '<p class="muted">' + T("No characters yet.") + "</p>";
    h += '<div class="list">' + chars.slice().sort((a, b) => b.updated - a.updated).map(c => {
      const s = R.compute(c);
      return '<div class="charrow"><div><div class="t">' + esc(s.name) + '</div><div class="muted small">' + esc([s.clsText, s.speciesText, s.bgText].filter(Boolean).join(" · ") || "—") + (c.player ? " · " + esc(c.player) : "") + "</div></div>" +
        '<div class="spacer"></div><button data-act="open" data-v="' + c.id + '">' + T("Open") + '</button><button class="danger" data-act="del" data-v="' + c.id + '">' + (armed === "del:" + c.id ? T("Click again to delete") : T("Delete")) + "</button></div>";
    }).join("") + "</div></div>";
    h += '<div class="panel small muted"><b>Fogwright Forge</b> builds D&amp;D 2024 characters for the Ninth World: SRD 5.2 classes and spells, the Ninth World species and the Toolkit house rules. ' +
      "Export a character for Fogwright VTT from its Sheet tab.</div>";
    return h;
  }

  function builder() {
    const need = stepNeeds(cur);
    const nav = '<nav class="steps">' + STEPS.map(k => '<button class="' + (k === tab ? "on" : "") + '" data-tab="' + k + '">' + (k === "sheet" ? "" : '<span class="dot' + (need[k] ? " ok" : "") + '"></span>') + T(R.cap(k)) + "</button>").join("") + "</nav>";
    const body = { class: stepClass, background: stepBackground, species: stepSpecies, abilities: stepAbilities, equipment: stepEquipment, spells: stepSpells, details: stepDetails, sheet: stepSheet }[tab]();
    const i = STEPS.indexOf(tab);
    const pager = '<div class="row noprint">' + (i > 0 ? '<button data-tab="' + STEPS[i - 1] + '">← ' + T("Back") + "</button>" : "") + '<div class="spacer"></div>' + (i < STEPS.length - 1 ? '<button class="primary" data-tab="' + STEPS[i + 1] + '">' + T("Next") + " →</button>" : "") + "</div>";
    if (tab === "sheet") return nav + body + pager;
    return nav + '<div class="layout"><div>' + body + pager + "</div>" + side() + "</div>";
  }

  function render() {
    document.documentElement.lang = prefs.lang === "pt" ? "pt-PT" : "en";
    if (prefs.theme) document.documentElement.setAttribute("data-theme", prefs.theme); else document.documentElement.removeAttribute("data-theme");
    const y = window.scrollY;
    $("#app").innerHTML = '<header class="top"><span class="brand" data-act="home">⚒ Fogwright Forge</span>' +
      (cur ? '<span class="who">' + esc(cur.name || "Unnamed") + "</span>" : "") + '<div class="spacer"></div>' +
      (cur ? '<button data-act="home">' + T("Characters") + "</button>" : "") +
      '<button data-act="lang" title="Language / Língua">' + (prefs.lang === "pt" ? "EN" : "PT") + '</button><button data-act="theme" title="' + attr(T("Theme")) + '">◐</button></header>' +
      "<main>" + (cur ? builder() : home()) + "</main>" +
      "<footer>Fogwright Forge " + VERSION + " · Rules: D&amp;D System Reference Document 5.2.1 by Wizards of the Coast LLC, CC BY 4.0 · Ninth World species and house rules: our campaign.</footer>";
    window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------- actions

  function resetPaths(list) { (list || "").split(",").filter(Boolean).forEach(p => setPath(cur, p, Array.isArray(getPath(cur, p)) ? [] : (typeof getPath(cur, p) === "object" && getPath(cur, p) ? {} : ""))); }

  const acts = {
    home() { cur = null; armed = ""; render(); },
    new() { const c = R.blank(); chars.push(c); cur = c; tab = "class"; save(); render(); },
    open(v) { cur = chars.find(c => c.id === v) || null; tab = "class"; render(); },
    del(v) {
      if (armed !== "del:" + v) { armed = "del:" + v; render(); return; }
      chars = chars.filter(c => c.id !== v); armed = ""; save(); render();
    },
    lang() { prefs.lang = prefs.lang === "pt" ? "en" : "pt"; savePrefs(); render(); },
    theme() { const dark = matchMedia("(prefers-color-scheme: dark)").matches; const now = prefs.theme || (dark ? "dark" : "light"); prefs.theme = now === "dark" ? "light" : "dark"; savePrefs(); render(); },
    importPick() { $("#importFile").click(); },
    setClass(v) {
      if (R.clsId(cur) === v) return;
      cur.classes = [{ id: v, lv: 1, sub: "" }];
      cur.skills = []; cur.exp = []; cur.spells.cantrips = []; cur.spells.prepared = []; cur.equip.cls = "";
      Object.assign(cur.ch, { fightingStyle: "", divineOrder: "", primalOrder: "", mastery: [], invocations: [], instruments: [], monkTool: "" });
      save(); render();
    },
    setBg(v) {
      if (cur.bg.id === v) return;
      cur.bg = { id: v, mode: "21", p2: "", p1: "", p111: X.backgrounds[v].abil.slice(), tool: "", featData: {} };
      const bgSk = X.backgrounds[v].skills;
      cur.skills = cur.skills.filter(k => !bgSk.includes(k)); cur.equip.bg = "";
      save(); render();
    },
    setSpecies(v) { if (cur.sp.id === v) return; cur.sp = { id: v, size: R.SPECIES[v].size.length === 1 ? R.SPECIES[v].size[0] : "", line: "", abil: "", skill: "", keen: "", feat: "", featData: {} }; save(); render(); },
    roll4d6() {
      cur.ab.rolled = [0, 1, 2, 3, 4, 5].map(() => { const d = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a); return d[0] + d[1] + d[2]; });
      cur.ab.assign = {}; save(); render();
    },
    "pb+"(k) { if (cur.ab.base[k] < 15) cur.ab.base[k]++; save(); render(); },
    "pb-"(k) { if (cur.ab.base[k] > 8) cur.ab.base[k]--; save(); render(); },
    applyGear() {
      if (cur.items.length && armed !== "applyGear") { armed = "applyGear"; render(); return; }
      armed = "";
      const g = R.startingGear(cur);
      cur.items = g.items.map(i => ({ ref: i.ref, name: i.name, qty: i.qty, equipped: i.equipped, cat: i.cat, notes: "" }));
      cur.gp = g.gp; save(); render(); toast(T("Done"));
    },
    delItem(i) { cur.items.splice(+i, 1); save(); render(); },
    addItem() {
      const v = $("#addItem").value; if (!v) return;
      const it = SRD.equipment[v];
      const contents = it.contents ? R.expandEquip([v], {}).items : [{ ref: v, name: it.n, qty: it.qty || 1 }];
      contents.forEach(i => cur.items.push({ ref: i.ref, name: i.name, qty: i.qty, equipped: false, cat: catName(i.ref), notes: "" }));
      save(); render();
    },
    addCustom() { const v = $("#customItem").value.trim(); if (!v) return; cur.items.push({ ref: "", name: v, qty: 1, equipped: false, cat: "Gear", notes: "" }); save(); render(); },
    addSpell() { const v = $("#addSpell").value; if (!v) return; cur.spells.extra.push({ id: v, note: "" }); save(); render(); },
    delSpell(i) { cur.spells.extra.splice(+i, 1); save(); render(); },
    exportVTT() {
      const sheet = R.toVTT(cur, VERSION);
      download(slug(cur.name) + ".fogwright.json", sheet); toast(T("Exported"));
    },
    saveFile() { download(slug(cur.name) + ".forge.json", { fogwright_forge: 1, version: VERSION, character: cur }); toast(T("Saved")); },
    print() { window.print(); }
  };
  function catName(ref) {
    const it = R.item(ref); if (!it) return "Gear";
    const c = it.cats || [];
    return c.includes("weapons") ? "Weapons" : c.includes("armor") ? "Armor" : c.includes("tools") ? "Tools" : c.includes("ammunition") ? "Ammunition" : "Gear";
  }

  function fixUp(c) {
    const b = R.blank();
    const deep = (d, s) => { Object.keys(d).forEach(k => { if (s[k] === undefined) s[k] = d[k]; else if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k]) && typeof s[k] === "object") deep(d[k], s[k]); }); return s; };
    return deep(b, c);
  }
  chars = chars.map(fixUp);

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-act],[data-tab],[data-multi],[data-one]");
    if (!t || t.disabled) return;
    if (t.dataset.tab) { tab = t.dataset.tab; armed = ""; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.act) { const f = acts[t.dataset.act]; if (f) { if (!t.dataset.act.startsWith("del") && t.dataset.act !== "applyGear") armed = ""; f(t.dataset.v); } return; }
    if (t.dataset.multi && t.tagName !== "INPUT") { toggleMulti(t.dataset.multi, t.dataset.v, +t.dataset.max); return; }
    if (t.dataset.one && t.tagName !== "INPUT") { setOne(t.dataset.one, t.dataset.v, t.dataset.reset); }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "importFile" && t.files[0]) {
      t.files[0].text().then(txt => {
        try {
          const d = JSON.parse(txt);
          const c = d && d.fogwright_forge ? d.character : null;
          if (!c || !c.classes) throw new Error("bad");
          c.id = "c" + Math.random().toString(36).slice(2, 10);
          chars.push(fixUp(c)); save(); render(); toast(T("Imported"));
        } catch (err) { toast(T("That file is not a Forge character.")); }
      });
      return;
    }
    if (t.dataset.multi) { toggleMulti(t.dataset.multi, t.dataset.v, +t.dataset.max); return; }
    if (t.dataset.one) { setOne(t.dataset.one, t.dataset.v, t.dataset.reset); return; }
    if (t.dataset.check) { setPath(cur, t.dataset.check, t.checked); save(); render(); return; }
    if (t.dataset.assign) { cur.ab.assign[t.dataset.assign] = t.value === "" ? "" : +t.value; save(); render(); return; }
    if (t.dataset.roll !== undefined) { const v = parseInt(t.value, 10); cur.ab.rolled[+t.dataset.roll] = isNaN(v) ? undefined : Math.max(3, Math.min(18, v)); cur.ab.rolled = Array.from({ length: 6 }, (_, i) => cur.ab.rolled[i]).filter(x => x !== undefined && x !== null); save(); render(); return; }
    if (t.dataset.set) { setPath(cur, t.dataset.set, t.dataset.num ? Math.max(0, parseInt(t.value, 10) || 0) : t.value); save(); render(); }
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.set && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && !t.dataset.num))) { setPath(cur, t.dataset.set, t.value); save(); }
  });

  function toggleMulti(path, v, max) {
    const arr = (getPath(cur, path) || []).slice();
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
    else { if (max === 1) arr.length = 0; if (arr.length >= max) return; arr.push(v); }
    setPath(cur, path, arr);
    if (path === "skills") cur.exp = cur.exp.filter(k => R.skillProfs(cur).prof[k]);
    save(); render();
  }
  function setOne(path, v, reset) {
    setPath(cur, path, getPath(cur, path) === v && !path.startsWith("ab.") && !path.startsWith("bg.mode") ? "" : v);
    resetPaths(reset);
    if (path === "bg.p2" && cur.bg.p1 === v) cur.bg.p1 = "";
    save(); render();
  }

  render();
  window.Forge = { VERSION, get cur() { return cur; }, set cur(c) { cur = c; }, chars: () => chars, render, acts };
})();
