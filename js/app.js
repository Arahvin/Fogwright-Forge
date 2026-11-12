// Fogwright Forge: the builder screens.
(function () {
  "use strict";
  const VERSION = "v21";
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

  // ---------------------------------------------------------------- accounts (only when served by serve.py)
  // online: characters live on the GM's PC; each player sees their own, the GM sees all.
  // offline (file:// or GitHub Pages): characters stay in this browser, as before.
  const TOKEN = "forge-token-v1";
  let online = false, me = null, page = "", owners = {}, accounts = [], loginErr = "", signup = false, pending = {}, saveTimer = 0, unsaved = false;
  async function api(method, path, body) {
    const r = await fetch("api/" + path, { method, headers: Object.assign({ "Content-Type": "application/json" }, store.get(TOKEN, "") ? { Authorization: "Bearer " + store.get(TOKEN, "") } : {}), body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== "login" && path !== "password") { me = null; render(); }
    if (!r.ok) throw new Error(d.error || "Server error");
    return d;
  }
  function push(c, owner) {
    return api("PUT", "chars/" + c.id, owner ? { character: c, owner } : { character: c })
      .then(d => { owners[c.id] = d.owner; delete pending[c.id]; if (!Object.keys(pending).length && unsaved) { unsaved = false; render(); } })
      .catch(err => { if (!unsaved) { unsaved = true; render(); } toast(T("Not saved") + ": " + err.message); });
  }
  function flush() { clearTimeout(saveTimer); saveTimer = 0; Object.values(pending).forEach(c => push(c)); }
  const save = () => {
    if (cur) cur.updated = Date.now();
    if (!online) { store.set(KEY, chars); return; }
    if (cur) { pending[cur.id] = cur; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600); }
  };
  async function loadChars() {
    const d = await api("GET", "chars");
    owners = {}; chars = d.chars.map(r => { owners[r.character.id] = r.owner; return fixUp(r.character); });
    if (me && me.gm) accounts = (await api("GET", "accounts")).accounts;
  }
  window.addEventListener("beforeunload", () => { if (saveTimer) flush(); });
  const savePrefs = () => store.set(PREF, prefs);

  // ---------------------------------------------------------------- helpers

  const T = s => (prefs.lang === "pt" && window.I18N.pt[s]) || window.I18N.en[s] || s;
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
  const glyph = (id, big) => window.SPECIES_ICONS && SPECIES_ICONS[id] ? '<svg class="glyph sp-' + id + (big ? " big" : "") + '" viewBox="0 0 64 64" aria-hidden="true">' + SPECIES_ICONS[id] + "</svg>" : "";
  const catItems = cat => ((SRD.cats[cat] || {}).items || []).map(id => [id, R.itemName(id)]);

  // ---------------------------------------------------------------- what each step still needs

  function stepNeeds(ch) {
    const c = R.cls(ch), id = R.clsId(ch), s = R.species(ch), bg = R.background(ch), n = {};
    const missing = [];
    // class
    if (!c) missing.push("class");
    else {
      if (c.skills && ch.skills.length < c.skills.n) missing.push("class");
      const cn = R.counts(ch);
      if (cn.fightingStyle && !ch.ch.fightingStyle) missing.push("class");
      if (id === "cleric" && !ch.ch.divineOrder) missing.push("class");
      if (id === "druid" && !ch.ch.primalOrder) missing.push("class");
      if (ch.ch.mastery.length < cn.mastery) missing.push("class");
      if (ch.exp.length < cn.expertise) missing.push("class");
      if (id === "warlock" && ch.ch.invocations.length < cn.invocations) missing.push("class");
      const pl = R.plans(ch);
      if (pl && (pl.chosen.length !== pl.known || pl.chosen.some(p => (p.gen && !p.item) || p.tier > R.clvOf(ch)))) missing.push("class");
      // level-ups
      const lv = R.clvOf(ch);
      if (lv >= R.subLevel(c) && !ch.classes[0].sub) missing.push("level");
      R.asiLevels(c).filter(x => x.lv <= lv).forEach(x => { if (!asiDone(ch, x.lv)) missing.push("level"); });
      if (id === "bard" && ch.ch.instruments.length < 3) missing.push("class");
      if ((id === "monk" || id === "artificer") && !ch.ch.monkTool) missing.push("class");
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
      if (s.bionics && !(R.bionics(ch) || {}).done) missing.push("species");
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
    if (!(ch.name || ch.nick) || ch.ch.langs.filter(Boolean).length < (c ? R.counts(ch).langs : 2)) missing.push("details");
    ["class", "level", "background", "species", "abilities", "equipment", "spells", "details"].forEach(k => { n[k] = !missing.includes(k); });
    return n;
  }
  function asiDone(ch, lv) {
    const x = (ch.asi || {})[lv] || {};
    if (x.mode === "asi") return (x.a || []).filter(Boolean).length === 2;
    if (x.mode === "feat") return !!x.feat && featDone(x.feat, x.featData) && (!R.featPlus(x.feat) || !!x.plus);
    return false;
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
    const tag = [s.lv ? "Level " + s.lv : "Cantrip", s.sch, s.conc ? "Concentration" : "", s.rit ? "Ritual" : "", s.src || ""].filter(Boolean).join(" · ");
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
        T("Hit Die") + " d" + x.hd + " · " + T("Saves") + " " + x.saves.map(s => s.toUpperCase()).join(", ") + (x.cast ? " · " + T("Spells") + " (" + x.cast.toUpperCase() + ")" : "") + (x.src ? ' <span class="badge">' + esc(x.src) + "</span>" : "") + "</div></button>";
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
    const cn = R.counts(ch);
    if (cn.fightingStyle) {
      h += '<div class="choice"><h4>' + T("Fighting Style") + " " + status(ch.ch.fightingStyle ? 1 : 0, 1) + "</h4>" +
        pick("ch.fightingStyle", Object.keys(SRD.feats).filter(k => SRD.feats[k].type === "fighting-style").map(k => [k, SRD.feats[k].n])) +
        (ch.ch.fightingStyle ? md(SRD.feats[ch.ch.fightingStyle].t) : "") + "</div>";
    }
    if (id === "cleric") h += '<div class="choice"><h4>' + T("Divine Order") + " " + status(ch.ch.divineOrder ? 1 : 0, 1) + "</h4>" + pick("ch.divineOrder", Object.keys(X.divineOrder).map(k => [k, X.divineOrder[k].n]), { reset: "spells.cantrips" }) + (ch.ch.divineOrder ? '<p class="small">' + esc(X.divineOrder[ch.ch.divineOrder].t) + "</p>" : "") + "</div>";
    if (id === "druid") h += '<div class="choice"><h4>' + T("Primal Order") + " " + status(ch.ch.primalOrder ? 1 : 0, 1) + "</h4>" + pick("ch.primalOrder", Object.keys(X.primalOrder).map(k => [k, X.primalOrder[k].n]), { reset: "spells.cantrips" }) + (ch.ch.primalOrder ? '<p class="small">' + esc(X.primalOrder[ch.ch.primalOrder].t) + "</p>" : "") + "</div>";
    const wm = cn.mastery;
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
    if (cn.expertise) {
      let sk = Object.keys(R.skillProfs(ch).prof);
      if (id === "wizard") sk = sk.filter(k => ["arcana", "history", "investigation", "medicine", "nature", "religion"].includes(k));
      h += '<div class="choice"><h4>' + T("Expertise") + " " + status(ch.exp.length, cn.expertise) + '</h4><p class="small muted">' + T("Choose") + " " + cn.expertise + " (" + T("Skills") + ")</p>" +
        (sk.length ? chips("exp", sk.map(k => [k, SN[k]]), cn.expertise) : '<p class="small muted">—</p>') + "</div>";
    }
    if (id === "warlock") {
      const lv = R.clvOf(ch);
      const inv = Object.keys(SRD.invocations).filter(k => SRD.invocations[k].lv <= lv && (lv > 1 || !/Invocation|Pact of the/.test(SRD.invocations[k].pre)));
      h += '<div class="choice"><h4>' + T("Eldritch Invocation") + " " + status(ch.ch.invocations.length, cn.invocations) + '</h4><p class="small muted">' + T("Choose") + " " + cn.invocations + (lv > 1 ? ". Check each prerequisite in its text." : "") + "</p>" + chips("ch.invocations", inv.map(k => [k, SRD.invocations[k].n + (SRD.invocations[k].lv > 1 ? " (" + T("Level") + " " + SRD.invocations[k].lv + "+)" : "")]), cn.invocations) +
        ch.ch.invocations.map(k => md(SRD.invocations[k].t)).join("") + "</div>";
    }
    if (id === "bard") h += '<div class="choice"><h4>' + T("Musical instruments") + " " + status(ch.ch.instruments.length, 3) + "</h4>" + chips("ch.instruments", catItems("musical-instruments"), 3) + "</div>";
    if (id === "artificer") h += '<div class="choice"><h4>' + T("Tool") + " (Artisan's Tools) " + status(ch.ch.monkTool ? 1 : 0, 1) + "</h4>" + select("ch.monkTool", catItems("artisans-tools").filter(([k]) => k !== "tinkers-tools")) + "</div>";
    const pl = R.plans(ch);
    if (pl) {
      const A = window.ARTIFICER;
      h += '<div class="choice"><h4>' + T("Magic item plans") + " " + status(pl.chosen.length, pl.known) + '</h4><p class="small muted">' + T("Choose") + " " + pl.known + (pl.armor ? " (" + T("one extra must be Armor") + ")" : "") + ". " +
        esc(T("plansHelp").replace("{items}", pl.items).replace("{att}", pl.attune)) + "</p>";
      h += pl.chosen.map((p, i) => '<div class="row wrap" style="margin:4px 0"><b>' + esc(p.gen ? p.n.replace(/\s*\(.*\)/, "") : p.n) + "</b>" + (p.att === "Yes" ? ' <span class="badge">' + T("Attunement") + "</span>" : "") +
        (p.tier > R.clvOf(ch) ? ' <span class="need">' + T("Level") + " " + p.tier + "+</span>" : "") +
        (p.gen ? '<input data-set="ch.plans.' + i + '.item" list="ua-' + p.id + '" value="' + attr(p.item) + '" placeholder="' + attr(T("Which item?")) + '" style="flex:1;min-width:160px">' +
          '<datalist id="ua-' + p.id + '">' + (window.ARTIFICER.uaItems || []).filter(u => u[2] === p.id).map(u => '<option value="' + attr(u[0]) + '">').join("") + "</datalist>" : "") +
        '<div class="spacer"></div><button class="small danger" data-act="delPlan" data-v="' + i + '">' + T("Remove") + "</button></div>" +
        (R.tattooLevels(p) ? '<div class="row wrap small" style="margin:0 0 8px 12px">' + T("Spell inside") + " " + select("ch.plans." + i + ".spell",
          Object.keys(SRD.spells).filter(k => R.tattooLevels(p).includes(SRD.spells[k].lv)).sort((a, b) => SRD.spells[a].lv - SRD.spells[b].lv || SRD.spells[a].n.localeCompare(SRD.spells[b].n)).map(k => [k, (SRD.spells[k].lv || "C") + " · " + SRD.spells[k].n])) +
          '<span class="muted">' + T("tattooHelp") + "</span></div>" : "")).join("");
      if (pl.chosen.length < pl.known) {
        const have = pl.chosen.map(p => p.id);
        h += '<div class="row" style="margin-top:8px"><select id="addPlan"><option value="">' + T("Add a plan") + "…</option>" +
          pl.tiers.map(t => '<optgroup label="' + attr(T("Artificer level") + " " + t + "+") + '">' + A.plans[t].filter(([k, , , gen]) => gen || !have.includes(k)).map(([k, n, att]) =>
            '<option value="' + k + '">' + esc(n) + (att === "Yes" ? " · " + T("Attunement") : "") + (A.recommendedPlans.includes(k) ? " ★" : "") + "</option>" +
            (A.uaItems || []).filter(u => u[2] === k && !pl.chosen.some(p => p.item === u[0])).map(u => '<option value="' + k + "|" + attr(u[0]) + '">\u00a0\u00a0↳ ' + esc(u[0]) + " (" + (u[4] || "FotA") + ")" + (u[1] !== "No" ? " · " + T("Attunement") : "") + "</option>").join("")).join("") + "</optgroup>").join("") +
          '</select><button data-act="addPlan">+</button></div><p class="small muted">★ ' + T("recommended in the rules") + "</p>";
      }
      h += "</div>";
    }
    if (id === "monk") h += '<div class="choice"><h4>' + T("Tool or instrument") + " " + status(ch.ch.monkTool ? 1 : 0, 1) + "</h4>" + select("ch.monkTool", [...catItems("artisans-tools"), ...catItems("musical-instruments")]) + "</div>";
    return h + "</div>";
  }

  function stepLevel() {
    const ch = cur, c = R.cls(ch), id = R.clsId(ch);
    if (!c) return '<div class="panel"><h2>' + T("Level") + '</h2><p class="muted">' + T("Choose") + " " + T("Class").toLowerCase() + ".</p></div>";
    const lv = R.clvOf(ch), m = R.mod(R.scores(ch).con), avg = c.hd / 2 + 1, subLv = R.subLevel(c), asis = R.asiLevels(c);
    let h = '<div class="panel"><div class="row wrap"><h2 style="margin:0">' + esc(c.n) + " · " + T("Level") + " " + lv + '</h2><div class="spacer"></div>' +
      (lv > 1 ? '<button class="danger" data-act="levelDown">' + (armed === "levelDown" ? T("Click again to go back to level") + " " + (lv - 1) : T("Level down")) + "</button>" : "") +
      (lv < 20 ? '<button class="primary" data-act="levelUp">' + T("Level up to") + " " + (lv + 1) + "</button>" : "") + "</div>" +
      '<p class="small muted">' + esc(T("levelHelp")) + "</p>" +
      '<div class="choice"><h4>' + T("Hit Points") + "</h4>" + pick("hp.method", [["avg", T("Average") + " (" + avg + ")"], ["roll", T("Roll") + " (d" + c.hd + ")"]]) +
      '<p class="small muted">' + T("Each level adds") + " " + (ch.hp.method === "roll" ? "d" + c.hd : avg) + " " + R.sign(m) + " (CON).</p></div></div>";
    if (lv === 1) return h + '<div class="panel muted">' + esc(T("level1Help")) + "</div>";
    const subs = Object.keys(SRD.subclasses).filter(k => SRD.subclasses[k].cls === id);
    for (let L = lv; L >= 2; L--) {
      const row = R.levelRow(c, L), sub = SRD.subclasses[ch.classes[0].sub];
      h += '<div class="panel"><h3 style="margin-top:0">' + T("Level") + " " + L + "</h3>";
      // hit points
      h += '<div class="row small"><b>' + T("Hit Points") + ":</b> " + (ch.hp.method === "roll"
        ? '<input type="number" min="1" max="' + c.hd + '" style="width:64px" data-set="hp.rolls.' + L + '" data-num="1" value="' + attr(ch.hp.rolls[L] || "") + '"><button class="small" data-act="rollHp" data-v="' + L + '">' + T("Roll") + " d" + c.hd + "</button>" + (ch.hp.rolls[L] ? "" : ' <span class="need">' + T("average until rolled") + "</span>")
        : avg) + " " + R.sign(m) + "</div>";
      // features
      const feats = row.f.filter(fid => !fid.endsWith("-subclass") && !fid.endsWith("-ability-score-improvement") && !fid.endsWith("-epic-boon")).map(fid => SRD.features[fid]).filter(Boolean);
      if (sub) sub.f.filter(f => f.lv === L).forEach(f => feats.push(f));
      if (feats.length) h += feats.map(f => "<details><summary>" + esc(f.n) + (sub && sub.f.includes(f) ? ' <span class="badge">' + esc(sub.n) + "</span>" : "") + "</summary>" + md(f.t) + "</details>").join("");
      // subclass
      if (L === subLv) {
        h += '<div class="choice"><h4>' + T("Subclass") + " " + status(ch.classes[0].sub ? 1 : 0, 1) + "</h4>" + pick("classes.0.sub", subs.map(k => [k, SRD.subclasses[k].n]).concat([["other", T("Another subclass")]])) +
          (ch.classes[0].sub === "other" ? '<div class="row" style="margin-top:8px">' + T("Name") + ' <input data-set="classes.0.subName" value="' + attr(ch.classes[0].subName || "") + '"></div>' : "") +
          '<p class="small muted">' + esc(T("subHelp")) + "</p></div>";
      } else if (row.f.some(f => f.endsWith("-subclass")) && !sub) h += '<p class="small need">' + T("Choose your subclass at level") + " " + subLv + ".</p>";
      // ASI or feat
      const a = asis.find(x => x.lv === L);
      if (a) h += asiBlock(L, a.boon);
      // other new choices that live on the Class tab
      const nxt = [];
      if (row.f.some(f => /-(fighting-style)$/.test(f))) nxt.push(T("Fighting Style"));
      if (row.f.some(f => /-(expertise|scholar|deft-explorer)$/.test(f))) nxt.push(T("Expertise"));
      if (id === "warlock" && (row.cs.eldritch_invocations || 0) > (R.levelRow(c, L - 1).cs.eldritch_invocations || 0)) nxt.push(T("Eldritch Invocation"));
      if ((row.cs.weapon_mastery || 0) > (R.levelRow(c, L - 1).cs.weapon_mastery || 0)) nxt.push(T("Weapon Mastery"));
      if ((row.cs.plans_known || 0) > (R.levelRow(c, L - 1).cs.plans_known || 0) || (id === "artificer" && L === 9 && ch.classes[0].sub === "armorer")) nxt.push(T("Magic item plans"));
      if (nxt.length) h += '<p class="small">' + T("New choices on the Class tab") + ": <b>" + nxt.join(", ") + '</b> <button class="small" data-tab="class">' + T("Class") + "</button></p>";
      if (row.can > R.levelRow(c, L - 1).can || row.prep > R.levelRow(c, L - 1).prep) h += '<p class="small">' + T("More spells") + ': <button class="small" data-tab="spells">' + T("Spells") + "</button></p>";
      h += '<div class="choice"><h4>' + T("Other choices") + '</h4><textarea data-set="lvNotes.' + L + '" placeholder="' + attr(T("lvNotesHelp")) + '">' + esc((ch.lvNotes || {})[L] || "") + "</textarea></div>";
      h += "</div>";
    }
    return h;
  }

  function asiBlock(L, boon) {
    const ch = cur, x = (ch.asi || {})[L] || {}, base = "asi." + L;
    let h = '<div class="choice"><h4>' + (boon ? T("Epic Boon") : T("Ability Score Improvement")) + " " + status(asiDone(ch, L) ? 1 : 0, 1) + "</h4>" +
      pick(base + ".mode", [["asi", T("+2 to one, or +1 to two")], ["feat", boon ? T("Epic Boon or another feat") : T("A feat")]], { reset: base + ".a," + base + ".feat," + base + ".plus," + base + ".featData" });
    if (x.mode === "asi") {
      const a = x.a || [], sc = R.scores(ch);
      const opt = i => '<select data-asi="' + L + '" data-i="' + i + '"><option value="">—</option>' + AB.map(k => '<option value="' + k + '"' + (a[i] === k ? " selected" : "") + ">" + AN[k] + "</option>").join("") + "</select>";
      h += '<div class="row wrap" style="margin-top:8px">+1 ' + opt(0) + " +1 " + opt(1) + '<span class="small muted">' + T("Same one twice = +2. Max 20.") + "</span></div>";
      const over = AB.filter(k => sc[k] >= 20 && a.includes(k));
      if (over.length) h += '<p class="small need">' + over.map(k => AN[k]).join(", ") + " " + T("is already 20.") + "</p>";
    } else if (x.mode === "feat") {
      const taken = R.feats(ch).filter(f => !(f.from === "lvl" && f.lv === L)).map(f => f.id);
      const list = R.levelFeats(ch, boon).filter(k => !taken.includes(k) || ["magic-initiate", "skilled"].includes(k));
      const groups = { "epic-boon": T("Epic Boons"), general: T("General feats"), "fighting-style": T("Fighting Style"), origin: T("Origin feats") };
      h += '<div style="margin-top:8px"><select data-set="' + base + '.feat"><option value="">' + T("Choose a feat") + "…</option>" +
        Object.keys(groups).map(g => { const ks = list.filter(k => (R.feat(k).type || "origin") === g); return ks.length ? '<optgroup label="' + attr(groups[g]) + '">' + ks.map(k => '<option value="' + k + '"' + (x.feat === k ? " selected" : "") + ">" + esc(R.feat(k).n) + (R.feat(k).src === "PHB" ? " (PHB)" : "") + "</option>").join("") + "</optgroup>" : ""; }).join("") + "</select></div>";
      if (x.feat) {
        const fp = R.featPlus(x.feat);
        if (fp) h += '<p class="small muted" style="margin-top:8px">+1 (' + T("max") + " " + fp.max + ")</p>" + pick(base + ".plus", fp.from.map(k => [k, AN[k]]));
        h += featChoices(x.feat, base + ".featData");
      }
    }
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
      Object.values(R.SPECIES).map(x => '<button class="card' + (x.id === ch.sp.id ? " on" : "") + '" data-act="setSpecies" data-v="' + x.id + '"><div class="gl">' + glyph(x.id) + '<div><div class="t">' + esc(x.n) + ' <span class="badge">' + esc(x.rules) + '</span></div><div class="s">' +
        x.size.join(" / ") + " · " + x.speed + " ft" + (x.dv ? " · Darkvision " + x.dv : "") + "</div></div></div></button>").join("") + "</div></div>";
    if (!s) return h;
    h += '<div class="panel"><div class="row" style="align-items:center;margin-bottom:6px">' + glyph(s.id, true) + '<h2 style="margin:0">' + esc(s.n) + ' <span class="badge">' + esc(s.rules) + "</span></h2></div>" + md(s.lore);
    if (s.size.length > 1) h += '<div class="choice"><h4>' + T("Size") + " " + status(ch.sp.size ? 1 : 0, 1) + "</h4>" + pick("sp.size", s.size) + "</div>";
    if (s.lines) {
      const sug = s.bionics ? coreLine() : "";
      h += '<div class="choice"><h4>' + esc(s.lineLabel) + " " + status(ch.sp.line ? 1 : 0, 1) + "</h4>" + pick("sp.line", Object.keys(s.lines).map(k => [k, s.lines[k].n])) +
        (s.bionics ? '<p class="small muted">' + esc(T("coreHelp")) + (sug && ch.sp.line && sug !== ch.sp.line ? " " + esc(T("coreDiffers")).replace("{x}", s.lines[sug].n) : "") + "</p>" : "") + "</div>";
    }
    if (s.spellAbil) h += '<div class="choice"><h4>' + T("Spellcasting ability") + " " + status(ch.sp.abil ? 1 : 0, 1) + "</h4>" + pick("sp.abil", [["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]]) + "</div>";
    if (s.keen) h += '<div class="choice"><h4>Keen Senses ' + status(ch.sp.keen ? 1 : 0, 1) + "</h4>" + pick("sp.keen", s.keen.map(k => [k, SN[k]])) + "</div>";
    if (s.skill === "any") h += '<div class="choice"><h4>Skillful ' + status(ch.sp.skill ? 1 : 0, 1) + "</h4>" + select("sp.skill", Object.keys(R.SKILLS).map(k => [k, SN[k]])) + "</div>";
    if (s.originFeat) {
      const origin = [...Object.keys(SRD.feats).filter(k => SRD.feats[k].type === "origin"), ...Object.keys(X.feats)].map(k => [k, R.feat(k).n]);
      h += '<div class="choice"><h4>Versatile: ' + T("Origin feat") + " " + status(ch.sp.feat && featDone(ch.sp.feat, ch.sp.featData) ? 1 : 0, 1) + "</h4>" + pick("sp.feat", origin, { reset: "sp.featData" }) +
        (ch.sp.feat ? featChoices(ch.sp.feat, "sp.featData") : "") + "</div>";
    }
    if (s.bionics) h += bionicsUI(s);
    h += '<div class="choice"><h4>' + T("Traits") + "</h4>" + s.traits.map(t => "<details" + (t.n.length ? "" : "") + "><summary>" + esc(t.n) + "</summary>" + md(t.t) + "</details>").join("") + "</div>";
    return h + "</div>";
  }

  // the bionic core picks the Life Core it goes with (the player can still choose another one)
  function coreLine() {
    const s = R.species(cur), bio = R.bionics(cur);
    if (!s || !s.lines || !bio || !bio.core) return "";
    const want = (s.bionics.core[bio.core.i] || [])[1] || "";
    return Object.keys(s.lines).find(k => s.lines[k].n === want) || "";
  }
  function syncCore() { const k = coreLine(); if (k) cur.sp.line = k; }

  function bionicsUI(s) {
    const b = cur.sp.bio || (cur.sp.bio = { rolled: {}, pick: {}, custom: "" }), bio = R.bionics(cur), B = s.bionics;
    const label = { core: "Core (d6)", g1: "Graft 1 (d20)", g2: "Graft 2 (d20)", look: "Look (d8)", quirk: "Quirk (d12)", perk: "Perk (d10)" };
    const rows = { core: B.core.map(r => r[0] + (r[1] ? " [" + r[1] + "]" : "")), g1: B.grafts, g2: B.grafts, look: B.look, quirk: B.quirk, perk: B.perk.map(r => r[0] + ": " + r[1]) };
    const rolled = Object.keys(b.rolled || {}).length > 0;
    let h = '<div class="choice"><h4>' + T("Bionics") + " " + status(bio && bio.done ? 1 : 0, 1) + "</h4>" +
      '<p class="small muted">' + esc(T("bioHelp")) + "</p>" +
      '<div class="row" style="margin-bottom:8px"><button data-act="rollBio">' + (rolled ? T("Roll again") : T("Roll the bionics")) + "</button>" +
      (bio && bio.swaps > 1 ? '<span class="need">' + esc(T("bioSwaps")) + "</span>" : "") + "</div>";
    h += '<div class="form">' + R.BIO_SLOTS.map(([k]) => {
      const cur_ = b.pick[k] !== undefined && b.pick[k] !== "" ? +b.pick[k] : (b.rolled[k] !== undefined ? +b.rolled[k] : "");
      const opts = rows[k].map((txt, i) => '<option value="' + i + '"' + (cur_ === i ? " selected" : "") + ">" + (i + 1) + ". " + esc(txt) + (b.rolled[k] === i ? " 🎲" : "") + "</option>").join("");
      return "<span>" + label[k] + '</span><select data-bio="' + k + '" style="width:100%"><option value="">—</option>' + opts + "</select>";
    }).join("") + "</div>";
    if ([b.pick.g1, b.pick.g2, b.rolled.g1, b.rolled.g2].some(v => +v === 19) && bio && ((bio.g1 && bio.g1.i === 19) || (bio.g2 && bio.g2.i === 19)))
      h += '<div class="form" style="margin-top:6px"><span>' + T("Your own graft") + '</span><input data-set="sp.bio.custom" value="' + attr(b.custom || "") + '"></div>';
    if (bio && bio.core && B.core[bio.core.i][1]) h += '<p class="small muted">' + esc(T("Suggested Life Core")) + ": " + esc(B.core[bio.core.i][1] === "Any" ? T("any") : B.core[bio.core.i][1]) + "</p>";
    return h + "</div>";
  }

  function stepAbilities() {
    const ch = cur, a = ch.ab, c = R.cls(ch);
    const base = R.baseScores(ch), bon = R.bgBonus(ch), fin = R.scores(ch), up = R.asiBonus(ch);
    let h = '<div class="panel"><h2>' + T("Abilities") + "</h2>" + pick("ab.method", [["array", T("Standard array")], ["point", T("Point buy")], ["roll", T("Roll")], ["manual", T("Manual")]]);
    if (c) h += '<p class="small muted">' + T("Recommended") + ": " + esc(SRD.classes[R.clsId(ch)].n) + " → " + (c.cast ? AN[c.cast] : ({ barbarian: "Strength", fighter: "Strength or Dexterity", monk: "Dexterity and Wisdom", rogue: "Dexterity" })[R.clsId(ch)] || "") + ".</p>";
    if (a.method === "point") h += '<p><b>' + T("Points left") + ": " + (27 - R.pointsSpent(ch)) + "</b> / 27</p>";
    if (a.method === "roll") {
      h += '<div class="row" style="margin:8px 0"><button data-act="roll4d6">' + T("Roll 4d6 (drop lowest)") + '</button><span class="muted small">' + T("or") + ' type them:</span>' +
        [0, 1, 2, 3, 4, 5].map(i => '<input type="number" min="3" max="18" style="width:64px" data-roll="' + i + '" value="' + attr(a.rolled[i] ?? "") + '">').join("") + "</div>";
    }
    const pool = a.method === "array" ? R.STANDARD : a.method === "roll" ? a.rolled : null;
    h += '<div class="tablewrap"><table class="grid"><tr><th></th><th>' + T("Base") + "</th><th>" + T("Background") + "</th><th>" + T("Level-ups") + "</th><th>" + T("Score") + "</th><th>" + T("Modifier") + "</th></tr>";
    AB.forEach(k => {
      let ctl;
      if (pool) {
        const used = AB.filter(o => o !== k).map(o => a.assign[o]).filter(v => v !== undefined && v !== "");
        ctl = '<select data-assign="' + k + '"><option value="">—</option>' + pool.map((v, i) => used.includes(i) && a.assign[k] !== i ? "" : '<option value="' + i + '"' + (a.assign[k] === i ? " selected" : "") + ">" + v + "</option>").join("") + "</select>";
      } else if (a.method === "point") {
        ctl = '<div class="row"><button class="small" data-act="pb-" data-v="' + k + '"' + (a.base[k] <= 8 ? " disabled" : "") + '>−</button><b style="min-width:22px;text-align:center">' + a.base[k] + '</b><button class="small" data-act="pb+" data-v="' + k + '"' + (a.base[k] >= 15 ? " disabled" : "") + ">+</button></div>";
      } else ctl = '<input type="number" min="1" max="20" style="width:70px" data-set="ab.base.' + k + '" data-num="1" value="' + a.base[k] + '">';
      h += "<tr><td><b>" + AN[k] + "</b></td><td>" + ctl + "</td><td>" + (bon[k] ? "+" + bon[k] : "") + "</td><td>" + (up.b[k] + up.boon[k] ? "+" + (up.b[k] + up.boon[k]) : "") + "</td><td><b>" + fin[k] + "</b></td><td>" + R.sign(R.mod(fin[k])) + "</td></tr>";
    });
    h += "</table></div>";
    if (!R.background(ch)) h += '<p class="small muted">Choose a background to add its +2/+1.</p>';
    return h + "</div>";
  }

  function stepEquipment() {
    const ch = cur, id = R.clsId(ch), bg = R.background(ch);
    let h = '<div class="panel"><h2>' + T("Starting gear") + "</h2>";
    const ce = X.classEquip[id];
    const show = list => list.map(e => { let [r, q, n] = Array.isArray(e) ? e : [e, 1, ""]; if (r === "gp") return q + " " + T("shins"); return (q > 1 ? q + " × " : "") + (r.startsWith("@") ? "(" + r.slice(1) + ")" : R.itemName(r)) + (n ? " (" + n + ")" : ""); }).join(", ");
    if (ce) h += "<h4>" + T("Class") + ": " + esc(SRD.classes[id].n) + "</h4>" + pick("equip.cls", ce.map((l, i) => ["abc"[i], "abc"[i].toUpperCase() + ") " + show(l)]));
    else h += '<p class="muted">' + T("Choose") + " " + T("Class").toLowerCase() + ".</p>";
    if (bg) h += "<h4 style=\"margin-top:10px\">" + T("Background") + ": " + esc(bg.n) + "</h4>" + pick("equip.bg", [["a", "A) " + show(bg.equip)], ["b", "B) 50 " + T("shins")]]);
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
    const langs = L.standard.map(([n, dnd]) => [n, n + " (" + dnd + ")"]);
    const rareOn = ch.ch.langs.filter(v => L.rare.some(r => r[0] === v)).map(v => [v, v + " (rare)"]);
    let h = '<div class="panel"><h2>' + T("Details") + '</h2><div class="form">' +
      "<span>" + T("Character name") + '</span><div class="row"><input data-set="name" value="' + attr(ch.name) + '" style="flex:2;min-width:140px"><label class="row" style="gap:6px;flex:1;min-width:140px">' + T("Nickname") + ' <input data-set="nick" value="' + attr(ch.nick || "") + '" style="flex:1;min-width:0"></label></div>' +
      "<span>" + T("Player (VTT name)") + '</span><div><input data-set="player" value="' + attr(ch.player) + '"><div class="small muted">The name the player logs in with in Fogwright VTT, so the sheet is theirs.</div></div>' +
      "</div>";
    const nl = R.cls(ch) ? R.counts(ch).langs : 2;
    h += '<div class="choice"><h4>' + T("Languages") + " " + status(ch.ch.langs.filter(Boolean).length, nl) + '</h4><p class="small muted">' + esc(L.common) + " (Common) + " + nl + ". " + T("Choose") + " " + nl + (nl > 2 ? " (2 + Deft Explorer)" : "") + ".</p>" + chips("ch.langs", langs.concat(rareOn), nl) +
      '<p class="small muted">' + T("Rare languages") + ": " + esc(L.rare.map(r => r[0] + " (" + r[1] + ")").join(", ")) + ". " + T("rareHelp") + "</p></div>";
    ["appearance", "personality", "backstory", "notes"].forEach(k => {
      h += '<div class="choice"><h4>' + T(R.cap(k)) + '</h4><textarea data-set="det.' + k + '">' + esc(ch.det[k] || "") + "</textarea></div>";
    });
    return h + "</div>";
  }

  function stepSheet() {
    const ch = cur, s = R.compute(ch);
    let h = '<div class="panel"><div class="row">' + glyph(ch.sp.id, true) + '<div><h2 style="margin:0">' + esc(s.name) + '</h2><div class="muted">' +
      esc([s.clsText, s.speciesText, s.bgText, s.size].filter(Boolean).join(" · ")) + (s.label ? ' <span class="badge acc">' + esc(s.label) + "</span>" : "") + "</div></div>" +
      '<div class="spacer"></div><div class="row noprint"><button class="primary" data-act="exportVTT">' + T("Export for Fogwright VTT") + '</button><button data-act="saveFile">' + T("Save Forge file") + '</button><button data-act="print">' + T("Print") + "</button></div></div>";
    h += '<details class="noprint"><summary class="small">' + T("How to bring it into the VTT") + '</summary><p class="small">' +
      esc(T("vttHelp")) + "</p></details>";
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
    return '<div class="panel side mini"><div class="row" style="gap:8px;flex-wrap:nowrap">' + glyph(cur.sp.id) + '<h3 style="margin:0">' + esc(s.name) + '</h3></div><div class="muted small">' + esc([s.clsText, s.speciesText, s.bgText].filter(Boolean).join(" · ") || "—") + "</div>" +
      '<div class="abil" style="grid-template-columns:repeat(3,1fr);margin:10px 0">' + AB.map(k => '<div class="abox"><div class="k">' + k + '</div><div class="v" style="font-size:1.15rem">' + s.scores[k] + '</div><div class="m">' + R.sign(s.mods[k]) + "</div></div>").join("") + "</div>" +
      [[T("Hit Points"), s.hp], [T("Armor Class"), s.ac], [T("Speed"), s.speed + " ft"], [T("Initiative"), R.sign(s.init)], [T("Proficiency"), "+" + s.pb]].map(([k, v]) => '<div class="line"><span>' + k + "</span><b>" + v + "</b></div>").join("") +
      '<h4 style="margin-top:12px">' + T("Still to do") + "</h4>" + (todo.length || Object.values(need).includes(false) ? todo.slice(0, 6).map(w => '<div class="warn">' + esc(w) + "</div>").join("") +
        Object.keys(need).filter(k => !need[k]).map(k => '<div class="warn">' + T(R.cap(k)) + "</div>").join("") : '<div class="okbox">' + T("All choices made.") + "</div>") + "</div>";
  }

  // ---------------------------------------------------------------- pages

  const STEPS = ["class", "level", "background", "species", "abilities", "equipment", "spells", "details", "sheet"];

  function home() {
    let h = '<div class="panel"><div class="row"><h2 style="margin:0">' + T("Characters") + '</h2><div class="spacer"></div><button class="primary" data-act="new">' + T("New character") + '</button>' +
      '<label class="row" style="gap:6px"><button data-act="importPick">' + T("Import a Forge file") + '</button><input type="file" id="importFile" accept=".json,application/json" hidden></label></div>' +
      '<p class="small muted">' + esc(T(online ? (me && me.gm ? "homeHelpGM" : "homeHelpOnline") : "homeHelp")) + "</p>";
    const local = online ? store.get(KEY, []) : [];
    if (local.length) h += '<div class="okbox row wrap">' + esc(T("localChars").replace("{n}", local.length)) + '<div class="spacer"></div><button class="primary" data-act="uploadLocal">' + T("Send them to my account") + "</button></div>";
    if (!chars.length) h += '<p class="muted">' + T("No characters yet.") + "</p>";
    h += '<div class="list">' + chars.slice().sort((a, b) => b.updated - a.updated).map(c => {
      const s = R.compute(c);
      return '<div class="charrow">' + glyph(c.sp.id) + '<div><div class="t">' + esc(s.name) + '</div><div class="muted small">' + esc([s.clsText, s.speciesText, s.bgText].filter(Boolean).join(" · ") || "—") + (c.player ? " · " + esc(c.player) : "") + "</div></div>" + ownerPick(c) +
        '<div class="spacer"></div><button data-act="open" data-v="' + c.id + '">' + T("Open") + '</button><button class="danger" data-act="del" data-v="' + c.id + '">' + (armed === "del:" + c.id ? T("Click again to delete") : T("Delete")) + "</button></div>";
    }).join("") + "</div></div>";
    h += '<div class="panel small muted"><b>Fogwright Forge</b> builds D&amp;D 2024 characters for the Ninth World: SRD 5.2 classes and spells, the Ninth World species and the Toolkit house rules. ' +
      "Export a character for Fogwright VTT from its Sheet tab.</div>";
    return h;
  }

  function login() {
    return '<div class="panel login"><h2>' + T(signup ? "Create an account" : "Sign in") + '</h2><p class="small muted">' + esc(T(signup ? "signupHelp" : "loginHelp")) + "</p>" +
      '<form id="loginForm"><label>' + T("Name") + '<input id="lgName" autocomplete="username" required></label>' +
      '<label>' + T("Password") + '<input id="lgPw" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" required' + (signup ? ' minlength="4"' : "") + "></label>" +
      (signup ? '<label>' + T("Repeat the password") + '<input id="lgPw2" type="password" autocomplete="new-password" required></label>' : "") +
      (loginErr ? '<div class="warn">' + esc(loginErr) + "</div>" : "") + '<button class="primary" type="submit">' + T(signup ? "Create an account" : "Sign in") + "</button>" +
      '<button type="button" data-act="signupToggle">' + T(signup ? "I already have an account" : "Create an account") + "</button></form></div>";
  }

  function players() {
    let h = '<div class="panel"><div class="row"><h2 style="margin:0">' + T("Players") + '</h2><div class="spacer"></div><button data-act="home">' + T("Characters") + "</button></div>" +
      '<p class="small muted">' + esc(T("playersHelp")) + "</p>" +
      '<div class="list">' + accounts.map(a => '<div class="charrow"><div><div class="t">' + esc(a.name) + '</div><div class="muted small">' + a.chars + " " + T(a.chars === 1 ? "character" : "characters") + "</div></div>" +
        '<div class="spacer"></div><button class="danger" data-act="delAccount" data-v="' + attr(a.name) + '">' + (armed === "acc:" + a.name ? T("Click again to delete") : T("Delete")) + "</button></div>").join("") + "</div>" +
      (accounts.length ? "" : '<p class="muted">' + T("No players yet.") + "</p>") +
      '<h3>' + T("Add a player or reset a password") + '</h3><form id="accForm" class="row wrap"><input id="accName" placeholder="' + attr(T("Name")) + '" required>' +
      '<input id="accPw" placeholder="' + attr(T("Password")) + '" required minlength="4"><button class="primary" type="submit">' + T("Save") + "</button></form></div>";
    return h;
  }

  function password() {
    return '<div class="panel login"><h2>' + T("Change password") + '</h2><form id="pwForm"><label>' + T("Current password") + '<input id="pwOld" type="password" autocomplete="current-password" required></label>' +
      '<label>' + T("New password") + '<input id="pwNew" type="password" autocomplete="new-password" required minlength="4"></label>' +
      (loginErr ? '<div class="warn">' + esc(loginErr) + "</div>" : "") +
      '<div class="row"><button data-act="home" type="button">' + T("Back") + '</button><button class="primary" type="submit">' + T("Save") + "</button></div></form></div>";
  }

  function ownerPick(c) {
    if (!online || !me || !me.gm) return "";
    const o = owners[c.id] || "GM";
    return '<label class="small muted row" style="gap:4px">' + T("Owner") + ' <select data-owner="' + c.id + '">' + ["GM"].concat(accounts.map(a => a.name)).map(n => '<option' + (n === o ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select></label>";
  }

  function builder() {
    const need = stepNeeds(cur);
    const nav = '<nav class="steps">' + STEPS.map(k => '<button class="' + (k === tab ? "on" : "") + '" data-tab="' + k + '">' + (k === "sheet" ? "" : '<span class="dot' + (need[k] ? " ok" : "") + '"></span>') + T(R.cap(k)) + "</button>").join("") + "</nav>";
    const body = { class: stepClass, level: stepLevel, background: stepBackground, species: stepSpecies, abilities: stepAbilities, equipment: stepEquipment, spells: stepSpells, details: stepDetails, sheet: stepSheet }[tab]();
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
      (cur ? '<span class="who">' + esc(R.fullName(cur)) + "</span>" : "") + '<div class="spacer"></div>' +
      (unsaved ? '<span class="warn small">' + T("Not saved") + "</span>" : "") +
      (cur ? '<button data-act="home">' + T("Characters") + "</button>" : "") +
      (online && me ? (me.gm ? '<button data-act="players">' + T("Players") + "</button>" : '<button data-act="password">' + T("Password") + "</button>") +
        '<button data-act="logout" title="' + attr(T("Sign out")) + '">' + esc(me.name) + " ⏻</button>" : "") +
      '<button data-act="lang" title="Language / Língua">' + (prefs.lang === "pt" ? "EN" : "PT") + '</button><button data-act="theme" title="' + attr(T("Theme")) + '">◐</button></header>' +
      "<main>" + (online && !me ? login() : page === "players" ? players() : page === "password" ? password() : cur ? builder() : home()) + "</main>" +
      "<footer>Fogwright Forge " + VERSION + " · Rules: D&amp;D System Reference Document 5.2.1 by Wizards of the Coast LLC, CC BY 4.0 · Ninth World species and house rules: our campaign.</footer>";
    window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------- actions

  function resetPaths(list) { (list || "").split(",").filter(Boolean).forEach(p => { const v = getPath(cur, p); if (v !== undefined) setPath(cur, p, Array.isArray(v) ? [] : (typeof v === "object" && v ? {} : "")); }); }

  const acts = {
    home() { if (saveTimer) flush(); cur = null; armed = ""; page = ""; loginErr = ""; render(); },
    new() { const c = R.blank(); if (online && me && !me.gm) c.player = me.name; chars.push(c); cur = c; tab = "class"; save(); render(); },
    signupToggle() { signup = !signup; loginErr = ""; render(); },
    players() { if (saveTimer) flush(); cur = null; page = "players"; armed = ""; render(); },
    password() { if (saveTimer) flush(); cur = null; page = "password"; loginErr = ""; render(); },
    logout() { if (saveTimer) flush(); api("POST", "logout").catch(() => {}).then(() => { store.set(TOKEN, ""); me = null; cur = null; page = ""; chars = []; render(); }); },
    delAccount(v) {
      if (armed !== "acc:" + v) { armed = "acc:" + v; render(); return; }
      armed = ""; api("DELETE", "accounts/" + encodeURIComponent(v)).then(loadChars).then(render).catch(err => toast(err.message));
    },
    uploadLocal() {
      const local = store.get(KEY, []).map(fixUp);
      Promise.all(local.map(c => { if (chars.some(x => x.id === c.id)) c.id = "c" + Math.random().toString(36).slice(2, 10); return api("PUT", "chars/" + c.id, { character: c }); }))
        .then(() => { store.set(KEY, []); return loadChars(); }).then(() => { render(); toast(T("Done")); }).catch(err => toast(err.message));
    },
    open(v) { cur = chars.find(c => c.id === v) || null; tab = "class"; render(); },
    del(v) {
      if (armed !== "del:" + v) { armed = "del:" + v; render(); return; }
      chars = chars.filter(c => c.id !== v); armed = "";
      if (online) { delete pending[v]; api("DELETE", "chars/" + v).catch(err => toast(err.message)); } else save();
      render();
    },
    lang() { prefs.lang = prefs.lang === "pt" ? "en" : "pt"; savePrefs(); render(); },
    theme() { const dark = matchMedia("(prefers-color-scheme: dark)").matches; const now = prefs.theme || (dark ? "dark" : "light"); prefs.theme = now === "dark" ? "light" : "dark"; savePrefs(); render(); },
    importPick() { $("#importFile").click(); },
    setClass(v) {
      if (R.clsId(cur) === v) return;
      cur.classes = [{ id: v, lv: R.clvOf(cur), sub: "" }]; cur.asi = {}; cur.lvNotes = {};
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
    levelUp() {
      const c = R.cls(cur); if (!c) return;
      const lv = R.clvOf(cur); if (lv >= 20) return;
      cur.classes[0].lv = lv + 1; tab = "level"; save(); render(); window.scrollTo(0, 0); toast(T("Level") + " " + (lv + 1));
    },
    levelDown() {
      if (armed !== "levelDown") { armed = "levelDown"; render(); return; }
      armed = "";
      const lv = R.clvOf(cur); if (lv <= 1) return;
      cur.classes[0].lv = lv - 1;
      delete cur.asi[lv]; delete cur.hp.rolls[lv]; delete cur.lvNotes[lv];
      if (lv - 1 < R.subLevel(R.cls(cur))) cur.classes[0].sub = "";
      const n = R.counts(cur);
      cur.exp = cur.exp.slice(0, n.expertise); cur.ch.mastery = cur.ch.mastery.slice(0, n.mastery);
      cur.ch.invocations = cur.ch.invocations.slice(0, n.invocations); cur.ch.langs = cur.ch.langs.slice(0, n.langs);
      if (!n.fightingStyle) cur.ch.fightingStyle = "";
      const pl = R.plans(cur); cur.ch.plans = pl ? (cur.ch.plans || []).slice(0, pl.known) : [];
      const lim = R.spellLimits(cur);
      if (lim) { cur.spells.cantrips = cur.spells.cantrips.slice(0, lim.cantrips); cur.spells.prepared = cur.spells.prepared.filter(k => (R.spell(k) || {}).lv <= lim.maxLv).slice(0, lim.prepared); }
      else { cur.spells.cantrips = []; cur.spells.prepared = []; }
      save(); render();
    },
    addPlan() { const v = $("#addPlan").value; if (!v) return; const [id, item] = v.split("|"); cur.ch.plans = cur.ch.plans || []; cur.ch.plans.push(Object.assign({ id, item: item || "" }, /tattoo/i.test(item || "") ? { tattoo: true } : {})); save(); render(); },
    delPlan(i) { cur.ch.plans.splice(+i, 1); save(); render(); },
    rollHp(v) { const c = R.cls(cur); cur.hp.rolls[v] = 1 + Math.floor(Math.random() * c.hd); save(); render(); },
    rollBio() { R.rollBionics(cur); syncCore(); save(); render(); },
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
    deep(b, c);
    const L = X.languages, to = {};
    L.standard.concat(L.rare).forEach(([n, dnd]) => { to[dnd] = n; });
    c.ch.langs = (c.ch.langs || []).map(v => to[v] || v);
    R.migratePlans(c);
    return c;
  }
  chars = chars.map(fixUp);

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-act],[data-tab],[data-multi],[data-one]");
    if (!t || t.disabled) return;
    if (t.dataset.tab) { tab = t.dataset.tab; armed = ""; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.act) { const f = acts[t.dataset.act]; if (f) { if (!t.dataset.act.startsWith("del") && t.dataset.act !== "applyGear" && t.dataset.act !== "levelDown") armed = ""; f(t.dataset.v); } return; }
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
          if (online && me && !me.gm && !c.player) c.player = me.name;
          chars.push(fixUp(c)); cur = c; save(); cur = null; render(); toast(T("Imported"));
        } catch (err) { toast(T("That file is not a Forge character.")); }
      });
      return;
    }
    if (t.dataset.owner) { const c = chars.find(x => x.id === t.dataset.owner); if (c) push(c, t.value).then(render); return; }
    if (t.dataset.multi) { toggleMulti(t.dataset.multi, t.dataset.v, +t.dataset.max); return; }
    if (t.dataset.one) { setOne(t.dataset.one, t.dataset.v, t.dataset.reset); return; }
    if (t.dataset.check) { setPath(cur, t.dataset.check, t.checked); save(); render(); return; }
    if (t.dataset.bio) { cur.sp.bio = cur.sp.bio || { rolled: {}, pick: {}, custom: "" }; cur.sp.bio.pick[t.dataset.bio] = t.value === "" ? "" : +t.value; if (t.dataset.bio === "core") syncCore(); save(); render(); return; }
    if (t.dataset.asi) { const x = cur.asi[t.dataset.asi] = cur.asi[t.dataset.asi] || { mode: "asi" }; const arr = [(x.a || [])[0] || "", (x.a || [])[1] || ""]; arr[+t.dataset.i] = t.value; x.a = arr; save(); render(); return; }
    if (t.dataset.assign) { cur.ab.assign[t.dataset.assign] = t.value === "" ? "" : +t.value; save(); render(); return; }
    if (t.dataset.roll !== undefined) { const v = parseInt(t.value, 10); cur.ab.rolled[+t.dataset.roll] = isNaN(v) ? undefined : Math.max(3, Math.min(18, v)); cur.ab.rolled = Array.from({ length: 6 }, (_, i) => cur.ab.rolled[i]).filter(x => x !== undefined && x !== null); save(); render(); return; }
    if (t.dataset.set) { setPath(cur, t.dataset.set, t.dataset.num ? Math.max(0, parseInt(t.value, 10) || 0) : t.value); save(); if (pointerDown) deferRender = true; else render(); }
  });
  // A text box loses focus when a button is pressed; re-drawing the page then would swallow that click,
  // so wait until the pointer is released.
  let pointerDown = false, deferRender = false;
  document.addEventListener("pointerdown", () => { pointerDown = true; }, true);
  document.addEventListener("pointerup", () => { pointerDown = false; if (deferRender) setTimeout(() => { deferRender = false; render(); }, 0); }, true);
  document.addEventListener("submit", e => {
    e.preventDefault();
    const id = e.target.id;
    if (id === "loginForm") {
      if (signup && $("#lgPw").value !== $("#lgPw2").value) { loginErr = T("The passwords don't match."); render(); return; }
      api("POST", signup ? "signup" : "login", { name: $("#lgName").value, password: $("#lgPw").value })
        .then(d => { store.set(TOKEN, d.token); me = { name: d.name, gm: d.gm }; loginErr = ""; signup = false; return loadChars(); })
        .then(render).catch(err => { loginErr = err.message; render(); });
    } else if (id === "accForm") {
      api("POST", "accounts", { name: $("#accName").value, password: $("#accPw").value })
        .then(loadChars).then(() => { render(); toast(T("Saved")); }).catch(err => toast(err.message));
    } else if (id === "pwForm") {
      api("POST", "password", { old: $("#pwOld").value, new: $("#pwNew").value })
        .then(() => { page = ""; loginErr = ""; render(); toast(T("Saved")); }).catch(err => { loginErr = err.message; render(); });
    }
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

  async function boot() {
    if (location.protocol.startsWith("http")) {
      try {
        const r = await fetch("api/me", { headers: store.get(TOKEN, "") ? { Authorization: "Bearer " + store.get(TOKEN, "") } : {} });
        const d = r.ok ? await r.json() : null;
        if (d && "name" in d) {
          online = true; chars = [];
          if (d.name) { me = { name: d.name, gm: d.gm }; await loadChars(); }
        }
      } catch (err) { /* no server: offline mode */ }
    }
    render();
  }
  boot();
  window.Forge = { VERSION, get cur() { return cur; }, set cur(c) { cur = c; }, chars: () => chars, render, acts };
})();
