// Echo Studio: die Karten der Echo Show gestalten. Eine Seite in der Seitenleiste von Home Assistant,
// ohne Bauschritt: ein Web Component, das Home Assistant mit `hass` versorgt.
//
// Links die Geräte (ein Haken setzt das Label „echo“), in der Mitte die Vorschau im Format der Echo
// Show (Karten ziehen zum Sortieren, antippen zum Bearbeiten), rechts die gewählte Karte: Name,
// Symbol, eigenes Icon, Bild, Farben, Texte ausblenden, Größe. „Speichern“ legt die Gestaltung in
// Home Assistant ab; die Echo Show holt sie beim nächsten Öffnen ihres Dashboards.

const DOMAIN_ICONS = {
  light: "mdi:lightbulb", switch: "mdi:toggle-switch", fan: "mdi:fan", cover: "mdi:window-shutter",
  climate: "mdi:thermostat", media_player: "mdi:speaker", lock: "mdi:lock", scene: "mdi:palette",
  script: "mdi:script-text-play", input_boolean: "mdi:toggle-switch-outline", sensor: "mdi:eye",
  binary_sensor: "mdi:checkbox-blank-circle-outline", button: "mdi:gesture-tap-button",
  camera: "mdi:cctv", vacuum: "mdi:robot-vacuum", automation: "mdi:robot",
};
const DOMAIN_NAMES = {
  light: "Lampen", switch: "Schalter", fan: "Ventilatoren", cover: "Rollläden", climate: "Thermostate",
  media_player: "Lautsprecher", lock: "Schlösser", scene: "Szenen", script: "Skripte",
  input_boolean: "Helfer", sensor: "Sensoren", binary_sensor: "Melder", button: "Tasten",
};
const SIZES = [["1x1", "Klein"], ["2x1", "Breit"], ["2x2", "Groß"]];
const AMBER = "#E9A23B";

const css = `
:host { display:block; height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
  font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
* { box-sizing:border-box; }
.top { display:flex; align-items:center; gap:12px; padding:10px 16px; background:var(--app-header-background-color, var(--primary-color));
  color:var(--app-header-text-color, #fff); min-height:56px; }
.top h1 { font-size:20px; font-weight:400; margin:0; flex:1; }
.top .state { font-size:13px; opacity:.85; }
.top button { background:rgba(255,255,255,.15); color:inherit; }
.top button.primary { background:${AMBER}; color:#1c1206; }
button { border:0; border-radius:18px; padding:8px 16px; font:inherit; cursor:pointer;
  background:var(--secondary-background-color); color:var(--primary-text-color); }
button.primary { background:${AMBER}; color:#1c1206; font-weight:500; }
button:disabled { opacity:.45; cursor:default; }
button.link { background:none; padding:4px 8px; color:var(--primary-color); }
.main { display:grid; grid-template-columns:320px 1fr 340px; gap:16px; padding:16px; height:calc(100% - 56px); }
.pane { background:var(--card-background-color); border-radius:12px; padding:12px; overflow:auto; min-height:0; }
.pane h2 { font-size:15px; margin:4px 4px 10px; font-weight:500; }
@media (max-width:1100px) { .main { grid-template-columns:1fr; height:auto; } .pane { max-height:none; } }
input[type=search], input[type=text], select { width:100%; padding:8px 10px; border-radius:8px; font:inherit;
  border:1px solid var(--divider-color); background:var(--primary-background-color); color:inherit; }
.filters { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
.group { margin:12px 4px 4px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--secondary-text-color); }
.dev { display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:8px; cursor:pointer; }
.dev:hover { background:var(--secondary-background-color); }
.dev input { width:18px; height:18px; accent-color:${AMBER}; }
.dev ha-icon { --mdc-icon-size:20px; color:var(--secondary-text-color); }
.dev .n { flex:1; min-width:0; }
.dev .n div { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dev .n small { color:var(--secondary-text-color); }
.dev.off { opacity:.5; cursor:default; }
/* Die Vorschau zeichnet wie die Echo Show 8 (1280 × 800): Ränder, Abstände und Größen in den Maßen
   von TECHO5 (drawn_cards.go), umgerechnet auf die Breite der Vorschau (--u ist eine Einheit). */
.screen { container-type:inline-size; width:100%; max-width:960px; margin:0 auto; border-radius:18px;
  box-shadow:0 0 0 10px #050505, 0 10px 30px rgba(0,0,0,.4); overflow:hidden;
  /* die Farben des Home-Assistant-Designs, wie die Echo Show sie übernimmt (dashboard/theme.go) */
  --e-bg:var(--primary-background-color, #111); --e-card:var(--ha-card-background, var(--card-background-color, #1c1c1c));
  --e-text:var(--primary-text-color, #e1e1e1); --e-sub:var(--secondary-text-color, #9b9b9b);
  --e-active:var(--state-light-on-color, #ff9800); /* die Echo Show nimmt diese, sonst Orange */
  --e-rad:var(--ha-card-border-radius, 12px); background:var(--e-bg); }
.page { --u:0.10417cqw; aspect-ratio:16/10; overflow:auto; display:flex; position:relative; gap:calc(var(--u)*12);
  padding:calc(var(--u)*12) calc(var(--u)*20); font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.col { flex:1; min-width:0; display:flex; flex-direction:column; gap:calc(var(--u)*12); }
.sec { display:flex; flex-direction:column; gap:calc(var(--u)*12); }
.heading { height:calc(var(--u)*46); display:flex; align-items:center; color:var(--e-text); font-weight:700;
  font-size:calc(var(--u)*36); padding:0 calc(var(--u)*4); cursor:pointer; border-radius:8px; white-space:nowrap; overflow:hidden; }
.heading.sel { outline:2px solid ${AMBER}; }
.tiles { display:grid; grid-template-columns:1fr 1fr; grid-auto-rows:calc(var(--u)*var(--th, 84)); gap:calc(var(--u)*12); }
.fill { position:absolute; inset:calc(var(--u)*20); display:grid; gap:calc(var(--u)*12); }
.tile { --k:1; position:relative; border-radius:var(--e-rad); background:var(--e-card); color:var(--e-text); cursor:grab;
  display:flex; align-items:center; gap:calc(var(--u)*12*var(--k)); padding:0 calc(var(--u)*12*var(--k)); overflow:hidden;
  background-size:cover; background-position:center; }
.tile.w2 { grid-column:span 2; } .tile.h2 { grid-row:span 2; }
.tile.sel { outline:3px solid #fff; outline-offset:2px; }
.tile.drop { box-shadow:calc(var(--u)*-6) 0 0 0 ${AMBER}; }
.tile .shade { position:absolute; inset:0; background:linear-gradient(180deg, transparent 35%, var(--shade, rgba(0,0,0,.6))); pointer-events:none; }
.tile > * { position:relative; }
.badge { flex:none; width:calc(var(--u)*44*var(--k)); height:calc(var(--u)*44*var(--k)); border-radius:50%; display:flex; align-items:center;
  justify-content:center; background:var(--badge, color-mix(in srgb, var(--e-card) 86%, var(--e-sub))); color:var(--ink, var(--e-sub)); }
.badge.plain { background:none; }
.badge ha-icon { --mdc-icon-size:calc(var(--u)*26*var(--k)); }
.badge img { width:100%; height:100%; object-fit:contain; }
.tile.solo { justify-content:center; }
.tile.solo .badge { width:60%; height:60%; aspect-ratio:1; max-height:calc(100% - var(--u)*12); }
.tile.solo .badge ha-icon { --mdc-icon-size:calc(var(--u)*56); }
.txt { min-width:0; }
.tile .name { font-size:calc(var(--u)*29*var(--k)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.1; }
.tile .val { font-size:calc(var(--u)*21*var(--k)); color:var(--sub, var(--e-sub)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.empty { color:var(--e-sub); text-align:center; padding:40px 10px; flex:1; font-size:14px; }
.props label { display:block; font-size:12px; color:var(--secondary-text-color); margin:12px 0 4px; }
.row { display:flex; align-items:center; gap:8px; }
.row input[type=color] { width:44px; height:34px; border:0; background:none; padding:0; }
.check { display:flex; align-items:center; gap:10px; margin:10px 0; cursor:pointer; }
.check input { width:18px; height:18px; accent-color:${AMBER}; }
.seg { display:flex; gap:6px; }
.seg button.on { background:${AMBER}; color:#1c1206; }
.thumb { width:64px; height:64px; border-radius:10px; object-fit:cover; background:var(--secondary-background-color); }
.hint { font-size:12px; color:var(--secondary-text-color); line-height:1.4; }
.error { background:#b71c1c; color:#fff; padding:8px 12px; border-radius:8px; margin:0 16px; }
.actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
`;

class EchoStudioPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._loaded = false;
    this._items = [];         // die Gestaltung: Überschriften und Karten
    this._registry = [];      // Entitäten aus Home Assistants Registry (für die Anzeige)
    this._areas = {};
    this._devices = {};
    this._labelId = null;     // die ID des Labels „echo“, sobald es das gibt
    this._selected = null;    // die gewählte Karte (Entität) oder Überschrift ("#<index>")
    this._dirty = false;
    this._busy = false;
    this._error = "";
    this._filter = { text: "", area: "", domain: "", only: false };
    this._signed = {};        // Bilddatei -> signierte Adresse
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._load();
    else if (this._loaded && !this._busy) this._renderPreviewOnly();
  }

  set panel(panel) { this._config = (panel && panel.config) || {}; }
  set narrow(_) {}

  get _label() { return this._config?.label || "echo"; }

  async _load() {
    try {
      const ws = (msg) => this._hass.callWS(msg);
      const [ents, areas, devices, labels, layout] = await Promise.all([
        ws({ type: "config/entity_registry/list_for_display" }),
        ws({ type: "config/area_registry/list" }),
        ws({ type: "config/device_registry/list" }),
        ws({ type: "config/label_registry/list" }),
        ws({ type: "echo_studio/layout/get" }),
      ]);
      this._registry = ents.entities || [];
      this._areas = Object.fromEntries(areas.map((a) => [a.area_id, a]));
      this._devices = Object.fromEntries(devices.map((d) => [d.id, d]));
      const label = labels.find((l) => l.label_id === this._label || (l.name || "").toLowerCase() === this._label);
      this._labelId = label ? label.label_id : null;
      this._items = (layout.items || []).map((i) => ({ ...i }));
      this._syncWithLabels();
      this._loaded = true;
    } catch (err) {
      this._error = "Laden fehlgeschlagen: " + (err.message || err);
    }
    this._render();
  }

  // Die Karten folgen dem Label: was es trägt und noch keine Karte hat, kommt hinten dazu; eine
  // Karte ohne Label fällt weg.
  _syncWithLabels() {
    const labeled = new Set(this._registry.filter((e) => this._hasLabel(e)).map((e) => e.ei));
    const before = this._items.length;
    this._items = this._items.filter((i) => i.heading !== undefined || labeled.has(i.entity));
    const have = new Set(this._items.map((i) => i.entity));
    for (const id of labeled) if (!have.has(id)) this._items.push({ entity: id, size: "1x1" });
    if (this._items.length !== before) this._dirty = true;
  }

  _hasLabel(e) { return !!this._labelId && (e.lb || []).includes(this._labelId); }

  _areaOf(e) {
    const a = e.ai || (e.di && this._devices[e.di] ? this._devices[e.di].area_id : null);
    return a && this._areas[a] ? this._areas[a].name : "";
  }

  _friendly(id) {
    const st = this._hass.states[id];
    return (st && st.attributes.friendly_name) || id;
  }

  _defaultIcon(id) {
    const st = this._hass.states[id];
    if (st && st.attributes.icon) return st.attributes.icon;
    return DOMAIN_ICONS[id.split(".")[0]] || "mdi:circle-outline";
  }

  _isOn(id) {
    const s = this._hass.states[id]?.state;
    return ["on", "open", "playing", "unlocked", "heat", "cool", "heat_cool", "home"].includes(s);
  }

  _stateText(id) {
    const st = this._hass.states[id];
    if (!st) return "Nicht verfügbar";
    if (id.startsWith("sensor.") && typeof this._hass.formatEntityState === "function") {
      try { return this._hass.formatEntityState(st); } catch (_) { /* wie unten */ }
    }
    const domain = id.split(".")[0];
    if (domain === "scene") return "Szene";
    if (domain === "script") return "Skript";
    const words = { on: "An", off: "Aus", open: "Offen", closed: "Geschlossen", opening: "Öffnet", closing: "Schließt",
      playing: "Spielt", paused: "Pausiert", idle: "Bereit", standby: "Bereitschaft", locked: "Verriegelt",
      unlocked: "Entriegelt", heat: "Heizen", cool: "Kühlen", heat_cool: "Heizen/Kühlen", auto: "Automatisch",
      dry: "Entfeuchten", fan_only: "Lüften", home: "Zuhause", not_home: "Abwesend",
      unavailable: "Nicht verfügbar", unknown: "–" };
    let t = words[st.state] || st.state;
    if (domain === "climate" && typeof st.attributes.current_temperature === "number") t += ` · ${st.attributes.current_temperature} °C`;
    if (st.state === "on" && typeof st.attributes.brightness === "number") t += ` · ${Math.round((st.attributes.brightness / 255) * 100)} %`;
    if (st.attributes.unit_of_measurement && !words[st.state]) t += ` ${st.attributes.unit_of_measurement}`;
    return t;
  }

  async _ensureLabel() {
    if (this._labelId) return this._labelId;
    const created = await this._hass.callWS({ type: "config/label_registry/create", name: this._label, icon: "mdi:tablet", color: "amber" });
    this._labelId = created.label_id;
    return this._labelId;
  }

  // Ein Haken in der Geräteliste: setzt oder nimmt das Label, sofort in Home Assistant.
  async _toggleDevice(entityId, on) {
    const entry = this._registry.find((e) => e.ei === entityId);
    if (!entry) return;
    this._busy = true;
    try {
      const label = await this._ensureLabel();
      const labels = new Set(entry.lb || []);
      if (on) labels.add(label); else labels.delete(label);
      await this._hass.callWS({ type: "config/entity_registry/update", entity_id: entityId, labels: [...labels] });
      entry.lb = [...labels];
      this._syncWithLabels();
      if (!on && this._selected === entityId) this._selected = null;
      this._error = "";
    } catch (err) {
      this._error = "Label konnte nicht gesetzt werden: " + (err.message || err);
    }
    this._busy = false;
    this._render();
  }

  async _save() {
    this._busy = true;
    this._render();
    try {
      const saved = await this._hass.callWS({ type: "echo_studio/layout/save", layout: { version: 1, items: this._items } });
      this._items = saved.items.map((i) => ({ ...i }));
      this._dirty = false;
      this._error = "";
    } catch (err) {
      this._error = "Speichern fehlgeschlagen: " + (err.message || err);
    }
    this._busy = false;
    this._render();
  }

  _item(sel) {
    if (sel == null) return null;
    if (sel.startsWith("#")) return this._items[Number(sel.slice(1))] || null;
    return this._items.find((i) => i.entity === sel) || null;
  }

  _change(patch) {
    const item = this._item(this._selected);
    if (!item) return;
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === false || v == null) delete item[k]; else item[k] = v;
    }
    this._dirty = true;
    this._render();
  }

  _move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= this._items.length) return;
    const [it] = this._items.splice(from, 1);
    this._items.splice(to > from ? to - 1 : to, 0, it);
    this._dirty = true;
    this._render();
  }

  // Ein Bild: auf dem Gerät verkleinert (ein Icon auf 192, ein Bild auf 960 Pixel), dann hochgeladen.
  async _upload(file, key) {
    const max = key === "icon_image" ? 192 : 960;
    try {
      this._busy = true;
      this._render();
      let type = "image/png", data;
      if (file.type === "image/svg+xml") {
        type = file.type;
        data = btoa(unescape(encodeURIComponent(await file.text())));
      } else {
        const bmp = await createImageBitmap(file);
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * k);
        c.height = Math.round(bmp.height * k);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        type = key === "icon_image" ? "image/png" : "image/jpeg";
        data = c.toDataURL(type, 0.85).split(",")[1];
      }
      const res = await this._hass.callWS({ type: "echo_studio/image/upload", content_type: type, data });
      this._busy = false;
      this._change({ [key]: res.file });
    } catch (err) {
      this._busy = false;
      this._error = "Bild konnte nicht hochgeladen werden: " + (err.message || err);
      this._render();
    }
  }

  // Eigene Bilder liegen hinter der Anmeldung: die Oberfläche zeigt sie über signierte Adressen.
  _url(file) {
    if (!file) return "";
    if (this._signed[file]) return this._signed[file];
    this._signed[file] = "";
    this._hass.callWS({ type: "auth/sign_path", path: `${this._config?.files_url || "/api/echo_studio/file"}/${file}`, expires: 3600 })
      .then((r) => { this._signed[file] = r.path; this._render(); })
      .catch(() => {});
    return "";
  }

  _esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // --- Zeichnen ----------------------------------------------------------------------------------

  _render() {
    if (!this.shadowRoot) return;
    const r = this.shadowRoot;
    const scroll = [...r.querySelectorAll(".pane")].map((p) => p.scrollTop);
    r.innerHTML = `<style>${css}</style>
      <div class="top">
        <h1>Echo Studio</h1>
        <span class="state">${this._busy ? "Einen Moment …" : this._dirty ? "Nicht gespeichert" : this._loaded ? "Gespeichert" : ""}</span>
        <button class="primary" id="save" ${!this._dirty || this._busy ? "disabled" : ""}>Speichern</button>
      </div>
      ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ""}
      ${this._loaded ? `<div class="main">
        <div class="pane" id="devpane">${this._devicesHtml()}</div>
        <div class="pane"><h2>Vorschau der Echo Show</h2><div class="screen"><div class="page" id="grid">${this._previewHtml()}</div></div>
          <div class="actions"><button id="addheading">+ Überschrift</button>
          <span class="hint">Karten ziehen zum Sortieren, antippen zum Gestalten. Die Echo Show zeigt die neue Gestaltung gleich nach dem Speichern. Überschriften teilen die Karten in Abschnitte; die Echo Show verteilt sie auf zwei Spalten. Steht sie auf „Fill the screen“, legt sie bis zu neun Karten groß über den ganzen Bildschirm und lässt Überschriften und Größen weg.</span></div></div>
        <div class="pane props" id="props">${this._propsHtml()}</div>
      </div>` : `<div class="pane" style="margin:16px">Lade …</div>`}`;
    [...r.querySelectorAll(".pane")].forEach((p, i) => { if (scroll[i]) p.scrollTop = scroll[i]; });
    this._wire();
  }

  _renderPreviewOnly() {
    const grid = this.shadowRoot && this.shadowRoot.getElementById("grid");
    if (!grid) return;
    grid.innerHTML = this._previewHtml();
    this._wireGrid();
  }

  _devicesHtml() {
    const f = this._filter;
    const areas = [...new Set(this._registry.map((e) => this._areaOf(e)).filter(Boolean))].sort();
    const domains = [...new Set(this._registry.map((e) => e.ei.split(".")[0]))].filter((d) => DOMAIN_NAMES[d]).sort();
    const text = f.text.toLowerCase();
    const rows = this._registry.filter((e) => {
      const d = e.ei.split(".")[0];
      if (!DOMAIN_NAMES[d] || e.hb || e.ec != null) return false;
      if (f.domain && d !== f.domain) return false;
      if (f.area && this._areaOf(e) !== f.area) return false;
      if (f.only && !this._hasLabel(e)) return false;
      if (text && !(this._friendly(e.ei).toLowerCase().includes(text) || e.ei.includes(text))) return false;
      return true;
    });
    const groups = {};
    for (const e of rows) (groups[this._areaOf(e) || "Ohne Raum"] ||= []).push(e);
    const count = this._registry.filter((e) => this._hasLabel(e)).length;
    let html = `<h2>Geräte auf der Echo Show <small>(${count})</small></h2>
      <input type="search" id="q" placeholder="Suchen …" value="${this._esc(f.text)}">
      <div class="filters">
        <select id="area"><option value="">Alle Räume</option>${areas.map((a) => `<option ${a === f.area ? "selected" : ""}>${this._esc(a)}</option>`).join("")}</select>
        <select id="domain"><option value="">Alle Arten</option>${domains.map((d) => `<option value="${d}" ${d === f.domain ? "selected" : ""}>${DOMAIN_NAMES[d]}</option>`).join("")}</select>
      </div>
      <label class="check"><input type="checkbox" id="only" ${f.only ? "checked" : ""}> Nur ausgewählte zeigen</label>`;
    for (const name of Object.keys(groups).sort((a, b) => (a === "Ohne Raum") - (b === "Ohne Raum") || a.localeCompare(b))) {
      html += `<div class="group">${this._esc(name)}</div>`;
      for (const e of groups[name].sort((a, b) => this._friendly(a.ei).localeCompare(this._friendly(b.ei)))) {
        html += `<label class="dev" data-entity="${e.ei}"><input type="checkbox" ${this._hasLabel(e) ? "checked" : ""} ${this._busy ? "disabled" : ""}>
          <ha-icon icon="${this._esc(this._defaultIcon(e.ei))}"></ha-icon>
          <span class="n"><div>${this._esc(this._friendly(e.ei))}</div><small>${e.ei}</small></span></label>`;
      }
    }
    if (!rows.length) html += `<p class="hint">Nichts gefunden.</p>`;
    return html;
  }

  // Die Abschnitte: eine Überschrift beginnt einen, was davor steht, ist einer ohne Überschrift.
  _sections() {
    const out = [];
    let cur = { heading: null, idx: -1, items: [] };
    this._items.forEach((it, idx) => {
      if (it.heading !== undefined) {
        if (cur.items.length || cur.heading !== null) out.push(cur);
        cur = { heading: it.heading, idx, items: [] };
      } else cur.items.push({ it, idx });
    });
    if (cur.items.length || cur.heading !== null) out.push(cur);
    return out;
  }

  // Wie hoch ein Abschnitt auf der Echo Show wird (in ihren Einheiten), um ihn wie sie in die
  // kürzere der beiden Spalten zu legen.
  _sectionHeight(sec, th = 84) {
    let h = sec.heading !== null ? 46 + 12 : 0;
    let col = 0, line = 0, lines = 0;
    for (const { it } of sec.items) {
      const size = it.size || "1x1", span = size === "1x1" ? 1 : 2, n = size === "2x2" ? 2 : 1;
      if (col > 0 && col + span > 2) { lines += line + 12; col = 0; line = 0; }
      line = Math.max(line, n * th + (n - 1) * 12);
      col += span;
      if (col >= 2) { lines += line + 12; col = 0; line = 0; }
    }
    if (col > 0) lines += line + 12;
    return h + lines;
  }

  // Die Einstellungen der Echo Show, die bestimmen, wie sie das Dashboard legt: „Dashboard tiles“
  // (Normal, Large, Fill the screen). Gelesen aus ihrer Entität in Home Assistant.
  _echoTiles() {
    const id = Object.keys(this._hass.states).find((e) => /^select\..*_dashboard_tiles$/.test(e));
    const v = id ? this._hass.states[id].state : "";
    return v === "Fill the screen" ? "fill" : v === "Large" ? "large" : "";
  }

  _previewHtml() {
    const secs = this._sections();
    if (!secs.length) return `<div class="empty">Noch keine Karten. Hake links die Geräte an, die auf der Echo Show erscheinen sollen.</div>`;
    const mode = this._echoTiles();
    const tiles = secs.flatMap((s) => s.items);
    // Fill the screen: bis zu neun Karten über den ganzen Bildschirm, Überschriften und Größen gelten
    // dann nicht (drawn_fill.go).
    if (mode === "fill" && tiles.length && tiles.length <= 9) {
      const n = tiles.length, cols = n <= 1 ? 1 : n === 2 || n === 4 ? 2 : 3, rows = Math.ceil(n / cols);
      const tw = (920 - 12 * (cols - 1)) / cols, th = (560 - 12 * (rows - 1)) / rows;
      const k = Math.min(th / 84, tw / 220, 2.5);
      return `<div class="fill" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">
        ${tiles.map(({ it, idx }) => this._tileHtml(it, idx, k >= 1.05 ? k : 1, true)).join("")}</div>`;
    }
    const large = mode === "large";
    const ncols = large ? Math.max(1, Math.min(2, secs.length)) : 2;
    const cols = Array.from({ length: ncols }, () => []), heights = new Array(ncols).fill(0);
    for (const sec of secs) {
      let c = 0;
      heights.forEach((h, i) => { if (h < heights[c]) c = i; });
      cols[c].push(sec);
      heights[c] += this._sectionHeight(sec, large ? 126 : 84) + 12;
    }
    const k = large ? Math.min(126 / 84, (ncols === 1 ? 454 : 221) / 220) : 1;
    return cols.map((col) => `<div class="col">${col.map((sec) => `<div class="sec">
      ${sec.heading !== null ? `<div class="heading ${this._selected === "#" + sec.idx ? "sel" : ""}" draggable="true" data-idx="${sec.idx}" data-sel="#${sec.idx}">${this._esc(sec.heading)}</div>` : ""}
      ${sec.items.length ? `<div class="tiles" style="--th:${large ? 126 : 84}">${sec.items.map(({ it, idx }) => this._tileHtml(it, idx, k >= 1.05 ? k : 1)).join("")}</div>` : ""}</div>`).join("")}</div>`).join("");
  }

  // Eine Karte, wie die Echo Show sie zeichnet (drawn_cards.go tile, drawn_studio_ottoman.go): dunkel,
  // ein runder Kreis ums Symbol, der leuchtet, wenn sie an ist; mit eigener Farbe die ganze Karte in
  // ihr, mit Bild das Bild und unten dunkler.
  _tileHtml(it, idx, k = 1, filled = false) {
    const on = this._isOn(it.entity);
    const size = filled ? "1x1" : it.size || "1x1";
    const fill = on ? it.color_on : it.color_off;
    const img = it.image ? this._url(it.image) : "";
    const icoImg = it.icon_image ? this._url(it.icon_image) : "";
    const plain = !!(fill || it.image);
    const vars = [];
    let ink = "#8a7d6c";
    if (it.image) {
      vars.push(`background-image:url('${img}')`, "color:#fff", "--sub:#e8e8e8");
      if (on) vars.push(`--shade:${this._half(it.color_on || AMBER)}`);
      ink = "#fff";
    } else if (fill) {
      const dark = this._luma(fill) < 140;
      ink = dark ? "#fff" : "#1c1206";
      vars.push(`background:${fill}`, `color:${ink}`, `--sub:${dark ? "rgba(255,255,255,.75)" : "rgba(28,18,6,.75)"}`);
    } else {
      const tint = it.color_on || (on ? "var(--e-active)" : "");
      if (tint) { ink = tint; vars.push(`--badge:color-mix(in srgb, var(--e-card) 78%, ${tint})`); }
    }
    vars.push(`--ink:${ink}`, `--k:${k.toFixed(3)}`);
    const solo = it.hide_name && it.hide_state;
    const icon = icoImg ? `<img src="${icoImg}">` : `<ha-icon icon="${this._esc(it.icon || this._defaultIcon(it.entity))}"></ha-icon>`;
    return `<div class="tile ${size !== "1x1" ? "w2" : ""} ${size === "2x2" ? "h2" : ""} ${solo ? "solo" : ""} ${this._selected === it.entity ? "sel" : ""}"
        draggable="true" data-idx="${idx}" data-sel="${it.entity}" style="${vars.join(";")}">
      ${it.image ? `<div class="shade"></div>` : ""}
      <div class="badge ${plain || icoImg ? "plain" : ""}">${icon}</div>
      ${solo ? "" : `<div class="txt">${it.hide_name ? "" : `<div class="name">${this._esc(it.name || this._friendly(it.entity))}</div>`}
        ${it.hide_state ? "" : `<div class="val">${this._esc(this._stateText(it.entity))}</div>`}</div>`}</div>`;
  }

  _rgb(hex) { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  _luma(hex) { const [r, g, b] = this._rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; }
  _mix(a, b, t) { const x = this._rgb(a), y = this._rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; }
  _half(hex) { const [r, g, b] = this._rgb(hex); return `rgba(${r >> 1},${g >> 1},${b >> 1},.67)`; }

  _propsHtml() {
    const it = this._item(this._selected);
    if (!it) return `<h2>Karte</h2><p class="hint">Tippe in der Vorschau auf eine Karte oder Überschrift, um sie zu gestalten.</p>`;
    const idx = this._items.indexOf(it);
    const nav = `<div class="actions"><button id="up" ${idx === 0 ? "disabled" : ""}>Nach vorne</button>
      <button id="down" ${idx === this._items.length - 1 ? "disabled" : ""}>Nach hinten</button></div>`;
    if (it.heading !== undefined) {
      return `<h2>Überschrift</h2><label>Text</label><input type="text" id="heading" value="${this._esc(it.heading)}">${nav}
        <div class="actions"><button id="delheading">Überschrift entfernen</button></div>`;
    }
    const icoImg = it.icon_image ? this._url(it.icon_image) : "";
    const img = it.image ? this._url(it.image) : "";
    return `<h2>${this._esc(this._friendly(it.entity))}</h2><div class="hint">${it.entity}</div>
      <label>Name</label><input type="text" id="name" placeholder="${this._esc(this._friendly(it.entity))}" value="${this._esc(it.name || "")}">
      <label>Symbol</label><div id="iconpicker"></div>
      <label>Eigenes Icon (Bild)</label><div class="row">${icoImg ? `<img class="thumb" src="${icoImg}" style="object-fit:contain">` : ""}
        <button id="pickicon">${it.icon_image ? "Ändern" : "Hochladen"}</button>${it.icon_image ? `<button class="link" id="clearicon">Entfernen</button>` : ""}</div>
      <label>Hintergrundbild</label><div class="row">${img ? `<img class="thumb" src="${img}">` : ""}
        <button id="pickimage">${it.image ? "Ändern" : "Hochladen"}</button>${it.image ? `<button class="link" id="clearimage">Entfernen</button>` : ""}</div>
      <label>Farbe, wenn an</label><div class="row"><input type="color" id="color_on" value="${it.color_on || AMBER}">
        ${it.color_on ? `<button class="link" id="reset_on">Zurücksetzen</button>` : `<span class="hint">Standardfarbe</span>`}</div>
      <label>Farbe, wenn aus</label><div class="row"><input type="color" id="color_off" value="${it.color_off || "#3A3029"}">
        ${it.color_off ? `<button class="link" id="reset_off">Zurücksetzen</button>` : `<span class="hint">Standardfarbe</span>`}</div>
      <label class="check"><input type="checkbox" id="hide_name" ${it.hide_name ? "checked" : ""}> Name ausblenden</label>
      <label class="check"><input type="checkbox" id="hide_state" ${it.hide_state ? "checked" : ""}> Zustand ausblenden</label>
      <label>Größe</label><div class="seg">${SIZES.map(([v, t]) => `<button data-size="${v}" class="${(it.size || "1x1") === v ? "on" : ""}">${t}</button>`).join("")}</div>
      ${nav}
      <input type="file" id="iconfile" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden>
      <input type="file" id="imagefile" accept="image/*" hidden>`;
  }

  // --- Ereignisse --------------------------------------------------------------------------------

  _wire() {
    const r = this.shadowRoot;
    const on = (id, ev, fn) => { const el = r.getElementById(id); if (el) el.addEventListener(ev, fn); };
    on("save", "click", () => this._save());
    on("q", "input", (e) => { this._filter.text = e.target.value; this._refreshDevices(); });
    on("area", "change", (e) => { this._filter.area = e.target.value; this._render(); });
    on("domain", "change", (e) => { this._filter.domain = e.target.value; this._render(); });
    on("only", "change", (e) => { this._filter.only = e.target.checked; this._render(); });
    this._wireDevices();
    on("addheading", "click", () => {
      this._items.unshift({ heading: "Neue Überschrift" });
      this._selected = "#0";
      this._dirty = true;
      this._render();
    });
    this._wireGrid();

    const it = this._item(this._selected);
    if (!it) return;
    const idx = this._items.indexOf(it);
    on("up", "click", () => { this._move(idx, idx - 1); this._reselect(it); });
    on("down", "click", () => { this._move(idx, idx + 2); this._reselect(it); });
    if (it.heading !== undefined) {
      on("heading", "change", (e) => { it.heading = e.target.value.trim() || "Überschrift"; this._dirty = true; this._render(); });
      on("delheading", "click", () => { this._items.splice(idx, 1); this._selected = null; this._dirty = true; this._render(); });
      return;
    }
    on("name", "change", (e) => this._change({ name: e.target.value.trim() }));
    on("color_on", "change", (e) => this._change({ color_on: e.target.value.toUpperCase() }));
    on("color_off", "change", (e) => this._change({ color_off: e.target.value.toUpperCase() }));
    on("reset_on", "click", () => this._change({ color_on: "" }));
    on("reset_off", "click", () => this._change({ color_off: "" }));
    on("hide_name", "change", (e) => this._change({ hide_name: e.target.checked }));
    on("hide_state", "change", (e) => this._change({ hide_state: e.target.checked }));
    on("pickicon", "click", () => r.getElementById("iconfile").click());
    on("pickimage", "click", () => r.getElementById("imagefile").click());
    on("clearicon", "click", () => this._change({ icon_image: "" }));
    on("clearimage", "click", () => this._change({ image: "" }));
    on("iconfile", "change", (e) => e.target.files[0] && this._upload(e.target.files[0], "icon_image"));
    on("imagefile", "change", (e) => e.target.files[0] && this._upload(e.target.files[0], "image"));
    r.querySelectorAll("[data-size]").forEach((b) => b.addEventListener("click", () => this._change({ size: b.dataset.size === "1x1" ? "" : b.dataset.size })));

    // Home Assistants eigene Symbolauswahl, mit Suche.
    const holder = r.getElementById("iconpicker");
    if (holder) {
      const picker = document.createElement("ha-icon-picker");
      picker.hass = this._hass;
      picker.value = it.icon || "";
      picker.placeholder = this._defaultIcon(it.entity);
      picker.addEventListener("value-changed", (e) => this._change({ icon: e.detail.value || "" }));
      holder.appendChild(picker);
    }
  }

  _reselect(it) { this._selected = it.heading !== undefined ? "#" + this._items.indexOf(it) : it.entity; this._render(); }

  _refreshDevices() {
    const pane = this.shadowRoot.getElementById("devpane");
    if (!pane) return;
    const q = pane.querySelector("#q");
    const caret = q ? q.selectionStart : 0;
    pane.innerHTML = this._devicesHtml();
    const nq = pane.querySelector("#q");
    nq.focus();
    nq.setSelectionRange(caret, caret);
    nq.addEventListener("input", (e) => { this._filter.text = e.target.value; this._refreshDevices(); });
    pane.querySelector("#area").addEventListener("change", (e) => { this._filter.area = e.target.value; this._render(); });
    pane.querySelector("#domain").addEventListener("change", (e) => { this._filter.domain = e.target.value; this._render(); });
    pane.querySelector("#only").addEventListener("change", (e) => { this._filter.only = e.target.checked; this._render(); });
    this._wireDevices();
  }

  _wireDevices() {
    this.shadowRoot.querySelectorAll(".dev input").forEach((box) => {
      box.addEventListener("change", (e) => this._toggleDevice(e.target.closest(".dev").dataset.entity, e.target.checked));
    });
  }

  _wireGrid() {
    const r = this.shadowRoot;
    let dragFrom = -1;
    r.querySelectorAll("#grid [data-idx]").forEach((el) => {
      el.addEventListener("click", () => { this._selected = el.dataset.sel; this._render(); });
      el.addEventListener("dragstart", (e) => { dragFrom = Number(el.dataset.idx); e.dataTransfer.effectAllowed = "move"; });
      el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop"); });
      el.addEventListener("dragleave", () => el.classList.remove("drop"));
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("drop");
        const it = this._items[dragFrom];
        this._move(dragFrom, Number(el.dataset.idx));
        if (it) this._reselect(it);
      });
    });
  }
}

customElements.define("echo-studio-panel", EchoStudioPanel);
