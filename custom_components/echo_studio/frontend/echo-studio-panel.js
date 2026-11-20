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

// Das Menü der Echo Show (Hilal OS, Bereich „Menü“): die Reiter, was Licht und Szenen zeigen dürfen,
// die Farbthemen und ihre Farben (wie drawer_ottoman_menu.go und tv_ottoman_theme.go sie zeichnen:
// Fläche, Akzent, gedämpfte Schrift, Ränder).
const MENU_TABS = [["light", "Licht"], ["music", "Musik"], ["radio", "Radio"], ["tv", "TV"], ["football", "Fußball"],
  ["cameras", "Kameras"], ["scenes", "Szenen"], ["announce", "Ansagen"], ["call", "Anrufen"], ["todo", "To-do"]];
const MENU_DOMAINS = { light: ["light", "switch"], scenes: ["scene", "script"] };
const MENU_THEMES = [["", "Automatisch (wie die Startseite)"], ["start", "Startseite"], ["show", "Design der Echo Show"],
  ["blue", "Blau"], ["midnight", "Mitternacht"], ["emerald", "Smaragd"], ["aubergine", "Aubergine"], ["bordeaux", "Bordeaux"],
  ["sunset", "Sonnenuntergang"], ["graphite", "Graphit"], ["ocean", "Ozean"]];
const MENU_COLORS = { // Fläche, Akzent, gedämpfte Schrift, Ränder
  start: ["#1b2d3f", "#F4A93C", "#a9b6c3", "#2b4a57"], show: ["#2e2723", "#E9A23B", "#8a7d6c", "#3a2c22"],
  blue: ["#153aa8", "#ffd54a", "#a9bdee", "#2474e0"], midnight: ["#222a3b", "#ffd166", "#9ba8c0", "#35507a"],
  emerald: ["#107a70", "#ffe082", "#a9ddd3", "#17a08f"], aubergine: ["#4f2690", "#ffd36b", "#cdb9ef", "#7340c8"],
  bordeaux: ["#842243", "#ffe08a", "#ecbfca", "#b33a5c"], sunset: ["#99491a", "#fff1b0", "#f3cfae", "#cf6a22"],
  graphite: ["#3a4049", "#ffd166", "#b6bdc7", "#566070"], ocean: ["#106a9c", "#ffe082", "#aad8f0", "#1b8fd0"],
};

const css = `
:host { display:flex; flex-direction:column; height:100vh; height:100dvh; overflow:hidden; background:var(--primary-background-color); color:var(--primary-text-color);
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
.main { display:grid; grid-template-columns:320px 1fr 340px; gap:16px; padding:16px; flex:1; min-height:0; }
.pane { background:var(--card-background-color); border-radius:12px; padding:12px; overflow:auto; min-height:0; }
.pane h2 { font-size:15px; margin:4px 4px 10px; font-weight:500; }
@media (max-width:1100px) { :host { height:auto; overflow:visible; } .main { grid-template-columns:1fr; } .pane { max-height:none; } }
input[type=search], input[type=text], input[type=password], select { width:100%; padding:8px 10px; border-radius:8px; font:inherit;
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
/* Oben: Karten | Menü */
.top .modes { display:flex; gap:4px; background:rgba(0,0,0,.18); border-radius:20px; padding:3px; }
.top .modes button { background:none; padding:6px 14px; }
.top .modes button.on { background:rgba(255,255,255,.9); color:${INK}; }
/* Das Menü: seine Vorschau im Format der Echo Show (Vollbild, Reiterleiste, Kacheln) */
.mparts { flex-wrap:wrap; margin:0 0 12px; }
.mscreen { --u:0.10417cqw; aspect-ratio:16/10; overflow:auto; background:var(--mg); color:#f1f4f7;
  padding:calc(var(--u)*18) calc(var(--u)*22); font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.mtop { display:flex; align-items:center; gap:calc(var(--u)*18); padding-bottom:calc(var(--u)*15);
  border-bottom:1px solid color-mix(in srgb, var(--mr) 60%, transparent); margin-bottom:calc(var(--u)*17); }
.mtabs { flex:1; min-width:0; height:calc(var(--u)*46); display:flex; align-items:center; gap:calc(var(--u)*2); background:color-mix(in srgb, var(--mg) 80%, #000);
  border:1px solid var(--mr); border-radius:calc(var(--u)*23); padding:calc(var(--u)*3); overflow:hidden; }
.mtabs span { flex:1; min-width:0; text-align:center; font-size:calc(var(--u)*24); line-height:calc(var(--u)*38); padding:0 calc(var(--u)*8); border-radius:calc(var(--u)*20);
  color:color-mix(in srgb, var(--md) 70%, #fff); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mtabs span.on { background:var(--ma); color:${INK}; font-weight:700; }
.mtop .x { flex:none; width:calc(var(--u)*45); height:calc(var(--u)*45); border-radius:50%; background:color-mix(in srgb, var(--mg) 70%, #fff);
  display:flex; align-items:center; justify-content:center; font-size:calc(var(--u)*30); color:#fff; padding:0; box-shadow:0 calc(var(--u)*2) calc(var(--u)*6) rgba(0,0,0,.35); }
.mgrid { display:grid; gap:calc(var(--u)*14); }
.mhead { grid-column:1/-1; height:calc(var(--u)*36); line-height:1; display:flex; align-items:flex-end; margin-top:calc(var(--u)*6); color:var(--ma); font-size:calc(var(--u)*29); cursor:pointer;
  border-radius:8px; padding:0 calc(var(--u)*4); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mhead:first-child { margin-top:0; }
.mhead.sel { outline:2px solid #fff; }
.mtile { position:relative; height:calc(var(--u)*124); border-radius:calc(var(--u)*22); padding:calc(var(--u)*16); cursor:grab; color:var(--fg);
  background:linear-gradient(180deg, color-mix(in srgb, var(--fill) 92%, #fff), color-mix(in srgb, var(--fill) 92%, #000));
  box-shadow:0 calc(var(--u)*3) calc(var(--u)*10) rgba(0,0,0,.35); }
.mtile ha-icon { --mdc-icon-size:calc(var(--u)*36); color:var(--fg); opacity:.85; pointer-events:none; }
.mtile .val { position:absolute; right:calc(var(--u)*16); top:calc(var(--u)*17); font-size:calc(var(--u)*21); opacity:.8; pointer-events:none; }
.mtile .name { position:absolute; left:calc(var(--u)*16); right:calc(var(--u)*16); bottom:calc(var(--u)*11); font-size:calc(var(--u)*25);
  line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; pointer-events:none; }
.mtile.sel { outline:3px solid #fff; outline-offset:2px; }
.mtile.drop, .mhead.drop { box-shadow:calc(var(--u)*-6) 0 0 0 #fff; }
.mtile.dragging { opacity:.4; }
.mtabrow { display:flex; align-items:center; gap:8px; padding:6px 4px; border-radius:8px; }
.mtabrow:hover { background:var(--secondary-background-color); }
.mtabrow input[type=checkbox] { width:18px; height:18px; accent-color:${AMBER}; flex:none; }
.mtabrow .lbl { width:76px; flex:none; font-size:13px; }
.mtabrow input[type=text] { flex:1; min-width:0; padding:6px 8px; }
.mtabrow button { padding:4px 8px; flex:none; }
.mswatch { display:inline-block; width:14px; height:14px; border-radius:4px; vertical-align:middle; margin-right:6px; border:1px solid rgba(255,255,255,.3); }
/* Der TV-Zugang: ein Fenster über der Seite */
.top button.tv { display:flex; align-items:center; gap:6px; }
.top button.tv ha-icon { --mdc-icon-size:18px; }
.dlg-back { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:10; padding:16px; }
.dlg { background:var(--card-background-color); color:var(--primary-text-color); border-radius:16px; width:min(520px,100%);
  box-shadow:0 20px 50px rgba(0,0,0,.5); padding:22px 24px; max-height:calc(100vh - 32px); overflow:auto; }
.dlg h2 { margin:0 0 4px; font-size:20px; font-weight:500; display:flex; align-items:center; gap:10px; }
.dlg h2 ha-icon { color:${AMBER}; }
.dlg .lead { color:var(--secondary-text-color); font-size:13px; margin:0 0 14px; line-height:1.45; }
.dlg label { display:block; font-size:12px; color:var(--secondary-text-color); margin:14px 0 5px; }
.dlg .pw { position:relative; }
.dlg .pw button { position:absolute; right:4px; top:50%; transform:translateY(-50%); background:none; padding:6px; color:var(--secondary-text-color); }
.dlg .pw input { padding-right:40px; }
.pill { display:inline-flex; align-items:center; gap:8px; padding:7px 12px; border-radius:16px; font-size:13px; margin-top:16px;
  background:var(--secondary-background-color); }
.pill .dot { width:9px; height:9px; border-radius:50%; background:#8a8f98; }
.pill.ok .dot { background:#43a047; } .pill.wait .dot { background:${AMBER}; } .pill.bad .dot { background:#e53935; }
.dlg .seg { margin:4px 0 2px; }
.dlg [hidden] { display:none !important; } /* sonst gewinnt display:flex über hidden */
.dlg .row2 { display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; margin-top:20px; }
.dlg .row2 .right { display:flex; gap:8px; }
.dlg .note { font-size:12px; color:var(--secondary-text-color); margin-top:14px; line-height:1.4; }
.dlg .warn { background:rgba(233,162,59,.15); border-radius:10px; padding:10px 12px; font-size:13px; margin-top:12px;
  display:flex; align-items:center; justify-content:space-between; gap:10px; }
.dlg h3 { font-size:15px; font-weight:500; margin:22px 0 4px; }
.dlg .srcs { display:flex; flex-direction:column; gap:8px; margin:4px 0 4px; }
.dlg .src { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; background:var(--secondary-background-color); }
.dlg .src.on { outline:2px solid ${AMBER}; }
.dlg .src > ha-icon { color:${AMBER}; flex:none; }
.dlg .src .txt { flex:1; min-width:0; }
.dlg .src .n { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dlg .src .h { font-size:12px; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dlg .src .badge { font-size:11px; font-weight:500; color:${INK}; background:${AMBER}; border-radius:8px; padding:1px 7px; margin-left:6px; }
.dlg .src .acts { display:flex; gap:4px; flex:none; }
.dlg .src .acts button { padding:6px 10px; }
.dlg .src .acts ha-icon { --mdc-icon-size:18px; }
.dlg .src .acts button.tog { background:none; color:var(--secondary-text-color); }
.dlg .src .acts button.tog.on { color:${AMBER}; }
.dlg .src .acts button.tog ha-icon { --mdc-icon-size:22px; }
.dlg .src .err { font-size:12px; color:#e53935; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
    // Das Menü (Hilal OS): ob Echo Studio es kennt, die Einstellung, was gerade bearbeitet wird.
    this._mode = "cards";     // "cards": die Karten; "menu": das Menü
    this._cards = [];         // die Karten, auch während das Menü bearbeitet wird
    this._menu = null;        // {tabs, light, scenes, look}
    this._menuOK = false;
    this._menuDirty = false;
    this._part = "light";     // im Menü: "light", "scenes", "tabs", "look"
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) { this._load(); return; }
    if (this._tvOpen) this._tvStatusUpdate();
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
      this._cards = this._items;
      try {
        const m = await ws({ type: "echo_studio/menu/get" });
        this._menu = { tabs: (m.tabs || []).map((t) => ({ ...t })), light: (m.light || []).map((i) => ({ ...i })),
          scenes: (m.scenes || []).map((i) => ({ ...i })), look: { theme: m.look?.theme || "", columns: m.look?.columns || 0 } };
        this._menuOK = true;
        this._menuSuggest();
      } catch (_) { this._menuOK = false; } // ein Echo Studio ohne Menü auf der anderen Seite: nur Karten
      this._loaded = true;
    } catch (err) {
      this._error = "Laden fehlgeschlagen: " + (err.message || err);
    }
    this._render();
  }

  // Die Karten folgen dem Label: was es trägt und noch keine Karte hat, kommt hinten dazu; eine
  // Karte ohne Label fällt weg.
  _syncWithLabels() {
    if (this._mode === "menu") return;
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

  // Ein Haken in der Geräteliste: setzt oder nimmt das Label, sofort in Home Assistant. Im Menü: nimmt
  // das Gerät in die Liste des Reiters auf oder heraus (erst „Speichern“ bringt es auf die Echo Show).
  async _toggleDevice(entityId, on, box) {
    if (this._mode === "menu") {
      const at = this._items.findIndex((i) => i.entity === entityId);
      if (on && at < 0) { this._items.push({ entity: entityId }); this._selected = entityId; }
      if (!on && at >= 0) { this._items.splice(at, 1); if (this._selected === entityId) this._selected = null; }
      this._renderCount();
      this._edited();
      return;
    }
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
      if (this._dirty) {
        for (const it of this._cards) {
          if (this._foreign(it.icon) && !it.icon_mask) await this._makeMask(it).catch(() => {}); // ohne: das Standardsymbol
        }
        const saved = await this._hass.callWS({ type: "echo_studio/layout/save", layout: { version: 1, items: this._cards } });
        this._cards = saved.items.map((i) => ({ ...i }));
        if (this._mode === "cards") this._items = this._cards;
        this._dirty = false;
      }
      if (this._menuDirty && this._menu) {
        const saved = await this._hass.callWS({ type: "echo_studio/menu/save", menu: { version: 1, ...this._menu } });
        this._menu = { tabs: saved.tabs, light: saved.light, scenes: saved.scenes, look: saved.look };
        if (this._mode === "menu") this._useList();
        this._menuDirty = false;
      }
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
    if (this._mode === "menu") this._menuDirty = true; else this._dirty = true;
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

  // Ein Symbol, das nicht aus mdi kommt (etwa m3of: aus Material Symbols): die Echo Show kennt nur mdi.
  _foreign(icon) { return !!icon && !icon.startsWith("mdi:"); }

  // Der Umriss eines Symbols als SVG-Pfad: von dem Paket, das es in Home Assistant anmeldet
  // (window.customIcons), sonst aus einem gezeichneten <ha-icon>.
  async _iconPath(icon) {
    const [prefix, name] = icon.split(":");
    const set = window.customIcons && window.customIcons[prefix];
    if (set && typeof set.getIcon === "function") {
      try {
        const got = await set.getIcon(name);
        if (got && got.path) return { path: got.path, viewBox: got.viewBox || "0 0 24 24" };
      } catch (_) { /* wie unten */ }
    }
    const el = document.createElement("ha-icon");
    el.icon = icon;
    el.style.cssText = "position:fixed;left:-200px;top:0;width:24px;height:24px";
    document.body.appendChild(el);
    try {
      for (let i = 0; i < 40; i++) {
        const svg = el.shadowRoot?.querySelector("ha-svg-icon")?.shadowRoot?.querySelector("svg");
        const paths = svg ? [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d")).filter(Boolean) : [];
        if (paths.length) return { path: paths.join(" "), viewBox: svg.getAttribute("viewBox") || "0 0 24 24" };
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally { el.remove(); }
    return null;
  }

  // Zeichnet das Symbol von it als Maske (weiß auf durchsichtig, 128 Pixel) und lädt sie hoch: die
  // Echo Show färbt sie wie ein eigenes Symbol. Ohne Umriss bleibt es beim Symbol, das sie selbst wählt.
  async _makeMask(it) {
    const icon = it.icon;
    const shape = await this._iconPath(icon).catch(() => null);
    if (!shape || it.icon !== icon) return;
    const size = 128;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${this._esc(shape.viewBox)}"><path fill="#fff" d="${this._esc(shape.path)}"/></svg>`;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = size;
    c.getContext("2d").drawImage(img, 0, 0, size, size);
    const data = c.toDataURL("image/png").split(",")[1];
    const res = await this._hass.callWS({ type: "echo_studio/image/upload", content_type: "image/png", data });
    if (it.icon === icon) it.icon_mask = res.file;
  }

  // Ein neues Symbol: aus mdi braucht es keine Maske, sonst wird sie gleich erzeugt.
  async _setIcon(icon) {
    const it = this._item(this._selected);
    if (!it) return;
    if (this._mode === "menu" && this._foreign(icon)) { // das Menü der Echo Show zeichnet nur mdi-Symbole
      this._error = "Im Menü gehen nur Symbole aus mdi (Material Design Icons).";
      this._renderTop();
      this._renderProps();
      return;
    }
    this._change({ icon, icon_mask: "" }, false);
    if (!this._foreign(icon)) return;
    try {
      await this._makeMask(it);
    } catch (err) {
      this._error = "Symbol konnte nicht für die Echo Show vorbereitet werden: " + (err.message || err);
      this._renderTop();
    }
  }

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
        ${this._menuOK ? `<div class="modes" id="modes"><button data-mode="cards" class="${this._mode === "cards" ? "on" : ""}">Karten</button>
          <button data-mode="menu" class="${this._mode === "menu" ? "on" : ""}">Menü</button></div>` : ""}
        <span class="state" id="state"></span>
        <button class="tv" id="tvbtn"><ha-icon icon="mdi:television-play"></ha-icon>TV-Listen</button>
        <button class="primary" id="save">Speichern</button>
      </div>
      <div class="error" id="error"></div>
      ${this._loaded && this._mode === "menu" ? this._menuMainHtml() : this._loaded ? `<div class="main">
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
    const dirty = this._dirty || this._menuDirty;
    if (state) state.textContent = this._busy ? "Einen Moment …" : dirty ? "Nicht gespeichert" : this._loaded ? "Gespeichert" : "";
    if (save) save.disabled = !dirty || this._busy;
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
    if (el && this._mode === "menu") { el.textContent = `(${this._items.filter((i) => i.entity).length})`; return; }
    if (el) el.textContent = `(${this._registry.filter((e) => this._hasLabel(e)).length})`;
  }

  _renderDeviceList() {
    const list = this._el("devlist");
    if (!list) return;
    if (this._mode === "menu") { list.innerHTML = this._menuDevicesHtml(); return; }
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
    if (this._mode === "menu") return this._menuPreviewHtml();
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
    if (this._mode === "menu") return this._menuPropsHtml();
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

  // --- TV-Listen (Xtream Codes und M3U für das Fernsehen der Echo Show, Hilal OS) -----------------
  //
  // Die Echo Show hält beliebig viele Quellen (Aktionen esphome.<gerät>_iptv_add, _iptv_edit,
  // _iptv_remove, _iptv_select) und sagt auf _iptv_sources, welche es gibt: Name, Art, Server, ob
  // gezeigt; nie Zugangsdaten. Echo Studio speichert davon nichts. Wie es um die gezeigte steht, sagen
  // sensor.<gerät>_iptv_status und _iptv_guide.

  _tvIDs() {
    const st = this._hass.states;
    const status = Object.keys(st).find((e) => /^sensor\..*_iptv_status$/.test(e)) || "";
    const prefix = status ? status.slice("sensor.".length, -"_iptv_status".length) : "";
    const services = Object.keys(this._hass.services?.esphome || {});
    const svc = (end) => services.find((s) => s.endsWith(end)) || "";
    return {
      status, type: prefix ? `sensor.${prefix}_iptv_type` : "", guideState: prefix ? `sensor.${prefix}_iptv_guide` : "",
      video: prefix ? `switch.${prefix}_video` : "",
      add: svc("_iptv_add"), edit: svc("_iptv_edit"), remove: svc("_iptv_remove"), select: svc("_iptv_select"), show: svc("_iptv_show"),
      sources: svc("_iptv_sources"), account: svc("_iptv_account"),
    };
  }

  _tvStatusInfo() {
    const ids = this._tvIDs();
    if (!ids.account && !ids.add) return ["bad", "Die Echo Show bietet kein Fernsehen an (Hilal OS nötig)."];
    const v = ids.status ? this._hass.states[ids.status]?.state : "";
    if (this._tvSent && Date.now() - this._tvSent < 4000 && v !== "checking") return ["wait", "Wird gesendet …"];
    return {
      not_set: ["", "Noch keine Liste eingerichtet"],
      checking: ["wait", "Die gezeigte Liste wird geprüft …"],
      ready: ["ok", "Die gezeigte Liste ist geladen"],
      refused: ["bad", "Abgelehnt: Benutzername oder Passwort stimmt nicht"],
      unreachable: ["bad", "Server nicht erreichbar: Adresse oder Anschluss prüfen"],
      unreadable: ["bad", "Der Server antwortet, aber nicht wie erwartet"],
    }[v] || ["", "Echo Show nicht erreichbar"];
  }

  _tvStatusUpdate() {
    const el = this._el("tvstatus");
    if (el) {
      const [cls, text] = this._tvStatusInfo();
      el.className = "pill " + cls;
      el.querySelector(".t").textContent = text;
    }
    const ids = this._tvIDs();
    const warn = this._el("tvvideo");
    if (warn) warn.hidden = !ids.video || this._hass.states[ids.video]?.state !== "off";
    const g = this._el("tvguidestate");
    if (g) g.textContent = this._tvGuideText();
    // Hat sich der Stand der Show geändert (eine Liste kam dazu, eine andere wird gezeigt), die Listen neu.
    const sig = (ids.status ? this._hass.states[ids.status]?.state : "") + "|" + (ids.type ? this._hass.states[ids.type]?.state : "");
    if (this._tvOpen && sig !== this._tvSig) {
      this._tvSig = sig;
      this._tvLoadSources();
    }
  }

  // Wie es um den Programmführer der gezeigten Liste steht, aus „Host: 287 channels“ usw.
  _tvGuideText() {
    const ids = this._tvIDs();
    const v = ids.guideState ? this._hass.states[ids.guideState]?.state || "" : "";
    if (!v || v === "unknown" || v === "unavailable") return "";
    const m = v.match(/^(.*): (\d+) channels$/);
    if (v.includes("; ")) return "Programmführer: " + v.split("; ").map((p) => p.replace(/: (\d+) channels$/, " ($1 Sender)").replace(/: loading$/, " (wird geladen)").replace(/: failed$/, " (nicht zu laden)")).join(", ");
    if (m) return `Programmführer der gezeigten Liste: ${m[1]}, Programm für ${m[2]} Sender.`;
    if (v.endsWith(": loading")) return `Programmführer von ${v.slice(0, -9)} wird geladen …`;
    if (v.endsWith(": failed")) return `Der Programmführer von ${v.slice(0, -8)} ließ sich nicht laden.`;
    return v;
  }

  _openTV() {
    this._tvOpen = true;
    this._tvSig = "";
    this._tvSources = null;
    const back = document.createElement("div");
    back.className = "dlg-back";
    back.id = "tvdlg";
    back.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">
      <h2><ha-icon icon="mdi:television-play"></ha-icon>TV-Listen</h2>
      <p class="lead">Deine IPTV-Listen für das Fernsehen auf der Echo Show: Xtream-Codes-Zugänge und M3U-Listen, so viele
        du willst. Mit „gezeigt“ siehst du mehrere zugleich (ihre Kategorien zusammen), mit „Nur diese“ eine allein. Die
        Daten gehen verschlüsselt an die Echo Show und liegen nur dort.</p>
      <div class="srcs" id="tvsrcs"><div class="note">Listen werden gelesen …</div></div>
      <div class="pill" id="tvstatus"><span class="dot"></span><span class="t"></span></div>
      <p class="note" id="tvguidestate"></p>
      <div class="warn" id="tvvideo" hidden><span>Der Schalter „Video“ der Echo Show ist aus: so spielt kein Sender.</span>
        <button id="tvvideoon">Einschalten</button></div>

      <div id="tvaddbox" hidden>
        <h3 id="tvformtitle">Liste hinzufügen</h3>
        <label>Name (freiwillig)</label>
        <input type="text" id="tvname" autocomplete="off" placeholder="z. B. Mein Anbieter, Türkei, iptv-org">
        <div class="seg" id="tvkind">
          <button data-kind="xtream" class="on">Xtream Codes</button>
          <button data-kind="m3u">M3U-Liste</button>
        </div>
        <div id="tvxtream">
          <label>Server</label>
          <input type="text" id="tvserver" placeholder="http://anbieter.example:8080" autocomplete="off">
          <label>Benutzername</label>
          <input type="text" id="tvuser" autocomplete="off">
          <label>Passwort</label>
          <div class="pw"><input type="password" id="tvpass" autocomplete="new-password">
            <button id="tveye" title="Passwort zeigen"><ha-icon icon="mdi:eye"></ha-icon></button></div>
        </div>
        <div id="tvm3u" hidden>
          <label>Link zur Senderliste (.m3u oder .m3u8)</label>
          <input type="text" id="tvlist" autocomplete="off" placeholder="http://anbieter.example/get.php?…&type=m3u_plus">
          <label>Programmführer (EPG), freiwillig</label>
          <input type="text" id="tvguide" autocomplete="off" placeholder="https://…/guide.xml.gz (XMLTV)">
          <p class="note">Die Gruppen der Liste werden zu Kategorien. Filme und Serien bleiben draußen.</p>
        </div>
        <div class="row2"><span></span><div class="right"><button id="tvaddcancel">Abbrechen</button>
          <button class="primary" id="tvaddsave">Hinzufügen und prüfen</button></div></div>
      </div>

      <div id="tveditbox" hidden>
        <h3>Liste bearbeiten</h3>
        <label>Name</label>
        <input type="text" id="tvename" autocomplete="off">
        <div id="tveguidebox">
          <label>Programmführer (EPG)</label>
          <input type="text" id="tveguide" autocomplete="off">
          <button class="link" id="tveguideclear">Eigenen Programmführer entfernen</button>
        </div>
        <div class="row2"><span></span><div class="right"><button id="tveditcancel">Abbrechen</button>
          <button class="primary" id="tveditsave">Speichern</button></div></div>
      </div>

      <div class="row2">
        <button id="tvaddbtn" class="primary"><ha-icon icon="mdi:plus"></ha-icon> Liste hinzufügen</button>
        <div class="right"><button id="tvclose">Schließen</button></div>
      </div>
      <p class="note">Bitte nur mit legalen Quellen nutzen. Sender in H.264 bis 1080p laufen gut; 720p schont die Show.</p>
    </div>`;
    this.shadowRoot.appendChild(back);
    const $ = (id) => this._el(id);
    const close = () => { this._tvOpen = false; back.remove(); };
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    $("tvclose").addEventListener("click", close);
    $("tveye").addEventListener("click", () => {
      const pw = $("tvpass");
      pw.type = pw.type === "password" ? "text" : "password";
      $("tveye").querySelector("ha-icon").setAttribute("icon", pw.type === "password" ? "mdi:eye" : "mdi:eye-off");
    });
    $("tvvideoon").addEventListener("click", () => {
      const v = this._tvIDs().video;
      if (v) this._hass.callService("switch", "turn_on", { entity_id: v });
    });
    this._tvKind = "xtream";
    back.querySelectorAll("#tvkind button").forEach((b) => b.addEventListener("click", () => {
      this._tvKind = b.dataset.kind;
      back.querySelectorAll("#tvkind button").forEach((x) => x.classList.toggle("on", x === b));
      $("tvxtream").hidden = this._tvKind !== "xtream";
      $("tvm3u").hidden = this._tvKind !== "m3u";
      this._tvError("");
    }));
    const showAdd = (on) => { $("tvaddbox").hidden = !on; $("tvaddbtn").hidden = on; $("tveditbox").hidden = true; if (on) $("tvname").focus(); };
    $("tvaddbtn").addEventListener("click", () => showAdd(true));
    $("tvaddcancel").addEventListener("click", () => showAdd(false));
    $("tvaddsave").addEventListener("click", async () => {
      if (await this._tvAdd()) showAdd(false);
    });
    $("tveditcancel").addEventListener("click", () => { $("tveditbox").hidden = true; });
    $("tveditsave").addEventListener("click", async () => {
      if (await this._tvCall("edit", { id: this._tvEditing, name: $("tvename").value.trim(), guide: $("tveguide").value.trim() })) $("tveditbox").hidden = true;
    });
    $("tveguideclear").addEventListener("click", async () => {
      if (await this._tvCall("edit", { id: this._tvEditing, name: $("tvename").value.trim(), guide: "-" })) $("tveditbox").hidden = true;
    });
    $("tvsrcs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const id = b.dataset.id;
      const src = (this._tvSources || []).find((x) => x.id === id);
      switch (b.dataset.act) {
        case "select": this._tvCall("select", { id }); break;
        case "show": this._tvCall("show", { id, shown: !(src && (src.shown ?? src.active)) }); break;
        case "remove":
          if (confirm(`Die Liste „${src ? src.name : id}“ von der Echo Show entfernen?`)) this._tvCall("remove", { id });
          break;
        case "edit":
          this._tvEditing = id;
          $("tveditbox").hidden = false;
          $("tvaddbox").hidden = true;
          $("tvaddbtn").hidden = false;
          $("tvename").value = src ? src.name : "";
          $("tveguidebox").hidden = !src || src.kind !== "m3u";
          $("tveguide").value = "";
          $("tveguide").placeholder = src && src.guide ? `Eingetragen: ${src.guide} (zum Ändern neu eingeben)` : "https://…/guide.xml.gz (XMLTV)";
          $("tveguideclear").hidden = !src || !src.guide;
          $("tvename").focus();
          break;
      }
    });
    this._tvStatusUpdate();
    this._tvLoadSources();
  }

  // Die Quellen von der Echo Show, ohne Zugangsdaten.
  async _tvLoadSources() {
    const ids = this._tvIDs();
    const box = this._el("tvsrcs");
    if (!box) return;
    if (!ids.sources) {
      box.innerHTML = `<div class="note">Diese Echo Show kennt nur eine Liste. Für mehrere Listen Hilal OS ab Version 1.22
        installieren.</div>`;
      return;
    }
    try {
      const r = await this._hass.callWS({ type: "call_service", domain: "esphome", service: ids.sources, service_data: {}, return_response: true });
      this._tvSources = (r && r.response && r.response.sources) || [];
    } catch (err) {
      box.innerHTML = `<div class="note">Die Listen ließen sich nicht lesen: ${this._esc(err.message || String(err))}</div>`;
      return;
    }
    this._tvRenderSources();
  }

  _tvRenderSources() {
    const box = this._el("tvsrcs");
    if (!box) return;
    const list = this._tvSources || [];
    if (!list.length) {
      box.innerHTML = `<div class="note">Noch keine Liste. Füge unten eine hinzu.</div>`;
      return;
    }
    const many = this._tvIDs().show && list.length > 1;
    box.innerHTML = list.map((s) => {
      const shown = s.shown ?? s.active;
      const only = list.filter((x) => x.shown ?? x.active).length === 1 && shown;
      return `<div class="src ${shown ? "on" : ""}">
        <ha-icon icon="${s.kind === "m3u" ? "mdi:playlist-play" : "mdi:server-network"}"></ha-icon>
        <div class="txt"><div class="n">${this._esc(s.name)}${shown ? ` <span class="badge">gezeigt</span>` : ""}</div>
          <div class="h">${s.kind === "m3u" ? "M3U" : "Xtream Codes"} · ${this._esc(s.host)}${s.guide ? " · EPG " + this._esc(s.guide) : ""}</div>
          ${s.error && shown ? `<div class="err">${this._esc(s.error)}</div>` : ""}</div>
        <div class="acts">
          ${many ? `<button data-act="show" data-id="${this._esc(s.id)}" class="tog ${shown ? "on" : ""}" title="${shown ? "Nicht mehr zeigen" : "Zusätzlich zeigen"}"
            ${only ? "disabled" : ""}><ha-icon icon="${shown ? "mdi:checkbox-marked" : "mdi:checkbox-blank-outline"}"></ha-icon></button>` : ""}
          ${only ? "" : `<button data-act="select" data-id="${this._esc(s.id)}" title="Nur diese Liste zeigen">${many ? "Nur diese" : "Zeigen"}</button>`}
          <button data-act="edit" data-id="${this._esc(s.id)}" title="Bearbeiten"><ha-icon icon="mdi:pencil"></ha-icon></button>
          <button data-act="remove" data-id="${this._esc(s.id)}" title="Entfernen"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </div></div>`;
    }).join("");
  }

  // Eine Liste hinzufügen; true, wenn sie ging.
  async _tvAdd() {
    const $ = (id) => this._el(id);
    const ids = this._tvIDs();
    const name = $("tvname").value.trim();
    if (this._tvKind === "m3u") {
      const url = $("tvlist").value.trim(), guide = $("tvguide").value.trim();
      if (!/^https?:\/\//i.test(url)) { this._tvError("Der Link muss mit http:// oder https:// beginnen."); return false; }
      if (guide && !/^https?:\/\//i.test(guide)) { this._tvError("Der Link zum Programmführer muss mit http:// oder https:// beginnen."); return false; }
      if (!ids.add) return this._tvLegacy("playlist", { url });
      const ok = await this._tvCall("add", { kind: "m3u", name, url, guide, server: "", username: "", password: "" });
      if (ok) { $("tvlist").value = ""; $("tvguide").value = ""; $("tvname").value = ""; }
      return ok;
    }
    const server = $("tvserver").value.trim(), username = $("tvuser").value.trim(), password = $("tvpass").value;
    if (!server || !username || !password) { this._tvError("Server, Benutzername und Passwort werden alle gebraucht."); return false; }
    if (!ids.add) return this._tvLegacy("account", { server, username, password });
    const ok = await this._tvCall("add", { kind: "xtream", name, url: "", guide: "", server, username, password });
    $("tvpass").value = ""; // nicht im Fenster stehen lassen
    if (ok) { $("tvserver").value = ""; $("tvuser").value = ""; $("tvname").value = ""; }
    return ok;
  }

  // Für eine Echo Show mit nur einer Liste: die alten Aktionen.
  async _tvLegacy(what, data) {
    const services = Object.keys(this._hass.services?.esphome || {});
    const svc = services.find((s) => s.endsWith(what === "playlist" ? "_iptv_playlist" : "_iptv_account"));
    if (!svc) { this._tvError("Die Echo Show bietet das nicht an."); return false; }
    try {
      await this._hass.callService("esphome", svc, data);
      this._tvSent = Date.now();
      return true;
    } catch (err) {
      this._tvError("Senden fehlgeschlagen: " + (err.message || err));
      return false;
    }
  }

  // Eine der Aktionen add, edit, remove, select; danach die Listen neu. true, wenn sie ging.
  async _tvCall(what, data) {
    const ids = this._tvIDs();
    if (!ids[what]) { this._tvError("Die Echo Show kennt das noch nicht (Hilal OS ab Version 1.22)."); return false; }
    try {
      await this._hass.callService("esphome", ids[what], data);
      this._tvSent = Date.now();
      this._tvError("");
    } catch (err) {
      this._tvError("Senden fehlgeschlagen: " + (err.message || err));
      return false;
    }
    this._tvStatusUpdate();
    setTimeout(() => this._tvLoadSources(), 400);
    setTimeout(() => this._tvStatusUpdate(), 4100);
    return true;
  }

  _tvError(text) {
    const el = this._el("tvstatus");
    if (!el) return;
    if (text) {
      el.className = "pill bad";
      el.querySelector(".t").textContent = text;
    } else {
      this._tvStatusUpdate();
    }
  }

  // --- Ereignisse --------------------------------------------------------------------------------

  // Die Ereignisse des Gerüsts, einmal: an den Bereichen, nicht an jeder Zeile und jeder Karte, damit
  // ein Neuzeichnen nichts neu verbinden muss.
  // --- Das Menü (Hilal OS) ----------------------------------------------------------------------
  //
  // Der Bereich „Menü“ stellt das Seitenfenster der Echo Show ein (echo_studio/menu/*, menu.py):
  // welche Reiter in welcher Reihenfolge und mit welchem Namen, welche Lampen/Schalter und Szenen/
  // Skripte die Reiter Licht und Szenen zeigen (mit Überschriften, Namen, Symbolen und Farben), und
  // das Farbthema mit der Zahl der Kacheln nebeneinander. Die Listen nutzen dieselbe Vorschau mit
  // Ziehen und dieselben Eigenschaften wie die Karten: this._items ist dann die Liste des Reiters.

  // Ist eine Liste des Menüs noch leer, steht darin, was die Echo Show heute zeigt: die Geräte mit dem
  // Label, nach Namen sortiert wie dort. Ein Vorschlag: erst „Speichern“ macht ihn zur eigenen Liste.
  _menuSuggest() {
    this._suggested = {};
    for (const part of ["light", "scenes"]) {
      if (this._menu[part].some((i) => i.entity)) continue;
      const items = this._registry
        .filter((e) => this._hasLabel(e) && MENU_DOMAINS[part].includes(e.ei.split(".")[0]))
        .map((e) => ({ entity: e.ei }))
        .sort((a, b) => this._friendly(a.entity).toLowerCase().localeCompare(this._friendly(b.entity).toLowerCase()));
      if (items.length) {
        this._menu[part] = items;
        this._suggested[part] = true;
      }
    }
  }

  _setMode(mode) {
    if (mode === "menu" && !this._menu) return;
    this._mode = mode;
    this._selected = null;
    this._useList();
    this._render();
  }

  // this._items auf die Liste, die gerade bearbeitet wird.
  _useList() {
    if (this._mode !== "menu") { this._items = this._cards; return; }
    this._items = this._part === "scenes" ? this._menu.scenes : this._menu.light;
  }

  _isList() { return this._part === "light" || this._part === "scenes"; }

  _menuMainHtml() {
    const parts = [["light", "Licht"], ["scenes", "Szenen"], ["tabs", "Reiter"], ["look", "Aussehen"]];
    return `<div class="main">
      <div class="pane" id="devpane"><h2>Menü der Echo Show</h2>
        <div class="seg mparts" id="mparts">${parts.map(([k, t]) => `<button data-part="${k}" class="${this._part === k ? "on" : ""}">${t}</button>`).join("")}</div>
        <div id="mleft">${this._menuLeftHtml()}</div><div id="devlist"></div></div>
      <div class="pane"><h2>Vorschau des Menüs</h2>
        ${this._isList() && this._suggested?.[this._part] && !this._menuDirty ? `<p class="hint" style="margin:0 4px 10px">Das zeigt die Echo Show
          gerade (alle Geräte mit dem Label „echo“). Sortiere, ergänze Überschriften oder Farben und tippe auf „Speichern“, dann
          gilt es als eigene Liste.</p>` : ""}
        <div class="screen"><div class="mscreen" id="grid"></div></div>
        <div class="actions">${this._isList() ? `<button id="addheading">+ Überschrift</button>` : ""}
        <span class="hint">${this._isList()
          ? "Kacheln ziehen zum Sortieren, antippen zum Gestalten. Ist die Liste leer, zeigt die Echo Show wie bisher alle Geräte mit dem Label „echo“."
          : "So sieht das Menü auf der Echo Show aus. Nach „Speichern“ übernimmt sie es gleich."}</span></div></div>
      <div class="pane props" id="props"></div>
    </div>`;
  }

  // Die linke Spalte: für Licht und Szenen die Geräte zum Anhaken, für Reiter die Reiterliste, für
  // Aussehen Farbthema und Spalten.
  _menuLeftHtml() {
    if (this._part === "tabs") {
      return `<p class="hint">Haken: Reiter zeigen. Pfeile: Reihenfolge. Ein Name ersetzt den üblichen.</p>
        ${this._menuTabsList().map((t, i, all) => `<div class="mtabrow" data-tab="${t.id}">
          <input type="checkbox" data-act="show" ${t.show === false ? "" : "checked"}>
          <span class="lbl">${this._esc(MENU_TABS.find(([k]) => k === t.id)?.[1] || t.id)}</span>
          <input type="text" data-act="name" placeholder="Eigener Name" value="${this._esc(t.name || "")}" maxlength="20">
          <button data-act="up" ${i === 0 ? "disabled" : ""} title="Nach vorne">▲</button>
          <button data-act="down" ${i === all.length - 1 ? "disabled" : ""} title="Nach hinten">▼</button></div>`).join("")}
        <p class="hint">Reiter, die die Echo Show gerade nicht anbietet (etwa To-do ohne Listen), erscheinen dort nicht.</p>`;
    }
    if (this._part === "look") {
      const look = this._menu.look;
      return `<label class="hint">Farbthema</label>
        <select id="mtheme">${MENU_THEMES.map(([k, t]) => `<option value="${k}" ${look.theme === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <label class="hint" style="display:block;margin-top:14px">Kacheln nebeneinander</label>
        <div class="seg" id="mcols">${[[0, "Auto"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]].map(([v, t]) =>
          `<button data-cols="${v}" class="${(look.columns || 0) === v ? "on" : ""}">${t}</button>`).join("")}</div>
        <p class="hint" style="margin-top:14px">„Automatisch“ nimmt die Farben der Startseite, wenn sie dein Ruhebildschirm ist, sonst das Design der Echo Show.</p>`;
    }
    return `<input type="search" id="q" placeholder="Suchen …" value="${this._esc(this._filter.text)}">
      <p class="hint">Haken: kommt in den Reiter ${this._part === "scenes" ? "Szenen" : "Licht"} <small id="count"></small>.</p>`;
  }

  // Die Reiter in der eingestellten Reihenfolge, dahinter die übrigen.
  _menuTabsList() {
    const tabs = this._menu.tabs.map((t) => ({ ...t }));
    for (const [id] of MENU_TABS) if (!tabs.find((t) => t.id === id)) tabs.push({ id });
    return tabs;
  }

  _menuDevicesHtml() {
    if (!this._isList()) return "";
    const allowed = MENU_DOMAINS[this._part];
    const text = this._filter.text.toLowerCase();
    const inList = new Set(this._items.filter((i) => i.entity).map((i) => i.entity));
    const named = [];
    for (const e of this._registry) {
      const d = e.ei.split(".")[0];
      if (!allowed.includes(d) || e.hb || e.ec != null) continue;
      const name = this._friendly(e.ei);
      if (text && !(name.toLowerCase().includes(text) || e.ei.includes(text))) continue;
      named.push({ e, name, area: this._areaOf(e) || "Ohne Raum" });
    }
    named.sort((a, b) => (a.area === "Ohne Raum") - (b.area === "Ohne Raum") || a.area.localeCompare(b.area)
      || inList.has(b.e.ei) - inList.has(a.e.ei) || a.name.localeCompare(b.name));
    let html = "", group = null;
    for (const { e, name, area } of named.slice(0, MAX_ROWS)) {
      if (area !== group) { html += `<div class="group">${this._esc(area)}</div>`; group = area; }
      html += `<label class="dev" data-entity="${e.ei}"><input type="checkbox" ${inList.has(e.ei) ? "checked" : ""}>
        <ha-icon icon="${this._esc(this._defaultIcon(e.ei))}"></ha-icon>
        <span class="n"><div>${this._esc(name)}</div><small>${e.ei}</small></span></label>`;
    }
    return html || `<p class="hint">Nichts gefunden.</p>`;
  }

  // Die Vorschau: die Reiterleiste wie auf der Echo Show, darunter die Kacheln des Reiters (für Reiter
  // und Aussehen die von Licht), in den Farben des gewählten Themas.
  _menuPreviewHtml() {
    const look = this._menu.look;
    const [ground, accent, soft, rules] = MENU_COLORS[look.theme || "start"] || MENU_COLORS.start;
    const tabs = this._menuTabsList().filter((t) => t.show !== false);
    const showing = this._part === "scenes" ? "scenes" : "light";
    const tabName = (t) => t.name || MENU_TABS.find(([k]) => k === t.id)?.[1] || t.id;
    const strip = tabs.slice(0, 7).map((t) => `<span class="${t.id === showing ? "on" : ""}">${this._esc(tabName(t))}</span>`).join("");
    const cols = look.columns || Math.min(Math.max(Math.floor((916 + 14) / (200 + 14)), 2), 6); // wie drawer_ottoman_tiles.go: 4
    const list = this._items;
    let body = "";
    list.forEach((it, idx) => {
      if (it.heading !== undefined) {
        body += `<div class="mhead ${this._selected === "#" + idx ? "sel" : ""}" draggable="true" data-idx="${idx}" data-sel="#${idx}">${this._esc(it.heading)}</div>`;
      } else body += this._mTileHtml(it, idx, ground, accent);
    });
    if (!list.some((i) => i.entity)) {
      body += `<div class="mhead" style="color:${soft};cursor:default;grid-column:1/-1">${this._isList()
        ? "Noch nichts ausgewählt: die Echo Show zeigt wie bisher die Geräte mit dem Label „echo“. Hake links an, was hierher soll."
        : "Licht zeigt die Geräte mit dem Label „echo“."}</div>`;
    }
    return `<div style="--mg:${ground};--ma:${accent};--md:${soft};--mr:${rules};display:contents">
      <div class="mtop"><div class="mtabs">${strip}</div><span class="x">×</span></div>
      <div class="mgrid" style="grid-template-columns:repeat(${cols},1fr)">${body}</div></div>`;
  }

  // Eine Kachel des Menüs, wie drawer_ottoman_tiles.go sie zeichnet.
  _mTileHtml(it, idx, ground, accent) {
    const on = this._isOn(it.entity) && !it.entity.startsWith("scene.") && !it.entity.startsWith("script.");
    const tile = `color-mix(in srgb, ${ground} 85%, #fff)`;
    const fill = on ? it.color_on || accent : it.color_off || "";
    const light = fill && fill.startsWith("#") && this._luma(fill) > 150;
    const fg = fill ? (light ? INK : "#fff") : "#f1f4f7";
    const st = this._hass.states[it.entity];
    let val = "";
    if (it.entity.startsWith("light.") || it.entity.startsWith("switch.")) {
      val = !st ? "–" : st.state === "on" ? (typeof st.attributes.brightness === "number" ? Math.round(st.attributes.brightness / 255 * 100) + " %" : "An") : "Aus";
    }
    return `<div class="mtile ${this._selected === it.entity ? "sel" : ""}" draggable="true" data-idx="${idx}" data-sel="${it.entity}"
      style="--fill:${fill || tile};--fg:${fg}"><ha-icon icon="${this._esc(it.icon || this._defaultIcon(it.entity))}"></ha-icon>
      ${val ? `<div class="val">${this._esc(val)}</div>` : ""}<div class="name">${this._esc(it.name || this._friendly(it.entity))}</div></div>`;
  }

  _menuPropsHtml() {
    if (!this._isList()) {
      return this._part === "tabs"
        ? `<h2>Reiter</h2><p class="hint">Links stellst du ein, welche Reiter das Menü zeigt, in welcher Reihenfolge und unter welchem Namen. Auf der Show gedrückt halten und Ziehen ordnet sie dort nur bis zum nächsten Speichern hier.</p>`
        : `<h2>Aussehen</h2><p class="hint">Das Farbthema gilt für das ganze Menü: Fläche, gewählter Reiter, eingeschaltete Kacheln. Eigene Farben einzelner Kacheln (unter Licht und Szenen) gehen vor.</p>`;
    }
    const it = this._item(this._selected);
    if (!it) return `<h2>Kachel</h2><p class="hint">Tippe in der Vorschau auf eine Kachel oder Überschrift, um sie zu gestalten.</p>`;
    const idx = this._items.indexOf(it);
    const nav = `<div class="actions"><button id="up" ${idx === 0 ? "disabled" : ""}>Nach vorne</button>
      <button id="down" ${idx === this._items.length - 1 ? "disabled" : ""}>Nach hinten</button></div>`;
    if (it.heading !== undefined) {
      return `<h2>Überschrift</h2><label>Text</label><input type="text" id="heading" value="${this._esc(it.heading)}">${nav}
        <div class="actions"><button id="delheading">Überschrift entfernen</button></div>`;
    }
    const [, accent] = MENU_COLORS[this._menu.look.theme || "start"] || MENU_COLORS.start;
    return `<h2>${this._esc(this._friendly(it.entity))}</h2><div class="hint">${it.entity}</div>
      <label>Name</label><input type="text" id="name" maxlength="40" placeholder="${this._esc(this._friendly(it.entity))}" value="${this._esc(it.name || "")}">
      <label>Symbol (aus mdi)</label><div id="iconpicker"></div>
      <label>Farbe, wenn an</label><div class="row"><input type="color" id="color_on" value="${it.color_on || accent}">
        ${it.color_on ? `<button class="link" id="reset_on">Zurücksetzen</button>` : `<span class="hint">Farbe des Themas</span>`}</div>
      <label>Farbe, wenn aus</label><div class="row"><input type="color" id="color_off" value="${it.color_off || "#2b3a4c"}">
        ${it.color_off ? `<button class="link" id="reset_off">Zurücksetzen</button>` : `<span class="hint">Farbe des Themas</span>`}</div>
      ${nav}<div class="actions"><button id="mremove">Aus dem Menü nehmen</button></div>`;
  }

  _renderMenuLeft() {
    const left = this._el("mleft");
    if (left) left.innerHTML = this._menuLeftHtml();
    this._renderDeviceList();
    this._renderCount();
  }

  _wireMenu() {
    const on = (id, ev, fn) => { const el = this._el(id); if (el) el.addEventListener(ev, fn); };
    on("mparts", "click", (e) => {
      const b = e.target.closest("button[data-part]");
      if (!b || b.dataset.part === this._part) return;
      this._part = b.dataset.part;
      this._selected = null;
      this._useList();
      this._render();
    });
    const left = this._el("mleft");
    if (!left) return;
    let typing = null;
    left.addEventListener("input", (e) => {
      if (e.target.id === "q") {
        this._filter.text = e.target.value;
        clearTimeout(typing);
        typing = setTimeout(() => this._renderDeviceList(), 150);
      }
    });
    left.addEventListener("change", (e) => {
      if (e.target.id === "mtheme") { this._menu.look.theme = e.target.value; this._edited(); return; }
      const row = e.target.closest(".mtabrow");
      if (!row) return;
      const tabs = this._menuTabsList();
      const t = tabs.find((x) => x.id === row.dataset.tab);
      if (e.target.dataset.act === "show") { if (e.target.checked) delete t.show; else t.show = false; }
      if (e.target.dataset.act === "name") { const v = e.target.value.trim(); if (v) t.name = v; else delete t.name; }
      if (tabs.every((x) => x.show === false)) { delete tabs[0].show; this._renderMenuLeft(); }
      this._menu.tabs = tabs;
      this._edited(false);
    });
    left.addEventListener("click", (e) => {
      const cols = e.target.closest("button[data-cols]");
      if (cols) {
        this._menu.look.columns = Number(cols.dataset.cols);
        this._renderMenuLeft();
        this._edited(false);
        return;
      }
      const b = e.target.closest(".mtabrow button[data-act]");
      if (!b) return;
      const tabs = this._menuTabsList();
      const i = tabs.findIndex((x) => x.id === b.closest(".mtabrow").dataset.tab);
      const j = b.dataset.act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= tabs.length) return;
      [tabs[i], tabs[j]] = [tabs[j], tabs[i]];
      this._menu.tabs = tabs;
      this._renderMenuLeft();
      this._edited(false);
    });
  }

  // Die Felder der gewählten Kachel oder Überschrift des Menüs.
  _wireMenuProps() {
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
    on("mremove", "click", () => { this._items.splice(idx, 1); this._selected = null; this._renderDeviceList(); this._renderCount(); this._edited(); });
    const holder = this._el("iconpicker");
    if (holder) {
      const picker = document.createElement("ha-icon-picker");
      picker.hass = this._hass;
      picker.value = it.icon || "";
      picker.placeholder = this._defaultIcon(it.entity);
      picker.addEventListener("value-changed", (e) => this._setIcon(e.detail.value || ""));
      holder.appendChild(picker);
    }
  }

  _wire() {
    const on = (id, ev, fn) => { const el = this._el(id); if (el) el.addEventListener(ev, fn); };
    on("save", "click", () => this._save());
    on("tvbtn", "click", () => this._openTV());
    on("modes", "click", (e) => {
      const b = e.target.closest("button[data-mode]");
      if (b && b.dataset.mode !== this._mode) this._setMode(b.dataset.mode);
    });
    if (!this._loaded) return;
    if (this._mode === "menu") this._wireMenu();

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
      if (this._mode === "menu" && !this._isList()) return;
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
    if (this._mode === "menu") { this._wireMenuProps(); return; }
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
      picker.addEventListener("value-changed", (e) => this._setIcon(e.detail.value || ""));
      holder.appendChild(picker);
    }
  }
}

customElements.define("echo-studio-panel", EchoStudioPanel);
