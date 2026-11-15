// Echo Studio: die Karten der Echo Show gestalten. Eine Seite in der Seitenleiste von Home Assistant,
// ohne Bauschritt: ein Web Component, das Home Assistant mit `hass` versorgt.
//
// Links die Geräte (ein Haken setzt das Label „echo“), in der Mitte die Vorschau im Format der Echo
// Show (Karten ziehen zum Sortieren, antippen zum Bearbeiten), rechts die gewählte Karte: Name,
// Symbol, eigenes Icon, Bild, Farben, Texte ausblenden, Größe. „Speichern“ legt die Gestaltung in
// Home Assistant ab; die Echo Show lädt sie gleich danach neu.
//
// Gezeichnet wird in Teilen: das Gerüst einmal, dann Kopfzeile, Geräteliste, Vorschau und
// Eigenschaften je für sich, nur wenn sich bei ihnen etwas ändert. Home Assistant meldet jede
// Zustandsänderung im Haus; die Vorschau folgt nur denen ihrer Karten, gebündelt, und nie mitten im
// Ziehen.

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
const INK = "#1c1206";          // Schrift auf einer hellen Karte
const MAX_ROWS = 200;           // so viele Geräte zeigt die Liste auf einmal
const PREVIEW_DELAY = 400;      // Zustandsänderungen sammeln, bevor die Vorschau sie zeigt (ms)

const css = `
:host { display:block; height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
  font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
* { box-sizing:border-box; }
.top { display:flex; align-items:center; gap:12px; padding:10px 16px; background:var(--app-header-background-color, var(--primary-color));
  color:var(--app-header-text-color, #fff); min-height:56px; }
.top h1 { font-size:20px; font-weight:400; margin:0; flex:1; }
.top .state { font-size:13px; opacity:.85; }
.top button { background:rgba(255,255,255,.15); color:inherit; }
.top button.primary { background:${AMBER}; color:${INK}; }
button { border:0; border-radius:18px; padding:8px 16px; font:inherit; cursor:pointer;
  background:var(--secondary-background-color); color:var(--primary-text-color); }
button.primary { background:${AMBER}; color:${INK}; font-weight:500; }
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
/* Eine Karte wie die Kacheln im Seitenfenster der Echo Show (drawer_ottoman_tiles.go,
   drawn_studio_ottoman.go): das Symbol oben links, der Zustand oben rechts, der Name unten;
   eingeschaltet leuchtet die ganze Karte. */
.tile { --k:1; --pad:calc(var(--u)*13*var(--k)); --fill:var(--e-card); --fg:var(--e-text); --soft:var(--e-sub);
  --ic:color-mix(in srgb, var(--e-sub) 50%, var(--e-text));
  position:relative; border-radius:calc(var(--e-rad)*1.2); color:var(--fg); cursor:grab; overflow:hidden;
  background:linear-gradient(180deg, color-mix(in srgb, var(--fill) 93%, #fff), color-mix(in srgb, var(--fill) 93%, #000));
  box-shadow:0 calc(var(--u)*3) calc(var(--u)*10) rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08); }
.tile.on { --fill:var(--e-active); --fg:var(--on-ink, ${INK}); --soft:var(--on-ink, ${INK}); --ic:var(--on-ink, ${INK}); }
.tile.pic { background-size:cover; background-position:center; }
.tile.w2 { grid-column:span 2; } .tile.h2 { grid-row:span 2; }
.tile.sel { outline:3px solid #fff; outline-offset:2px; }
.tile.drop, .heading.drop { box-shadow:calc(var(--u)*-6) 0 0 0 ${AMBER}; }
.tile.dragging { opacity:.4; }
.tile .shade { position:absolute; inset:0; background:linear-gradient(180deg, transparent 35%, var(--shade, rgba(0,0,0,.63))); pointer-events:none; }
.tile .ico { position:absolute; left:var(--pad); top:var(--pad); width:calc(var(--u)*30*var(--k)); height:calc(var(--u)*30*var(--k));
  display:flex; align-items:center; justify-content:center; color:var(--ic); pointer-events:none; }
.tile .ico ha-icon { --mdc-icon-size:calc(var(--u)*30*var(--k)); }
.tile .ico img { width:100%; height:100%; object-fit:contain; }
.tile.solo .ico { left:50%; top:50%; transform:translate(-50%,-50%); width:calc(var(--u)*var(--side)); height:calc(var(--u)*var(--side)); }
.tile.solo .ico ha-icon { --mdc-icon-size:calc(var(--u)*var(--side)*.75); }
.tile .val { position:absolute; right:var(--pad); top:var(--pad); height:calc(var(--u)*30*var(--k)); line-height:calc(var(--u)*30*var(--k));
  max-width:calc(100% - 2*var(--pad) - var(--u)*40*var(--k)); font-size:calc(var(--u)*21*var(--k)); color:var(--soft);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; }
.tile .name { position:absolute; left:var(--pad); right:var(--pad); bottom:calc(var(--u)*10*var(--k)); font-size:calc(var(--u)*25*var(--k));
  line-height:1.12; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; }
.tile.two .name { white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.empty { color:var(--e-sub); text-align:center; padding:40px 10px; flex:1; font-size:14px; }
.props label { display:block; font-size:12px; color:var(--secondary-text-color); margin:12px 0 4px; }
.row { display:flex; align-items:center; gap:8px; }
.row input[type=color] { width:44px; height:34px; border:0; background:none; padding:0; }
.check { display:flex; align-items:center; gap:10px; margin:10px 0; cursor:pointer; }
.check input { width:18px; height:18px; accent-color:${AMBER}; }
.seg { display:flex; gap:6px; }
.seg button.on { background:${AMBER}; color:${INK}; }
.thumb { width:64px; height:64px; border-radius:10px; object-fit:cover; background:var(--secondary-background-color); }
.hint { font-size:12px; color:var(--secondary-text-color); line-height:1.4; }
.error { background:#b71c1c; color:#fff; padding:8px 12px; border-radius:8px; margin:0 16px; }
.error:empty { display:none; }
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
    this._sig = "";           // die Zustände der Karten, wie die Vorschau sie zuletzt zeigte
    this._timer = null;       // eine aufgeschobene Vorschau
    this._dragFrom = -1;      // die Karte, die gerade gezogen wird
    this._dropEl = null;
    this._stale = false;      // die Vorschau ist veraltet, zeichnen, sobald das Ziehen endet
    this._tilesEntity = undefined; // select.*_dashboard_tiles der Echo Show ("" = keine gefunden)
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) { this._load(); return; }
    if (!this._loaded) return;
    const sig = this._stateSig();
    if (sig !== this._sig) this._previewSoon();
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

  // Was die Vorschau von Home Assistant zeigt: die Zustände ihrer Karten und wie die Echo Show ihr
  // Dashboard legt. Ändert sich daran nichts, bleibt die Vorschau, wie sie ist.
  _stateSig() {
    const st = this._hass.states;
    let sig = this._echoTiles();
    for (const it of this._items) {
      if (it.entity) { const s = st[it.entity]; sig += "|" + (s ? s.state + s.last_updated : ""); }
    }
    return sig;
  }

  async _ensureLabel() {
    if (this._labelId) return this._labelId;
    const created = await this._hass.callWS({ type: "config/label_registry/create", name: this._label, icon: "mdi:tablet", color: "amber" });
    this._labelId = created.label_id;
    return this._labelId;
  }

  // Ein Haken in der Geräteliste: setzt oder nimmt das Label, sofort in Home Assistant.
  async _toggleDevice(entityId, on, box) {
    const entry = this._registry.find((e) => e.ei === entityId);
    if (!entry) return;
    this._busy = true;
    if (box) box.disabled = true;
    this._renderTop();
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
      if (box) box.checked = !on;
    }
    this._busy = false;
    if (box) box.disabled = false;
    this._renderTop();
    this._renderCount();
    if (this._filter.only) this._renderDeviceList();
    this._renderPreview();
    this._renderProps();
  }

  async _save() {
    this._busy = true;
    this._renderTop();
    try {
      const saved = await this._hass.callWS({ type: "echo_studio/layout/save", layout: { version: 1, items: this._items } });
      this._items = saved.items.map((i) => ({ ...i }));
      this._dirty = false;
      this._error = "";
    } catch (err) {
      this._error = "Speichern fehlgeschlagen: " + (err.message || err);
    }
    this._busy = false;
    this._renderTop();
    this._renderPreview();
    this._renderProps();
  }

  _item(sel) {
    if (sel == null) return null;
    if (sel.startsWith("#")) return this._items[Number(sel.slice(1))] || null;
    return this._items.find((i) => i.entity === sel) || null;
  }

  // Ändert die gewählte Karte. props: auch die Eigenschaften neu zeichnen (nicht nötig, wenn die
  // Änderung aus einem Feld kommt, das schon zeigt, was gilt).
  _change(patch, props = true) {
    const item = this._item(this._selected);
    if (!item) return;
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === false || v == null) delete item[k]; else item[k] = v;
    }
    this._edited(props);
  }

  // Nach einer Änderung an der Gestaltung: Kopfzeile und Vorschau, und wenn gewünscht die Eigenschaften.
  _edited(props = true) {
    this._dirty = true;
    this._renderTop();
    this._renderPreview();
    if (props) this._renderProps();
  }

  _move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= this._items.length) return false;
    const [it] = this._items.splice(from, 1);
    this._items.splice(to > from ? to - 1 : to, 0, it);
    return true;
  }

  // Wählt die Karte oder Überschrift it, nachdem sie sich bewegt hat (ihr Index ist ein anderer).
  _select(it) { this._selected = it.heading !== undefined ? "#" + this._items.indexOf(it) : it.entity; }

  // Ein Bild: auf dem Gerät verkleinert (ein Icon auf 192, ein Bild auf 960 Pixel), dann hochgeladen.
  async _upload(file, key) {
    const max = key === "icon_image" ? 192 : 960;
    try {
      this._busy = true;
      this._renderTop();
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
      this._renderTop();
    }
  }

  // Eigene Bilder liegen hinter der Anmeldung: die Oberfläche zeigt sie über signierte Adressen.
  _url(file) {
    if (!file) return "";
    if (this._signed[file]) return this._signed[file];
    if (this._signed[file] === "") return "";
    this._signed[file] = "";
    this._hass.callWS({ type: "auth/sign_path", path: `${this._config?.files_url || "/api/echo_studio/file"}/${file}`, expires: 3600 })
      .then((r) => {
        this._signed[file] = r.path;
        this._renderPreview();
        const it = this._item(this._selected);
        if (it && (it.image === file || it.icon_image === file)) this._renderProps();
      })
      .catch(() => { delete this._signed[file]; });
    return "";
  }

  _esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  _el(id) { return this.shadowRoot && this.shadowRoot.getElementById(id); }

  // --- Zeichnen ----------------------------------------------------------------------------------

  // Das Gerüst, einmal nach dem Laden; die Teile zeichnen sich danach je für sich.
  _render() {
    const r = this.shadowRoot;
    r.innerHTML = `<style>${css}</style>
      <div class="top">
        <h1>Echo Studio</h1>
        <span class="state" id="state"></span>
        <button class="primary" id="save">Speichern</button>
      </div>
      <div class="error" id="error"></div>
      ${this._loaded ? `<div class="main">
        <div class="pane" id="devpane">${this._devicesHeadHtml()}<div id="devlist"></div></div>
        <div class="pane"><h2>Vorschau der Echo Show</h2><div class="screen"><div class="page" id="grid"></div></div>
          <div class="actions"><button id="addheading">+ Überschrift</button>
          <span class="hint">Karten ziehen zum Sortieren, antippen zum Gestalten. Die Echo Show zeigt die neue Gestaltung gleich nach dem Speichern. Überschriften teilen die Karten in Abschnitte; die Echo Show verteilt sie auf zwei Spalten. Steht sie auf „Fill the screen“, legt sie bis zu neun Karten groß über den ganzen Bildschirm und lässt Überschriften und Größen weg.</span></div></div>
        <div class="pane props" id="props"></div>
      </div>` : `<div class="pane" style="margin:16px">Lade …</div>`}`;
    this._wire();
    this._renderTop();
    if (!this._loaded) return;
    this._renderCount();
    this._renderDeviceList();
    this._renderPreview();
    this._renderProps();
  }

  _renderTop() {
    const state = this._el("state"), save = this._el("save"), error = this._el("error");
    if (state) state.textContent = this._busy ? "Einen Moment …" : this._dirty ? "Nicht gespeichert" : this._loaded ? "Gespeichert" : "";
    if (save) save.disabled = !this._dirty || this._busy;
    if (error) error.textContent = this._error;
  }

  // --- Geräteliste

  _devicesHeadHtml() {
    const f = this._filter;
    const areas = [...new Set(this._registry.map((e) => this._areaOf(e)).filter(Boolean))].sort();
    const domains = [...new Set(this._registry.map((e) => e.ei.split(".")[0]))].filter((d) => DOMAIN_NAMES[d]).sort();
    return `<h2>Geräte auf der Echo Show <small id="count"></small></h2>
      <input type="search" id="q" placeholder="Suchen …" value="${this._esc(f.text)}">
      <div class="filters">
        <select id="area"><option value="">Alle Räume</option>${areas.map((a) => `<option ${a === f.area ? "selected" : ""}>${this._esc(a)}</option>`).join("")}</select>
        <select id="domain"><option value="">Alle Arten</option>${domains.map((d) => `<option value="${d}" ${d === f.domain ? "selected" : ""}>${DOMAIN_NAMES[d]}</option>`).join("")}</select>
      </div>
      <label class="check"><input type="checkbox" id="only" ${f.only ? "checked" : ""}> Nur ausgewählte zeigen</label>`;
  }

  _renderCount() {
    const el = this._el("count");
    if (el) el.textContent = `(${this._registry.filter((e) => this._hasLabel(e)).length})`;
  }

  _renderDeviceList() {
    const list = this._el("devlist");
    if (!list) return;
    const f = this._filter;
    const text = f.text.toLowerCase();
    const named = [];
    for (const e of this._registry) {
      const d = e.ei.split(".")[0];
      if (!DOMAIN_NAMES[d] || e.hb || e.ec != null) continue;
      if (f.domain && d !== f.domain) continue;
      const area = this._areaOf(e);
      if (f.area && area !== f.area) continue;
      if (f.only && !this._hasLabel(e)) continue;
      const name = this._friendly(e.ei);
      if (text && !(name.toLowerCase().includes(text) || e.ei.includes(text))) continue;
      named.push({ e, name, area: area || "Ohne Raum" });
    }
    named.sort((a, b) => (a.area === "Ohne Raum") - (b.area === "Ohne Raum") || a.area.localeCompare(b.area)
      || this._hasLabel(b.e) - this._hasLabel(a.e) || a.name.localeCompare(b.name));
    let html = "", group = null;
    for (const { e, name, area } of named.slice(0, MAX_ROWS)) {
      if (area !== group) { html += `<div class="group">${this._esc(area)}</div>`; group = area; }
      html += `<label class="dev" data-entity="${e.ei}"><input type="checkbox" ${this._hasLabel(e) ? "checked" : ""}>
        <ha-icon icon="${this._esc(this._defaultIcon(e.ei))}"></ha-icon>
        <span class="n"><div>${this._esc(name)}</div><small>${e.ei}</small></span></label>`;
    }
    if (!named.length) html += `<p class="hint">Nichts gefunden.</p>`;
    else if (named.length > MAX_ROWS) html += `<p class="hint">${MAX_ROWS} von ${named.length} gezeigt. Suche oder filtere nach Raum oder Art, um die übrigen zu finden.</p>`;
    list.innerHTML = html;
  }

  // --- Vorschau

  // Zeichnet die Vorschau bald: Änderungen der Zustände kommen oft in Schüben; mitten im Ziehen gar
  // nicht, sondern erst, wenn es endet.
  _previewSoon() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this._renderPreview(); }, PREVIEW_DELAY);
  }

  _renderPreview() {
    const grid = this._el("grid");
    if (!grid) return;
    if (this._dragFrom >= 0) { this._stale = true; return; }
    this._stale = false;
    this._sig = this._stateSig();
    grid.innerHTML = this._previewHtml();
  }

  // Zeigt die Auswahl in der Vorschau, ohne sie neu zu zeichnen.
  _markSelected() {
    const grid = this._el("grid");
    if (!grid) return;
    grid.querySelectorAll(".sel").forEach((el) => el.classList.remove("sel"));
    if (this._selected == null) return;
    grid.querySelectorAll("[data-sel]").forEach((el) => { if (el.dataset.sel === this._selected) el.classList.add("sel"); });
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
    if (this._tilesEntity === undefined) {
      this._tilesEntity = Object.keys(this._hass.states).find((e) => /^select\..*_dashboard_tiles$/.test(e)) || "";
    }
    const v = this._tilesEntity ? this._hass.states[this._tilesEntity]?.state : "";
    return v === "Fill the screen" ? "fill" : v === "Large" ? "large" : "";
  }

  // Die Schrift auf einer eingeschalteten Karte in der Akzentfarbe: dunkel auf hell, weiß auf dunkel.
  _activeInk() {
    const v = getComputedStyle(this).getPropertyValue("--state-light-on-color").trim() || "#ff9800";
    const rgb = this._parse(v);
    return rgb && this._lumaOf(rgb) < 150 ? "#fff" : INK;
  }

  _previewHtml() {
    const secs = this._sections();
    if (!secs.length) return `<div class="empty">Noch keine Karten. Hake links die Geräte an, die auf der Echo Show erscheinen sollen.</div>`;
    const mode = this._echoTiles();
    const tiles = secs.flatMap((s) => s.items);
    this._onInk = this._activeInk();
    // Fill the screen: bis zu neun Karten über den ganzen Bildschirm, Überschriften und Größen gelten
    // dann nicht (drawn_fill.go).
    if (mode === "fill" && tiles.length && tiles.length <= 9) {
      const n = tiles.length, cols = n <= 1 ? 1 : n === 2 || n === 4 ? 2 : 3, rows = Math.ceil(n / cols);
      const tw = (920 - 12 * (cols - 1)) / cols, th = (560 - 12 * (rows - 1)) / rows;
      return `<div class="fill" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">
        ${tiles.map(({ it, idx }) => this._tileHtml(it, idx, tw, th, true)).join("")}</div>`;
    }
    const large = mode === "large";
    const ncols = large ? Math.max(1, Math.min(2, secs.length)) : 2;
    const th = large ? 126 : 84;
    const secW = ncols === 1 ? 920 : 454;
    const cols = Array.from({ length: ncols }, () => []), heights = new Array(ncols).fill(0);
    for (const sec of secs) {
      let c = 0;
      heights.forEach((h, i) => { if (h < heights[c]) c = i; });
      cols[c].push(sec);
      heights[c] += this._sectionHeight(sec, th) + 12;
    }
    const tile = ({ it, idx }) => {
      const size = it.size || "1x1", n = size === "2x2" ? 2 : 1;
      return this._tileHtml(it, idx, size === "1x1" ? (secW - 12) / 2 : secW, n * th + (n - 1) * 12);
    };
    return cols.map((col) => `<div class="col">${col.map((sec) => `<div class="sec">
      ${sec.heading !== null ? `<div class="heading ${this._selected === "#" + sec.idx ? "sel" : ""}" draggable="true" data-idx="${sec.idx}" data-sel="#${sec.idx}">${this._esc(sec.heading)}</div>` : ""}
      ${sec.items.length ? `<div class="tiles" style="--th:${th}">${sec.items.map(tile).join("")}</div>` : ""}</div>`).join("")}</div>`).join("");
  }

  // Eine Karte, wie die Echo Show sie zeichnet (drawn_studio_ottoman.go), w × h in ihren Einheiten:
  // das Symbol oben links, der Zustand oben rechts, der Name unten; an, leuchtet die ganze Karte in
  // der Akzentfarbe oder ihrer Farbe für an; aus ist sie dunkel oder in ihrer Farbe für aus; mit Bild
  // das Bild, unten dunkler. Größer als die gewöhnliche Karte, wächst alles mit ihr (k).
  _tileHtml(it, idx, w, h, filled = false) {
    const on = this._isOn(it.entity);
    const size = filled ? "1x1" : it.size || "1x1";
    let k = Math.min(h / 84, w / 220, 2.5);
    if (k < 1.05) k = 1;
    const fill = on ? it.color_on : it.color_off;
    const img = it.image ? this._url(it.image) : "";
    const icoImg = it.icon_image ? this._url(it.icon_image) : "";
    const cls = ["tile"], vars = [`--k:${k.toFixed(3)}`];
    if (it.image) {
      cls.push("pic");
      vars.push(img ? `background-image:url('${img}')` : "background:#333", "--fg:#fff", "--soft:#e8e8e8", "--ic:#fff");
      if (on) vars.push(`--shade:${this._half(it.color_on || AMBER)}`);
    } else if (fill) {
      const ink = this._luma(fill) < 150 ? "#fff" : INK;
      vars.push(`--fill:${fill}`, `--fg:${ink}`, `--soft:${ink}`, `--ic:${ink}`);
    } else if (on) {
      cls.push("on");
      vars.push(`--on-ink:${this._onInk}`);
    }
    if (size !== "1x1") cls.push("w2");
    if (size === "2x2") cls.push("h2");
    if (this._selected === it.entity) cls.push("sel");
    const solo = it.hide_name && it.hide_state;
    if (solo) { cls.push("solo"); vars.push(`--side:${(Math.min(w, h) * 0.6).toFixed(1)}`); }
    if (h >= 112 * k) cls.push("two");
    const icon = icoImg ? `<img src="${icoImg}">` : it.icon_image ? "" : `<ha-icon icon="${this._esc(it.icon || this._defaultIcon(it.entity))}"></ha-icon>`;
    return `<div class="${cls.join(" ")}" draggable="true" data-idx="${idx}" data-sel="${it.entity}" style="${vars.join(";")}">
      ${it.image ? `<div class="shade"></div>` : ""}<div class="ico">${icon}</div>
      ${solo || it.hide_state ? "" : `<div class="val">${this._esc(this._stateText(it.entity))}</div>`}
      ${solo || it.hide_name ? "" : `<div class="name">${this._esc(it.name || this._friendly(it.entity))}</div>`}</div>`;
  }

  _rgb(hex) { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  _luma(hex) { return this._lumaOf(this._rgb(hex)); }
  _lumaOf([r, g, b]) { return 0.299 * r + 0.587 * g + 0.114 * b; }
  _half(hex) { const [r, g, b] = this._rgb(hex); return `rgba(${r >> 1},${g >> 1},${b >> 1},.7)`; }
  // Eine Farbe aus CSS: #rgb, #rrggbb oder rgb(…); null, wenn sie anders geschrieben ist.
  _parse(v) {
    let m = /^#([0-9a-f]{3})$/i.exec(v);
    if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
    if (/^#[0-9a-f]{6}$/i.test(v)) return this._rgb(v);
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }

  // --- Eigenschaften

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

  _renderProps() {
    const pane = this._el("props");
    if (!pane) return;
    const scroll = pane.scrollTop;
    pane.innerHTML = this._propsHtml();
    pane.scrollTop = scroll;
    this._wireProps();
  }

  // --- Ereignisse --------------------------------------------------------------------------------

  // Die Ereignisse des Gerüsts, einmal: an den Bereichen, nicht an jeder Zeile und jeder Karte, damit
  // ein Neuzeichnen nichts neu verbinden muss.
  _wire() {
    const on = (id, ev, fn) => { const el = this._el(id); if (el) el.addEventListener(ev, fn); };
    on("save", "click", () => this._save());
    if (!this._loaded) return;

    let typing = null;
    on("q", "input", (e) => {
      this._filter.text = e.target.value;
      clearTimeout(typing);
      typing = setTimeout(() => this._renderDeviceList(), 150);
    });
    on("area", "change", (e) => { this._filter.area = e.target.value; this._renderDeviceList(); });
    on("domain", "change", (e) => { this._filter.domain = e.target.value; this._renderDeviceList(); });
    on("only", "change", (e) => { this._filter.only = e.target.checked; this._renderDeviceList(); });
    on("devlist", "change", (e) => {
      const row = e.target.closest(".dev");
      if (row && e.target.type === "checkbox") this._toggleDevice(row.dataset.entity, e.target.checked, e.target);
    });
    on("addheading", "click", () => {
      this._items.unshift({ heading: "Neue Überschrift" });
      this._selected = "#0";
      this._edited();
    });
    this._wireGrid();
  }

  _wireGrid() {
    const grid = this._el("grid");
    const target = (e) => e.target.closest && e.target.closest("[data-idx]");
    const clearDrop = () => { if (this._dropEl) this._dropEl.classList.remove("drop"); this._dropEl = null; };
    grid.addEventListener("click", (e) => {
      const el = target(e);
      if (!el || el.dataset.sel === this._selected) return;
      this._selected = el.dataset.sel;
      this._markSelected();
      this._renderProps();
    });
    grid.addEventListener("dragstart", (e) => {
      const el = target(e);
      if (!el) return;
      this._dragFrom = Number(el.dataset.idx);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", el.dataset.idx); // ohne Daten zieht Firefox nicht
      requestAnimationFrame(() => el.classList.add("dragging"));
    });
    grid.addEventListener("dragover", (e) => {
      if (this._dragFrom < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const el = target(e);
      if (el === this._dropEl) return;
      clearDrop();
      if (el && Number(el.dataset.idx) !== this._dragFrom) { el.classList.add("drop"); this._dropEl = el; }
    });
    grid.addEventListener("drop", (e) => {
      if (this._dragFrom < 0) return;
      e.preventDefault();
      const el = target(e);
      const from = this._dragFrom, to = el ? Number(el.dataset.idx) : this._items.length;
      const it = this._items[from];
      clearDrop();
      this._dragFrom = -1;
      if (it && this._move(from, to)) {
        this._select(it);
        this._edited();
      } else if (this._stale) this._renderPreview();
    });
    grid.addEventListener("dragend", () => {
      clearDrop();
      grid.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
      if (this._dragFrom < 0) return; // schon abgelegt
      this._dragFrom = -1;
      if (this._stale) this._renderPreview();
    });
  }

  // Die Felder der gewählten Karte; sie werden mit ihr neu gezeichnet.
  _wireProps() {
    const r = this.shadowRoot;
    const on = (id, ev, fn) => { const el = this._el(id); if (el) el.addEventListener(ev, fn); };
    const it = this._item(this._selected);
    if (!it) return;
    const idx = this._items.indexOf(it);
    const step = (to) => { if (this._move(idx, to)) { this._select(it); this._edited(); } };
    on("up", "click", () => step(idx - 1));
    on("down", "click", () => step(idx + 2));
    if (it.heading !== undefined) {
      on("heading", "change", (e) => { it.heading = e.target.value.trim() || "Überschrift"; this._edited(false); });
      on("delheading", "click", () => { this._items.splice(idx, 1); this._selected = null; this._edited(); });
      return;
    }
    on("name", "change", (e) => this._change({ name: e.target.value.trim() }, false));
    on("color_on", "change", (e) => this._change({ color_on: e.target.value.toUpperCase() }));
    on("color_off", "change", (e) => this._change({ color_off: e.target.value.toUpperCase() }));
    on("reset_on", "click", () => this._change({ color_on: "" }));
    on("reset_off", "click", () => this._change({ color_off: "" }));
    on("hide_name", "change", (e) => this._change({ hide_name: e.target.checked }, false));
    on("hide_state", "change", (e) => this._change({ hide_state: e.target.checked }, false));
    on("pickicon", "click", () => r.getElementById("iconfile").click());
    on("pickimage", "click", () => r.getElementById("imagefile").click());
    on("clearicon", "click", () => this._change({ icon_image: "" }));
    on("clearimage", "click", () => this._change({ image: "" }));
    on("iconfile", "change", (e) => e.target.files[0] && this._upload(e.target.files[0], "icon_image"));
    on("imagefile", "change", (e) => e.target.files[0] && this._upload(e.target.files[0], "image"));
    r.querySelectorAll("#props [data-size]").forEach((b) => b.addEventListener("click", () => this._change({ size: b.dataset.size === "1x1" ? "" : b.dataset.size })));

    // Home Assistants eigene Symbolauswahl, mit Suche.
    const holder = this._el("iconpicker");
    if (holder) {
      const picker = document.createElement("ha-icon-picker");
      picker.hass = this._hass;
      picker.value = it.icon || "";
      picker.placeholder = this._defaultIcon(it.entity);
      picker.addEventListener("value-changed", (e) => this._change({ icon: e.detail.value || "" }, false));
      holder.appendChild(picker);
    }
  }
}

customElements.define("echo-studio-panel", EchoStudioPanel);
