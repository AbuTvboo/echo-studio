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
  ["cameras", "Kameras"], ["scenes", "Szenen"], ["announce", "Ansagen"], ["call", "Anrufen"], ["todo", "To-do"], ["deck", "Deck"], ["news", "Nachrichten"], ["offers", "Angebote"], ["remote", "Fernbedienung"]];
const MENU_DOMAINS = { light: ["light", "switch"], scenes: ["scene", "script"] };
// Die Märkte der Angebote, wie menu.py: OFFER_STORES; ohne Wahl gelten die ersten vier üblichen.
const OFFER_STORES = ["Lidl", "EDEKA", "ALDI SÜD", "ALDI Nord", "REWE", "Kaufland", "Penny", "Netto", "Norma"];
const OFFER_DEFAULT_STORES = ["Lidl", "EDEKA", "ALDI SÜD", "REWE"];
// Das Deck (Hilal OS): was eine Taste tun kann, wie config.DeckActions der Show.
const DECK_ACTIONS = [["", "Leer"], ["ha_toggle", "Home Assistant: an/aus"], ["ha_run", "Home Assistant: ausführen (Szene, Skript, Taste)"],
  ["page", "Seite öffnen (Ordner)"], ["wol", "PC einschalten (Wake on LAN)"], ["pc_keys", "PC: Tastenkürzel"], ["pc_type", "PC: Text tippen"], ["pc_open", "PC: App oder Webseite öffnen"],
  ["pc_run", "PC: Skript ausführen"], ["pc_power", "PC: Herunterfahren, Neustart, Ruhezustand, Sperren"], ["obs_scene", "OBS: Szene wechseln"], ["obs_stream", "OBS: Stream an/aus"],
  ["obs_record", "OBS: Aufnahme an/aus"], ["obs_mute", "OBS: Ton stumm/an"], ["obs_source", "OBS: Quelle zeigen/verbergen"],
  ["tv_key", "TV: Taste der Fernbedienung"], ["tv_app", "TV: App öffnen"], ["tv_remote", "TV: Fernbedienung öffnen"]];
// Die TV-Box (Hilal OS, Android TV Remote in Home Assistant): ihre Tasten wie deck/tv.go TVKeys, und die
// App-Kacheln der Fernbedienung, solange keine eigenen eingestellt sind (remote_ottoman_data.go).
const TV_KEYS = [["POWER", "power", "An/Aus"], ["DPAD_UP", "chevron-up", "Hoch"], ["DPAD_DOWN", "chevron-down", "Runter"],
  ["DPAD_LEFT", "chevron-left", "Links"], ["DPAD_RIGHT", "chevron-right", "Rechts"], ["DPAD_CENTER", "circle-outline", "OK"],
  ["BACK", "arrow-left", "Zurück"], ["HOME", "home", "Home"], ["MENU", "menu", "Menü"], ["VOLUME_UP", "volume-plus", "Lauter"],
  ["VOLUME_DOWN", "volume-minus", "Leiser"], ["VOLUME_MUTE", "volume-off", "Stumm"], ["MEDIA_PLAY_PAUSE", "play-pause", "Play/Pause"],
  ["MEDIA_NEXT", "skip-next", "Weiter"], ["MEDIA_PREVIOUS", "skip-previous", "Zurück (Titel)"], ["MEDIA_FAST_FORWARD", "fast-forward", "Vorspulen"],
  ["MEDIA_REWIND", "rewind", "Zurückspulen"], ["CHANNEL_UP", "arrow-up-bold-box-outline", "Kanal +"], ["CHANNEL_DOWN", "arrow-down-bold-box-outline", "Kanal −"],
  ["SETTINGS", "cog-outline", "Einstellungen"], ["SEARCH", "magnify", "Suche"]];
const TV_APPS = [
  { name: "YouTube", app: "com.google.android.youtube.tv", icon: "youtube", color: "#e62117" },
  { name: "Netflix", app: "com.netflix.ninja", icon: "netflix", color: "#b20710" },
  { name: "Prime Video", app: "com.amazon.amazonvideo.livingroom", icon: "play-box-outline", color: "#1a98ff" },
  { name: "Disney+", app: "com.disney.disneyplus", icon: "star-four-points-outline", color: "#113ccf" },
  { name: "Spotify", app: "com.spotify.tv.android", icon: "spotify", color: "#1db954" },
  { name: "Play Store", app: "com.android.vending", icon: "google-play", color: "#01875f" }];
// Weitere Apps, die oft auf einer TV-Box sind: zum Hinzufügen mit einem Tipp.
const TV_MORE_APPS = [
  { name: "YouTube Music", app: "com.google.android.youtube.tvmusic", icon: "music-circle", color: "#e62117" },
  { name: "ARD Mediathek", app: "de.swr.avp.ard.tv", icon: "television-classic", color: "#003480" },
  { name: "ZDF", app: "com.zdf.android.mediathek", icon: "television-classic", color: "#fa7d19" },
  { name: "Twitch", app: "tv.twitch.android.app", icon: "twitch", color: "#9146ff" },
  { name: "Plex", app: "com.plexapp.android", icon: "plex", color: "#e5a00d" },
  { name: "VLC", app: "org.videolan.vlc", icon: "vlc", color: "#ff8800" },
  { name: "Einstellungen", app: "com.android.tv.settings", icon: "cog-outline", color: "#546e7a" }];
const TV_APPS_MAX = 12;
const DECK_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#5e35b1", "#d81b60", "#6d4c41", "#546e7a", "#212121"];
const DECK_POWER = [["menu", "Auswahl (Fenster)"], ["shutdown", "Herunterfahren"], ["restart", "Neu starten"], ["sleep", "Ruhezustand"], ["lock", "Sperren"]];
const DECK_TOGGLE = ["light", "switch", "fan", "cover", "input_boolean", "media_player", "lock", "climate"];
const DECK_RUN = ["scene", "script", "button", "input_button", "automation"];
const DECK_NAMED = { blue: "#3d8be8", green: "#3fb96a", red: "#e5484d", orange: "#f08a2c", purple: "#9b6be0", gray: "#9a9a9a" };
const MENU_THEMES = [["", "Automatisch (wie die Startseite)"], ["start", "Startseite"], ["show", "Design der Echo Show"],
  ["blue", "Blau"], ["midnight", "Mitternacht"], ["emerald", "Smaragd"], ["aubergine", "Aubergine"], ["bordeaux", "Bordeaux"],
  ["sunset", "Sonnenuntergang"], ["graphite", "Graphit"], ["ocean", "Ozean"]];
// Das Radio der Echo Show (Hilal OS, screen_ottoman_radio.go): Länder, Genres, Radio Browser.
const RADIO_COUNTRIES = [["", "Wie die Echo Show (ihr Ort)"], ["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"],
  ["TR", "Türkei"], ["NL", "Niederlande"], ["BE", "Belgien"], ["FR", "Frankreich"], ["IT", "Italien"], ["ES", "Spanien"],
  ["PL", "Polen"], ["GB", "Großbritannien"], ["US", "USA"], ["GR", "Griechenland"], ["BA", "Bosnien"], ["HR", "Kroatien"],
  ["RS", "Serbien"], ["RU", "Russland"], ["UA", "Ukraine"], ["MA", "Marokko"], ["EG", "Ägypten"], ["SA", "Saudi-Arabien"]];
const RADIO_GENRES = [["pop", "Pop"], ["rock", "Rock"], ["news", "Nachrichten"], ["schlager", "Schlager"], ["oldies", "Oldies"],
  ["dance", "Dance"], ["hiphop", "Hip-Hop"], ["classical", "Klassik"], ["jazz", "Jazz"], ["turkish", "Türkisch"],
  ["electronic", "Elektronisch"], ["chillout", "Chillout"], ["80s", "80er"], ["90s", "90er"], ["metal", "Metal"],
  ["country", "Country"], ["arabic", "Arabisch"], ["kids", "Kinder"], ["talk", "Talk"], ["reggae", "Reggae"]];
const RADIO_DEFAULT_GENRES = ["pop", "rock", "news", "schlager", "oldies", "dance", "hiphop", "classical", "jazz", "turkish"];
const RADIO_LISTS = [["near", "In der Nähe"], ["top", "Beliebt"], ["own", "Eigene (auf der Show)"], ["search", "Suche"]];
const RADIO_SERVERS = ["https://de1.api.radio-browser.info", "https://de2.api.radio-browser.info",
  "https://fi1.api.radio-browser.info", "https://nl1.api.radio-browser.info"];
const RADIO_MAX = 60;

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
/* Das Deck: wie drawer_ottoman_deck.go, dunkel wie Macro Deck */
/* Die Fernbedienung (Hilal OS): ihre Vorschau wie screen_ottoman_remote.go, in Einheiten der Show (960 breit). */
.rcscreen { --u:0.10417cqw; aspect-ratio:16/10; overflow:hidden; background:linear-gradient(180deg,#14212d,#0b1520); color:#eef3f6;
  padding:calc(var(--u)*14) calc(var(--u)*16); display:flex; flex-direction:column; gap:calc(var(--u)*26);
  font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.rchead { height:calc(var(--u)*70); flex:none; display:flex; align-items:center; gap:calc(var(--u)*14); padding:0 calc(var(--u)*16);
  border-radius:calc(var(--u)*22); background:linear-gradient(180deg,#22313f,#1a2733); box-shadow:0 calc(var(--u)*4) calc(var(--u)*14) rgba(0,0,0,.4); }
.rchead ha-icon { --mdc-icon-size:calc(var(--u)*32); color:#4fd1c5; }
.rchead b { font-size:calc(var(--u)*30); }
.rchead span { flex:1; font-size:calc(var(--u)*21); color:#a9b6c3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rcround { width:calc(var(--u)*46); height:calc(var(--u)*46); border-radius:50%; border:calc(var(--u)*3) solid #2b5560; display:flex;
  align-items:center; justify-content:center; font-style:normal; font-size:calc(var(--u)*26); color:#4fd1c5; flex:none; }
.rcround:first-of-type { border-color:#f4a93c; } .rcround:first-of-type ha-icon { color:#f4a93c; --mdc-icon-size:calc(var(--u)*24); }
.rcbody { flex:1; min-height:0; display:flex; gap:calc(var(--u)*30); padding-left:calc(var(--u)*12); }
.rcleft { width:calc(var(--u)*345); display:flex; flex-direction:column; gap:calc(var(--u)*14); flex:none; }
.rcpad { position:relative; width:calc(var(--u)*345); height:calc(var(--u)*345); border-radius:50%; background:linear-gradient(180deg,#2a3c4d,#1f2d3a);
  box-shadow:0 calc(var(--u)*4) calc(var(--u)*16) rgba(0,0,0,.45), inset 0 0 0 calc(var(--u)*2) #2d5a63; }
.rcpad ha-icon { position:absolute; --mdc-icon-size:calc(var(--u)*44); color:#eef3f6; }
.rcpad .u { left:50%; top:9%; transform:translateX(-50%); } .rcpad .d { left:50%; bottom:9%; transform:translateX(-50%); }
.rcpad .l { top:50%; left:9%; transform:translateY(-50%); } .rcpad .r { top:50%; right:9%; transform:translateY(-50%); }
.rcpad b { position:absolute; left:32%; top:32%; width:36%; height:36%; border-radius:50%; background:linear-gradient(180deg,#2f4252,#24323f);
  display:flex; align-items:center; justify-content:center; font-size:calc(var(--u)*32); box-shadow:0 calc(var(--u)*3) calc(var(--u)*10) rgba(0,0,0,.4); }
.rcrow { display:flex; gap:calc(var(--u)*14); height:calc(var(--u)*70); }
.rcrow i { flex:1; border-radius:calc(var(--u)*35); background:linear-gradient(180deg,#2f4252,#24323f); display:flex; align-items:center; justify-content:center; }
.rcrow ha-icon { --mdc-icon-size:calc(var(--u)*30); }
.rcvol { width:calc(var(--u)*96); flex:none; border-radius:calc(var(--u)*48); background:linear-gradient(180deg,#2a3c4d,#1f2d3a); display:flex;
  flex-direction:column; justify-content:space-around; align-items:center; }
.rcvol ha-icon { --mdc-icon-size:calc(var(--u)*36); }
.rcapps { flex:1; display:grid; gap:calc(var(--u)*14); align-content:start; grid-auto-rows:minmax(calc(var(--u)*70), calc(var(--u)*150)); }
.rctile { border-radius:calc(var(--u)*18); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:calc(var(--u)*10);
  background:linear-gradient(180deg, color-mix(in srgb, var(--c) 60%, #2a3c4d), color-mix(in srgb, var(--c) 50%, #121c26)); font-weight:700;
  font-size:calc(var(--u)*20); box-shadow:0 calc(var(--u)*3) calc(var(--u)*10) rgba(0,0,0,.35); overflow:hidden; text-align:center; }
.rctile ha-icon { --mdc-icon-size:calc(var(--u)*40); }
.rcapp input[type=text] { min-width:0; }
.dktv button { display:inline-flex; align-items:center; gap:4px; }
.dkscreen { --u:0.10417cqw; aspect-ratio:16/10; overflow:hidden; position:relative;
  background:#171719; color:#f4f4f6; font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.dkgrid { position:absolute; inset:0; }
.dktop { position:absolute; left:0; right:0; top:0; display:flex; align-items:center; gap:calc(var(--u)*14); padding:0 calc(var(--u)*17);
  background:color-mix(in srgb, var(--mg) 90%, #000); }
.dktop .mtabs { --mr:color-mix(in srgb, var(--mg) 70%, #fff); --md:#c8d0da; }
.dktop .x { flex:none; width:calc(var(--u)*45); height:calc(var(--u)*45); border-radius:50%; background:color-mix(in srgb, var(--mg) 70%, #fff);
  display:flex; align-items:center; justify-content:center; font-size:calc(var(--u)*30); color:#fff; }
.ostores { display:flex; flex-wrap:wrap; gap:6px 14px; }
.ochk { display:flex; align-items:center; gap:6px; font-size:14px; }
.dkkey { position:absolute; width:var(--k); height:var(--k); box-sizing:border-box; padding:0; margin:0; border-radius:calc(var(--k)*0.14); cursor:grab; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:calc(var(--k)*0.04); --c:#2b2b2f;
  background:linear-gradient(180deg, color-mix(in srgb, var(--c) 88%, #fff), color-mix(in srgb, var(--c) 92%, #000));
  border:1px solid color-mix(in srgb, var(--c) 78%, #fff); box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(0,0,0,.45); }
.dkkey.lit { box-shadow:0 0 calc(var(--u)*16) color-mix(in srgb, var(--c) 70%, transparent); border-color:color-mix(in srgb, var(--c) 45%, #fff); }
.dkkey.empty { background:#1f1f22; border:1px solid #3a3a40; box-shadow:none; }
.dkkey ha-icon { --mdc-icon-size:calc(var(--k)*0.44); color:#f4f4f6; pointer-events:none; }
.dkkey .l { max-width:88%; font-size:calc(var(--k)*0.13); font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  text-shadow:0 1px 2px rgba(0,0,0,.6); pointer-events:none; }
.dkkey .fold { position:absolute; right:calc(var(--k)*0.08); top:calc(var(--k)*0.02); font-size:calc(var(--k)*0.16); opacity:.7; pointer-events:none; }
.dkkey.sel { outline:3px solid #4f8cff; outline-offset:3px; }
.dkkey.drop { outline:3px dashed #fff; outline-offset:3px; }
.dkkey.dragging { opacity:.4; }
.dkbar { position:absolute; display:flex; align-items:center; justify-content:center; }
.dkt { text-align:center; font-weight:700; font-size:calc(var(--u)*18); }
.dkdots { display:flex; gap:calc(var(--u)*8); justify-content:center; margin-top:calc(var(--u)*5); }
.dkdots i { width:calc(var(--u)*7); height:calc(var(--u)*7); border-radius:50%; background:#3a3a40; }
.dkdots i.on { background:#f4f4f6; }
.dkarrows { position:absolute; right:0; display:flex; gap:calc(var(--u)*9); }
.dkarrows span { width:calc(var(--u)*36); height:calc(var(--u)*36); border-radius:50%; background:#33333a; display:flex; align-items:center;
  justify-content:center; font-size:calc(var(--u)*24); cursor:pointer; user-select:none; }
.dkgridset { gap:8px; align-items:center; }
.dkpage button[data-act="go"].on { background:#4f8cff; color:#fff; }
.dkadd button { margin-left:auto; min-width:34px; font-size:18px; }
.dkapps { display:flex; flex-wrap:wrap; gap:6px; max-height:260px; overflow:auto; margin-top:8px; }
.dkapps button { display:flex; align-items:center; gap:6px; padding:6px 10px; font-size:13px; }
.dkapps button ha-icon { --mdc-icon-size:18px; }
.dkapps button.on { background:#4f8cff; color:#fff; }
.dkswatch { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.dkswatch button { width:30px; height:30px; padding:0; border-radius:8px; background:var(--c); border:2px solid transparent; color:#fff; }
.dkswatch button.on { border-color:#fff; outline:2px solid #4f8cff; }
.dkswatch input[type=color] { width:38px; height:32px; padding:0; border:none; background:none; }
/* Das Radio: wie screen_ottoman_radio_draw.go, in den Farben der Startseite */
.rpage { --u:0.10417cqw; aspect-ratio:16/10; overflow:hidden; display:flex; flex-direction:column; gap:calc(var(--u)*14);
  padding:calc(var(--u)*14) calc(var(--u)*16); color:#f1f4f7; background:linear-gradient(180deg, #132233, #0a1521);
  font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.rplayer { flex:none; height:calc(var(--u)*126); display:flex; align-items:center; gap:calc(var(--u)*18); padding:0 calc(var(--u)*16) 0 calc(var(--u)*13);
  border-radius:calc(var(--u)*22); background:linear-gradient(180deg, #23354a, #1b2d3f); box-shadow:0 calc(var(--u)*4) calc(var(--u)*16) rgba(0,0,0,.4); }
.rlogo { flex:none; width:calc(var(--u)*100); height:calc(var(--u)*100); border-radius:calc(var(--u)*16); background:#eef2f5;
  display:flex; align-items:center; justify-content:center; overflow:hidden; color:#1c1206; font-weight:700; font-size:calc(var(--u)*30); }
.rlogo img { max-width:80%; max-height:80%; object-fit:contain; }
.rlogo.none { background:#2b4a57; color:#f1f4f7; }
.rtext { flex:1; min-width:0; }
.rtext .n { font-size:calc(var(--u)*30); font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rtext .l { font-size:calc(var(--u)*21); color:#4fd6c8; margin-top:calc(var(--u)*6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rbtns { flex:none; display:flex; align-items:center; gap:calc(var(--u)*10); }
.rbtn { width:calc(var(--u)*50); height:calc(var(--u)*50); border-radius:50%; border:calc(var(--u)*3) solid #2b4a57; background:#17333e;
  display:flex; align-items:center; justify-content:center; color:#4fd6c8; --mdc-icon-size:calc(var(--u)*26); }
.rbtn.big { width:calc(var(--u)*70); height:calc(var(--u)*70); --mdc-icon-size:calc(var(--u)*40); }
.rbtn.lit { border-color:#F4A93C; color:#F4A93C; background:#3a2f24; }
.rbody { flex:1; min-height:0; display:flex; gap:calc(var(--u)*14); }
.rrail { flex:none; width:calc(var(--u)*220); border-radius:calc(var(--u)*22); background:#172839; padding:calc(var(--u)*8); overflow:hidden;
  display:flex; flex-direction:column; gap:calc(var(--u)*4); }
.rcat { flex:none; height:calc(var(--u)*48); display:flex; align-items:center; gap:calc(var(--u)*8); padding:0 calc(var(--u)*14) 0 calc(var(--u)*10);
  border-radius:calc(var(--u)*24); font-size:calc(var(--u)*21); color:#f1f4f7; --mdc-icon-size:calc(var(--u)*24); white-space:nowrap; }
.rcat ha-icon { color:#4fd6c8; }
.rcat span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.rcat small { font-size:calc(var(--u)*17); color:#a9b6c3; }
.rcat.on { background:#F4A93C; color:#1c1206; font-weight:700; }
.rcat.on ha-icon, .rcat.on small { color:#1c1206; }
.rright { flex:1; min-width:0; border-radius:calc(var(--u)*22); background:#172839; padding:calc(var(--u)*10) calc(var(--u)*14); overflow:auto; }
.rhead { height:calc(var(--u)*40); display:flex; align-items:baseline; gap:calc(var(--u)*12); padding-left:calc(var(--u)*4); margin-bottom:calc(var(--u)*8); }
.rhead b { font-size:calc(var(--u)*26); }
.rhead small { font-size:calc(var(--u)*18); color:#a9b6c3; }
.rgrid { display:grid; grid-template-columns:repeat(3, 1fr); gap:calc(var(--u)*12); }
.rtile { height:calc(var(--u)*84); border-radius:calc(var(--u)*18); background:linear-gradient(180deg, #273c51, #21364b); display:flex; align-items:center;
  gap:calc(var(--u)*12); padding:0 calc(var(--u)*12); cursor:grab; min-width:0; }
.rtile .rlogo { width:calc(var(--u)*60); height:calc(var(--u)*60); border-radius:calc(var(--u)*12); font-size:calc(var(--u)*20); }
.rtile .t { flex:1; min-width:0; font-size:calc(var(--u)*19); font-weight:700; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2;
  -webkit-box-orient:vertical; overflow:hidden; }
.rtile.lit { background:linear-gradient(180deg, #f8b955, #e09a30); color:#1c1206; }
.rtile.sel { outline:3px solid #fff; outline-offset:2px; }
.rtile.drop { box-shadow:calc(var(--u)*-6) 0 0 0 #fff; }
.rtile.dragging { opacity:.4; }
.rempty { font-size:calc(var(--u)*21); color:#a9b6c3; padding:calc(var(--u)*20) calc(var(--u)*10); line-height:1.4; }
.rres { display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:8px; }
.rres:hover { background:var(--secondary-background-color); }
.rres img, .rres .ph { width:36px; height:36px; border-radius:8px; object-fit:contain; background:#eef2f5; flex:none; }
.rres .ph { display:flex; align-items:center; justify-content:center; color:#1c1206; font-weight:700; font-size:13px; }
.rres .n { flex:1; min-width:0; }
.rres .n div { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rres .n small { color:var(--secondary-text-color); }
.rres button { padding:4px 9px; flex:none; }
.rres button.added { background:${AMBER}; color:${INK}; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chips button { padding:5px 10px; border-radius:16px; font-size:13px; }
.chips button.on { background:${AMBER}; color:${INK}; }
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
    this._part = "light";     // im Menü: "light", "scenes", "radio", "tabs", "look"
    this._radioAsk = 0;       // zählt die Suchen in Radio Browser (nur die letzte zählt)
    this._deckPage = 0;       // im Deck: die offene Seite
    this._deckInfo = null;    // die PCs und OBS' Szenen, wie die Show sie sagt
    this._deckNew = false;    // ein Deck, das hier nur angelegt, aber nie geändert wurde: nicht speichern
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
          scenes: (m.scenes || []).map((i) => ({ ...i })), look: { theme: m.look?.theme || "", columns: m.look?.columns || 0 },
          radio: this._radioFrom(m.radio), deck: this._deckFrom(m.deck), offers: this._offersFrom(m.offers),
          remote: this._remoteFrom(m.remote) };
        try { this._deckInfo = await ws({ type: "echo_studio/deck/info" }); } catch (_) { this._deckInfo = null; }
        this._radioKnown = !!m.radio; // ein Echo Studio, das das Radio schon kennt
        this._menuOK = true;
        this._followMenu();
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
        const menu = { version: 1, ...this._menu };
        if (!menu.deck || this._deckNew) delete menu.deck; // ein nur angesehenes Deck überschreibt nicht das der Show
        else menu.deck = { ...menu.deck, pages: menu.deck.pages.map((p) => {
          const buttons = p.buttons.map((b) => ({ ...b }));
          while (buttons.length && !buttons[buttons.length - 1].action) buttons.pop();
          return { ...p, buttons };
        }) };
        if (!menu.offers) delete menu.offers; // noch keine: die Show schickt ihre
        if (!menu.remote) delete menu.remote; // noch nichts eingestellt: die Show nimmt die üblichen Apps
        const saved = await this._hass.callWS({ type: "echo_studio/menu/save", menu });
        const keepNew = this._deckNew ? this._menu.deck : null;
        this._menu = { tabs: saved.tabs, light: saved.light, scenes: saved.scenes, look: saved.look, radio: this._radioFrom(saved.radio),
          deck: this._deckFrom(saved.deck) || keepNew, offers: this._offersFrom(saved.offers), remote: this._remoteFrom(saved.remote) };
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
    if (this._mode === "menu" && this._part === "deck") this._deckNew = false;
    this._renderTop();
    this._renderPreview();
    if (props) this._renderProps();
  }

  _move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= this._items.length) return false;
    if (this._mode === "menu" && this._part === "deck") { // im Deck tauschen zwei Felder
      if (to >= this._items.length) return false;
      [this._items[from], this._items[to]] = [this._items[to], this._items[from]];
      return true;
    }
    const [it] = this._items.splice(from, 1);
    this._items.splice(to > from ? to - 1 : to, 0, it);
    return true;
  }

  // Wählt die Karte oder Überschrift it, nachdem sie sich bewegt hat (ihr Index ist ein anderer).
  _select(it) {
    if (this._mode === "menu" && this._part === "deck") { this._selected = "#" + this._items.indexOf(it); return; }
    this._selected = it.heading !== undefined || !it.entity ? "#" + this._items.indexOf(it) : it.entity;
  }

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
    if (this._part === "deck") { this._items = this._deckButtons(); return; }
    if (this._part === "offers" || this._part === "remote") { this._items = []; return; }
    this._items = this._part === "scenes" ? this._menu.scenes : this._part === "radio" ? this._menu.radio.favorites : this._menu.light;
  }

  _isList() { return this._part === "light" || this._part === "scenes"; }

  _menuMainHtml() {
    const parts = [["light", "Licht"], ["scenes", "Szenen"], ["radio", "Radio"], ["deck", "Deck"], ["offers", "Angebote"], ["remote", "Fernbedienung"], ["tabs", "Reiter"], ["look", "Aussehen"]];
    return `<div class="main">
      <div class="pane" id="devpane"><h2>Menü der Echo Show</h2>
        <div class="seg mparts" id="mparts">${parts.map(([k, t]) => `<button data-part="${k}" class="${this._part === k ? "on" : ""}">${t}</button>`).join("")}</div>
        <div id="mleft">${this._menuLeftHtml()}</div><div id="devlist"></div></div>
      <div class="pane"><h2>Vorschau des Menüs</h2>
        ${this._isList() && this._suggested?.[this._part] && !this._menuDirty ? `<p class="hint" style="margin:0 4px 10px">Das zeigt die Echo Show
          gerade (alle Geräte mit dem Label „echo“). Sortiere, ergänze Überschriften oder Farben und tippe auf „Speichern“, dann
          gilt es als eigene Liste.</p>` : ""}
        <div class="screen"><div class="${this._part === "radio" ? "rpage" : this._part === "deck" ? "dkscreen" : this._part === "remote" ? "rcscreen" : "mscreen"}" id="grid"></div></div>
        <div class="actions">${this._isList() ? `<button id="addheading">+ Überschrift</button>
          <button id="byroom" title="Ordnet die Kacheln nach ihren Räumen in Home Assistant, mit dem Raum als Überschrift">Nach Räumen trennen</button>` : ""}
        <span class="hint">${this._isList()
          ? "Kacheln ziehen zum Sortieren, antippen zum Gestalten. Ist die Liste leer, zeigt die Echo Show wie bisher alle Geräte mit dem Label „echo“."
          : this._part === "deck"
          ? "Tasten antippen zum Gestalten, ziehen zum Tauschen. Nach „Speichern“ übernimmt die Echo Show das Deck gleich; was du dort änderst, erscheint hier von selbst."
          : this._part === "radio"
          ? "Favoriten ziehen zum Sortieren, antippen zum Bearbeiten. Auf der Show kommt ein Sender mit langem Druck oder dem Herz im Player dazu; das erscheint hier von selbst."
          : this._part === "remote"
          ? "So sieht die Fernbedienung auf der Echo Show aus. Kacheln links sortieren, entfernen oder dazunehmen; nach „Speichern“ übernimmt die Show sie gleich."
          : this._part === "offers"
          ? "Die Preise sucht die Echo Show selbst bei kaufDA, in der Nähe deines Zuhauses in Home Assistant. Auf der Show merkt der Stern in der Suche ein Produkt; das erscheint hier von selbst."
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
    if (this._part === "radio") return this._radioLeftHtml();
    if (this._part === "deck") return this._deckLeftHtml();
    if (this._part === "offers") return this._offersLeftHtml();
    if (this._part === "remote") return this._remoteLeftHtml();
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
    if (this._part === "deck") return this._deckDevicesHtml();
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
    if (this._part === "radio") return this._radioPreviewHtml();
    if (this._part === "deck") return this._deckPreviewHtml();
    if (this._part === "offers") return this._offersPreviewHtml();
    if (this._part === "remote") return this._remotePreviewHtml();
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
    if (this._part === "radio") return this._radioPropsHtml();
    if (this._part === "deck") return this._deckPropsHtml();
    if (this._part === "remote") return `<h2>Fernbedienung</h2><p class="hint">Die Fernbedienung steuert die TV-Box über die
      Integration „Android TV Remote“ in Home Assistant: Steuerkreuz, Zurück, Home, Lautstärke und die Apps als Kacheln. Auf der Show
      öffnet sie der Reiter „Fernbedienung“ oder eine Deck-Taste „TV: Fernbedienung öffnen“.</p><p class="hint">Eine App kommt mit ihrem
      Paketnamen dazu (etwa com.netflix.ninja). Welche App gerade läuft, zeigt die Show oben; so findest du auch den Namen einer App, die
      hier fehlt: sie auf der Box öffnen und auf der Show ablesen. Ein Link (https://…) öffnet die App, die ihn kennt.</p>`;
    if (this._part === "offers") return `<h2>Angebote</h2><p class="hint">Schreib ein Produkt so, wie du es sagst: Marke und Produkt,
      etwa „Barilla Arrabbiata“ oder „Paulaner Spezi“. Größen und Gebinde („2L“, „Kasten 20x0,5l“) sind Vorlieben: Angebote, die sie
      nennen, stehen vorn. Ein Tippfehler in einem langen Wort ist kein Problem.</p><p class="hint">Die Echo Show fragt alle vier Stunden
      bei kaufDA nach und zeigt nur die angehakten Märkte. Ist ein Favorit irgendwo im Angebot, steht die Zahl auf dem Knopf neben der
      Uhr der Startseite.</p>`;
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

  // --- Radio ----------------------------------------------------------------------------------------

  // Die Einstellung des Radios, wie Echo Studio sie speichert (menu.py, clean_radio).
  _radioFrom(r) {
    r = r || {};
    return { favorites: (r.favorites || []).map((f) => ({ ...f })), country: r.country || "",
      genres: Array.isArray(r.genres) ? r.genres.map((g) => ({ ...g })) : null, start: r.start || "",
      sort: r.sort || "popular", hide: [...(r.hide || [])] };
  }

  // Trägt die Show einen Favoriten ein oder aus, kommt das Ereignis: dann die Favoriten neu, solange
  // hier nichts ungespeichert ist.
  async _followMenu() {
    if (this._menuUnsub) return;
    try {
      this._menuUnsub = await this._hass.connection.subscribeEvents(async () => {
        if (this._menuDirty || this._busy) return;
        try {
          const m = await this._hass.callWS({ type: "echo_studio/menu/get" });
          this._menu.radio = this._radioFrom(m.radio);
          if (m.offers) this._menu.offers = this._offersFrom(m.offers); // der Stern auf der Show
          if (m.deck) { this._menu.deck = this._deckFrom(m.deck); this._deckNew = false; } // auf der Show geändert
          try { this._deckInfo = await this._hass.callWS({ type: "echo_studio/deck/info" }); } catch (_) { /* wie vorher */ }
          if (this._mode === "menu") {
            this._useList(); this._renderPreview(); this._renderProps(); this._radioRenderResults();
            if (this._part === "deck") this._renderMenuLeft();
          }
        } catch (_) { /* beim nächsten Mal */ }
      }, "echo_studio_menu_updated");
    } catch (_) { /* ohne: nur ein Neuladen zeigt, was die Show eingetragen hat */ }
  }

  disconnectedCallback() {
    if (this._menuUnsub) { this._menuUnsub(); this._menuUnsub = null; }
    this._radioListen(null);
  }

  _radioGenres() {
    const r = this._menu.radio;
    return r.genres || RADIO_DEFAULT_GENRES.map((tag) => ({ tag }));
  }

  _radioGenreName(g) { return g.name || RADIO_GENRES.find(([t]) => t === g.tag)?.[1] || g.tag.replace(/^./, (c) => c.toUpperCase()); }

  _radioInitials(name) {
    return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase();
  }

  _radioLogoHtml(st) {
    return st.logo
      ? `<div class="rlogo"><img src="${this._esc(st.logo)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('none');this.replaceWith(document.createTextNode('${this._esc(this._radioInitials(st.name)).replace(/'/g, "")}'))"></div>`
      : `<div class="rlogo none">${this._esc(this._radioInitials(st.name))}</div>`;
  }

  // Links: Sender in Radio Browser finden, probehören, zu den Favoriten nehmen.
  _radioLeftHtml() {
    this._radioQ = this._radioQ ?? { text: "", country: this._menu.radio.country || "DE" };
    const q = this._radioQ;
    return `<input type="search" id="rq" placeholder="Sender suchen, z. B. 1LIVE, TRT, Klassik …" value="${this._esc(q.text)}">
      <div class="filters" style="grid-template-columns:1fr"><select id="rqcountry">
        <option value="">Alle Länder</option>${RADIO_COUNTRIES.slice(1).map(([c, n]) => `<option value="${c}" ${q.country === c ? "selected" : ""}>${n}</option>`).join("")}
      </select></div>
      <p class="hint">${q.text.trim() ? "Treffer" : "Die beliebtesten Sender"} aus <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer">Radio Browser</a>.
        ▶ hört hier im Browser probe, + nimmt in die Favoriten. <small>(${this._menu.radio.favorites.length} von ${RADIO_MAX})</small></p>
      <div id="rresults"></div>`;
  }

  _wireRadioLeft(left) {
    let typing = null;
    left.addEventListener("input", (e) => {
      if (e.target.id !== "rq") return;
      this._radioQ.text = e.target.value;
      clearTimeout(typing);
      typing = setTimeout(() => this._radioSearch(), 400);
    });
    left.addEventListener("change", (e) => {
      if (e.target.id === "rqcountry") { this._radioQ.country = e.target.value; this._radioSearch(); }
    });
    left.addEventListener("click", (e) => {
      const b = e.target.closest(".rres button[data-act]");
      if (!b) return;
      const st = this._radioFound?.[Number(b.closest(".rres").dataset.i)];
      if (!st) return;
      if (b.dataset.act === "play") { this._radioListen(this._radioPlaying === st.url ? null : st); return; }
      this._radioToggleFav(st);
    });
    this._radioSearch();
  }

  async _radioSearch() {
    const q = this._radioQ;
    const params = new URLSearchParams({ hidebroken: "true", order: "clickcount", reverse: "true", limit: "60" });
    if (q.text.trim()) params.set("name", q.text.trim());
    if (q.country) params.set("countrycode", q.country);
    const ask = ++this._radioAsk;
    const box = this._el("rresults");
    if (box && !this._radioFound) box.innerHTML = `<p class="hint">Lade …</p>`;
    let got = null;
    for (const server of RADIO_SERVERS) {
      try {
        const res = await fetch(`${server}/json/stations/search?${params}`);
        if (res.ok) { got = await res.json(); break; }
      } catch (_) { /* der nächste */ }
    }
    if (ask !== this._radioAsk) return; // eine neuere Suche ist unterwegs
    if (!got) { this._radioFound = []; if (box) box.innerHTML = `<p class="hint">Radio Browser antwortet gerade nicht.</p>`; return; }
    const seen = new Set();
    this._radioFound = got.filter((s) => {
      const key = (s.name || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (!key || seen.has(key) || !/^https?:\/\//.test(s.url_resolved || s.url || "")) return false;
      seen.add(key);
      return true;
    }).map((s) => ({ name: s.name.trim().replace(/\s+/g, " ").slice(0, 60), url: s.url_resolved || s.url,
      logo: /^https?:\/\//.test(s.favicon || "") ? s.favicon : "",
      sub: [s.countrycode, (s.tags || "").split(",")[0], s.bitrate ? s.bitrate + " kbit/s" : "", s.codec].filter(Boolean).join(" · ") }));
    this._radioRenderResults();
  }

  _radioRenderResults() {
    const box = this._el("rresults");
    if (!box || !this._radioFound) return;
    const favs = this._menu.radio.favorites;
    const same = (a, b) => a.url === b.url || a.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === b.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    box.innerHTML = this._radioFound.length ? this._radioFound.map((st, i) => {
      const fav = favs.some((f) => same(f, st));
      return `<div class="rres" data-i="${i}">${st.logo ? `<img src="${this._esc(st.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">`
        : `<div class="ph">${this._esc(this._radioInitials(st.name))}</div>`}
        <div class="n"><div>${this._esc(st.name)}</div><small>${this._esc(st.sub)}</small></div>
        <button data-act="play" title="Im Browser probehören">${this._radioPlaying === st.url ? "■" : "▶"}</button>
        <button data-act="fav" class="${fav ? "added" : ""}" title="${fav ? "Aus den Favoriten nehmen" : "Zu den Favoriten"}">${fav ? "✓" : "+"}</button></div>`;
    }).join("") : `<p class="hint">Nichts gefunden.</p>`;
  }

  _radioToggleFav(st) {
    const favs = this._menu.radio.favorites;
    const key = (n) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const at = favs.findIndex((f) => f.url === st.url || key(f.name) === key(st.name));
    if (at >= 0) favs.splice(at, 1);
    else if (favs.length >= RADIO_MAX) { this._error = `Mehr als ${RADIO_MAX} Favoriten gehen nicht.`; this._renderTop(); return; }
    else favs.push({ name: st.name, url: st.url, ...(st.logo ? { logo: st.logo } : {}) });
    this._selected = null;
    this._radioRenderResults();
    const left = this._el("mleft")?.querySelector("small");
    if (left) left.textContent = `(${favs.length} von ${RADIO_MAX})`;
    this._edited();
  }

  // Hört st im Browser probe (null: Schluss).
  _radioListen(st) {
    if (this._radioAudio) { this._radioAudio.pause(); this._radioAudio.src = ""; this._radioAudio = null; }
    this._radioPlaying = null;
    if (st) {
      this._radioAudio = new Audio(st.url);
      this._radioPlaying = st.url;
      this._radioAudio.play().catch(() => {
        this._error = `„${st.name}“ lässt sich im Browser nicht abspielen (die Show kann es trotzdem können).`;
        this._radioPlaying = null;
        this._renderTop();
        this._radioRenderResults();
        this._renderProps();
      });
    }
    this._radioRenderResults();
    if (this._part === "radio" && this._mode === "menu") this._renderProps();
  }

  // Die Vorschau: der Radio-Bildschirm der Show mit den Favoriten.
  _radioPreviewHtml() {
    const r = this._menu.radio;
    const favs = r.favorites;
    const sel = this._item(this._selected);
    const now = sel || favs[0];
    const lists = [["fav", "Favoriten", "mdi:heart"]];
    if (!r.hide.includes("near")) lists.push(["near", "In der Nähe", "mdi:map-marker-radius"]);
    if (!r.hide.includes("top")) lists.push(["top", "Beliebt", "mdi:fire"]);
    if (!r.hide.includes("own")) lists.push(["own", "Eigene", "mdi:radio-tower"]);
    if (!r.hide.includes("search")) lists.push(["search", "Suche", "mdi:magnify"]);
    for (const g of this._radioGenres()) lists.push(["g", this._radioGenreName(g), "mdi:music-note"]);
    const rail = lists.map(([id, name, icon]) => `<div class="rcat ${id === "fav" ? "on" : ""}"><ha-icon icon="${icon}"></ha-icon>
      <span>${this._esc(name)}</span>${id === "fav" && favs.length ? `<small>${favs.length}</small>` : ""}</div>`).join("");
    const tiles = favs.map((f, i) => `<div class="rtile ${this._selected === "#" + i ? "sel" : ""} ${now === f ? "lit" : ""}" draggable="true"
      data-idx="${i}" data-sel="#${i}">${this._radioLogoHtml(f)}<div class="t">${this._esc(f.name)}</div></div>`).join("");
    const btn = (icon, cls = "") => `<div class="rbtn ${cls}"><ha-icon icon="mdi:${icon}"></ha-icon></div>`;
    return `<div class="rplayer">${now ? this._radioLogoHtml(now) : `<div class="rlogo none"><ha-icon icon="mdi:radio"></ha-icon></div>`}
        <div class="rtext"><div class="n">${this._esc(now ? now.name : "Wähle einen Sender")}</div><div class="l">${now ? "Live" : ""}</div></div>
        <div class="rbtns">${btn("skip-previous")}${btn("stop", "big lit")}${btn("skip-next")}
          <span style="width:calc(var(--u)*6)"></span>${btn("volume-minus")}${btn("volume-plus")}
          <span style="width:calc(var(--u)*6)"></span>${btn("heart", "lit")}${btn("close")}</div></div>
      <div class="rbody"><div class="rrail">${rail}</div>
        <div class="rright"><div class="rhead"><b>Favoriten</b>${favs.length ? `<small>${favs.length} Sender</small>` : ""}</div>
          ${favs.length ? `<div class="rgrid">${tiles}</div>` : `<div class="rempty">Noch keine Favoriten. Suche links einen Sender und tippe auf +.</div>`}</div></div>`;
  }

  // Rechts: ein gewählter Favorit, sonst die Einstellungen des Radios.
  _radioPropsHtml() {
    const it = this._item(this._selected);
    if (it) {
      const idx = this._items.indexOf(it);
      return `<h2>Favorit</h2>
        <label>Name</label><input type="text" id="rname" maxlength="60" value="${this._esc(it.name)}">
        <label>Logo (Adresse eines Bildes)</label><div class="row">${this._radioLogoHtml(it).replace('class="rlogo', 'style="width:44px;height:44px;font-size:14px" class="rlogo')}
          <input type="text" id="rlogo" placeholder="https://…" value="${this._esc(it.logo || "")}"></div>
        <label>Stream</label><div class="hint" style="word-break:break-all">${this._esc(it.url)}</div>
        <div class="actions"><button id="rlisten">${this._radioPlaying === it.url ? "■ Probehören beenden" : "▶ Probehören"}</button></div>
        <div class="actions"><button id="up" ${idx === 0 ? "disabled" : ""}>Nach vorne</button>
          <button id="down" ${idx === this._items.length - 1 ? "disabled" : ""}>Nach hinten</button></div>
        <div class="actions"><button id="rremove">Aus den Favoriten nehmen</button><button class="link" id="rback">Zu den Einstellungen</button></div>`;
    }
    const r = this._menu.radio;
    const genres = this._radioGenres();
    const extra = genres.filter((g) => !RADIO_GENRES.some(([t]) => t === g.tag));
    return `<h2>Radio</h2>${this._radioKnown ? "" : `<p class="hint">Home Assistant kennt das Radio noch nicht: nach dem Update von Echo Studio einmal neu starten.</p>`}
      <label>Land für „Beliebt“ und die Genres</label>
      <select id="rcountry">${RADIO_COUNTRIES.map(([c, n]) => `<option value="${c}" ${r.country === c ? "selected" : ""}>${n}</option>`).join("")}</select>
      <label>Beim Öffnen</label>
      <select id="rstart">${[["", "Automatisch (zuletzt offen, sonst Favoriten)"], ["fav", "Favoriten"], ["near", "In der Nähe"], ["top", "Beliebt"],
        ["last", "Die zuletzt offene Liste"]].map(([k, t]) => `<option value="${k}" ${r.start === k ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label>Sender in den Listen</label>
      <div class="seg" id="rsort">${[["popular", "Beliebteste zuerst"], ["az", "A–Z"]].map(([k, t]) =>
        `<button data-sort="${k}" class="${r.sort === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <label>Listen links</label>
      ${RADIO_LISTS.map(([k, t]) => `<label class="check"><input type="checkbox" data-list="${k}" ${r.hide.includes(k) ? "" : "checked"}>${t}</label>`).join("")}
      <label>Genres <button class="link" id="rgdefault" ${r.genres ? "" : "disabled"}>Standard</button></label>
      <div class="chips" id="rgenres">${[...RADIO_GENRES, ...extra.map((g) => [g.tag, this._radioGenreName(g)])].map(([t, n]) =>
        `<button data-tag="${this._esc(t)}" class="${genres.some((g) => g.tag === t) ? "on" : ""}">${this._esc(n)}</button>`).join("")}</div>
      <div class="row" style="margin-top:8px"><input type="text" id="rgnew" placeholder="Eigenes Genre (Schlagwort, z. B. kurdish)" maxlength="30">
        <button id="rgadd">+</button></div>
      <p class="hint">Genres erscheinen in der Reihenfolge, in der du sie wählst. Ohne Musikbibliothek zeigt die Show nur MP3-Sender;
        mit Music Assistant spielt sie auch AAC und andere.</p>`;
  }

  _wireRadioProps() {
    const on = (id, ev, fn) => { const el = this._el(id); if (el) el.addEventListener(ev, fn); };
    const r = this._menu.radio;
    const it = this._item(this._selected);
    if (it) {
      const idx = this._items.indexOf(it);
      const step = (to) => { if (this._move(idx, to)) { this._select(it); this._edited(); } };
      on("up", "click", () => step(idx - 1));
      on("down", "click", () => step(idx + 2));
      on("rname", "change", (e) => { it.name = e.target.value.trim() || it.name; this._edited(); this._radioRenderResults(); });
      on("rlogo", "change", (e) => { const v = e.target.value.trim(); if (/^https?:\/\//.test(v)) it.logo = v; else delete it.logo; this._edited(); });
      on("rlisten", "click", () => this._radioListen(this._radioPlaying === it.url ? null : it));
      on("rremove", "click", () => { this._items.splice(idx, 1); this._selected = null; this._edited(); this._radioRenderResults(); });
      on("rback", "click", () => { this._selected = null; this._markSelected(); this._renderProps(); });
      return;
    }
    on("rcountry", "change", (e) => { r.country = e.target.value; this._edited(false); });
    on("rstart", "change", (e) => { r.start = e.target.value; this._edited(false); });
    on("rsort", "click", (e) => { const b = e.target.closest("button[data-sort]"); if (b) { r.sort = b.dataset.sort; this._edited(); } });
    this._el("props")?.querySelectorAll("input[data-list]").forEach((box) => box.addEventListener("change", () => {
      r.hide = RADIO_LISTS.map(([k]) => k).filter((k) => k === box.dataset.list ? !box.checked : r.hide.includes(k));
      this._edited(false);
    }));
    on("rgenres", "click", (e) => {
      const b = e.target.closest("button[data-tag]");
      if (!b) return;
      const list = this._radioGenres().map((g) => ({ ...g }));
      const at = list.findIndex((g) => g.tag === b.dataset.tag);
      if (at >= 0) list.splice(at, 1);
      else if (list.length < 16) list.push({ tag: b.dataset.tag });
      r.genres = list;
      this._edited();
    });
    on("rgdefault", "click", () => { r.genres = null; this._edited(); });
    const add = () => {
      const box = this._el("rgnew");
      const tag = (box?.value || "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9 &+-]{0,29}$/.test(tag)) { this._error = "Ein Genre ist ein Schlagwort aus Buchstaben und Ziffern, wie in Radio Browser."; this._renderTop(); return; }
      const list = this._radioGenres().map((g) => ({ ...g }));
      if (!list.some((g) => g.tag === tag) && list.length < 16) list.push({ tag });
      r.genres = list;
      this._error = "";
      this._edited();
    };
    on("rgadd", "click", add);
    on("rgnew", "keydown", (e) => { if (e.key === "Enter") add(); });
  }

  // --- Deck (Hilal OS, drawer_ottoman_deck.go) -----------------------------------------------------
  //
  // Der Reiter „Deck“ der Echo Show, wie Macro Deck: Seiten mit einem Raster aus Tasten. Eine Taste
  // schaltet ein Gerät, startet eine Szene oder ein Skript, öffnet eine andere Seite (Ordner), drückt
  // Tasten am PC (Deck-Programm) oder steuert OBS. Auf der Show lässt ein langer Druck umbenennen,
  // umfärben und verschieben; das kommt hierher zurück. OBS und die PCs mit ihren Schlüsseln bleiben
  // auf der Show; sie sagt nur ihre Namen (echo_studio/deck/info).

  // --- Fernbedienung (Hilal OS): welche TV-Box und welche Apps als Kacheln; screen_ottoman_remote.go. ---

  _remoteFrom(r) {
    if (!r) return null;
    return { entity: r.entity || "", apps: (r.apps || []).map((a) => ({ ...a })) };
  }

  _remoteEnsure() {
    if (!this._menu.remote) this._menu.remote = { entity: "", apps: TV_APPS.map((a) => ({ ...a })) };
    if (!this._menu.remote.apps.length) this._menu.remote.apps = TV_APPS.map((a) => ({ ...a }));
    return this._menu.remote;
  }

  // Die Kacheln, die gelten: die eigenen oder die üblichen.
  _remoteApps() {
    const own = this._menu?.remote?.apps || [];
    return own.length ? own : TV_APPS;
  }

  // Die Fernbedienungen in Home Assistant; die der Android TV Remote (sie sagt, welche App läuft) zuerst.
  _tvRemotes() {
    const states = this._hass?.states || {};
    return Object.keys(states).filter((e) => e.startsWith("remote.")).sort((a, b) =>
      (states[b].attributes?.current_activity !== undefined) - (states[a].attributes?.current_activity !== undefined) || a.localeCompare(b));
  }

  _tvAppName(id) {
    if (!id) return "";
    const a = this._remoteApps().concat(TV_APPS, TV_MORE_APPS).find((x) => x.app === id);
    if (a) return a.name;
    const parts = id.split(".").filter((p) => p && !["tv", "android", "app", "com", "de", "org", "net", "ninja", "livingroom", "atv"].includes(p));
    const last = parts[parts.length - 1] || id;
    return last.charAt(0).toUpperCase() + last.slice(1);
  }

  _tvBoxSelect(id, value) {
    const remotes = this._tvRemotes();
    return `<select id="${id}"><option value="">Automatisch (${this._esc(remotes[0] ? this._friendly(remotes[0]) : "keine gefunden")})</option>
      ${remotes.map((e) => `<option value="${this._esc(e)}" ${e === value ? "selected" : ""}>${this._esc(this._friendly(e))} – ${this._esc(e)}</option>`).join("")}</select>`;
  }

  // Die Felder einer TV-Taste im Deck.
  _tvFieldsHtml(b) {
    const a = b.action;
    if (a === "tv_remote") {
      return `<div class="hint">Ein Tipp öffnet auf der Show die Fernbedienung (Steuerkreuz, Lautstärke, Apps). Die Apps stellst du unter
        „Menü → Fernbedienung“ ein.</div>`;
    }
    const box = `<label>TV-Box</label>${this._tvBoxSelect("dktvbox", b.entity || "")}`;
    if (a === "tv_key") {
      const cur = (b.value || "").toUpperCase().replace(/^KEYCODE_/, "");
      return `${box}<label>Taste</label><div class="dkapps dktv">${TV_KEYS.map(([k, icon, name]) =>
        `<button data-tvkey="${k}" class="${k === cur ? "on" : ""}"><ha-icon icon="mdi:${icon}" style="--mdc-icon-size:18px"></ha-icon> ${this._esc(name)}</button>`).join("")}</div>
        <label>Oder eigene Taste <small class="hint">(Android-Tastenname)</small></label>
        <input type="text" id="dkvalue" value="${this._esc(b.value || "")}" placeholder="HOME, VOLUME_UP, DPAD_CENTER …" spellcheck="false">`;
    }
    const apps = [...this._remoteApps(), ...TV_MORE_APPS.filter((x) => !this._remoteApps().some((y) => y.app === x.app))];
    return `${box}<label>App</label><div class="dkapps dktv">${apps.map((x) =>
      `<button data-tvapp="${this._esc(x.app)}" class="${x.app === b.value ? "on" : ""}">${x.icon ? `<ha-icon icon="mdi:${this._esc(x.icon)}" style="--mdc-icon-size:18px"></ha-icon> ` : ""}${this._esc(x.name)}</button>`).join("")}</div>
      <label>Oder Paketname / Link</label>
      <input type="text" id="dkvalue" value="${this._esc(b.value || "")}" placeholder="com.netflix.ninja oder https://…" spellcheck="false">`;
  }

  _remoteLeftHtml() {
    const r = this._menu.remote || { entity: "", apps: [] };
    const apps = this._remoteApps();
    const more = [...TV_APPS, ...TV_MORE_APPS].filter((x) => !apps.some((y) => y.app === x.app));
    return `<label class="hint">TV-Box</label>${this._tvBoxSelect("rcbox", r.entity)}
      ${this._tvRemotes().length ? "" : `<p class="hint" style="color:#ff8a80">Home Assistant hat noch keine Fernbedienung: die Integration
        „Android TV Remote“ hinzufügen.</p>`}
      <label class="hint" style="display:block;margin-top:16px">Apps <small>(${apps.length} von ${TV_APPS_MAX})</small></label>
      ${apps.map((x, i) => `<div class="mtabrow rcapp" data-i="${i}">
        <input type="text" data-act="name" value="${this._esc(x.name)}" maxlength="24" title="Name">
        <input type="text" data-act="app" value="${this._esc(x.app)}" maxlength="200" title="Paketname oder Link" spellcheck="false" style="flex:1.4">
        <input type="color" data-act="color" value="${this._esc(x.color || "#546e7a")}" title="Farbe" style="width:34px;padding:0">
        <button data-act="up" ${i === 0 ? "disabled" : ""} title="Nach vorne">▲</button>
        <button data-act="del" title="Entfernen">✕</button></div>`).join("")}
      ${more.length && apps.length < TV_APPS_MAX ? `<label class="hint" style="display:block;margin-top:10px">Dazunehmen</label>
        <div class="dkapps">${more.map((x) => `<button data-rcadd="${this._esc(x.app)}">${x.icon ? `<ha-icon icon="mdi:${this._esc(x.icon)}" style="--mdc-icon-size:18px"></ha-icon> ` : ""}${this._esc(x.name)}</button>`).join("")}</div>` : ""}
      ${apps.length < TV_APPS_MAX ? `<div class="row" style="margin-top:8px"><input type="text" id="rcname" placeholder="Name" maxlength="24" style="flex:.8">
        <input type="text" id="rcpkg" placeholder="Paketname, z. B. com.example.app" spellcheck="false"><button id="rcadd">+ App</button></div>` : ""}
      ${this._menu.remote?.apps?.length ? `<button id="rcreset" style="margin-top:12px">Übliche Apps wiederherstellen</button>` : ""}`;
  }

  _remotePreviewHtml() {
    const apps = this._remoteApps();
    const tile = (x) => `<div class="rctile" style="--c:${this._esc(x.color || "#546e7a")}"><ha-icon icon="mdi:${this._esc(x.icon || "apps")}"></ha-icon><span>${this._esc(x.name)}</span></div>`;
    return `<div class="rchead"><ha-icon icon="mdi:remote-tv"></ha-icon><b>Fernbedienung</b><span>Läuft: ${this._esc(apps[0]?.name || "")}</span>
        <i class="rcround"><ha-icon icon="mdi:power"></ha-icon></i><i class="rcround">×</i></div>
      <div class="rcbody"><div class="rcleft"><div class="rcpad"><ha-icon class="u" icon="mdi:chevron-up"></ha-icon><ha-icon class="d" icon="mdi:chevron-down"></ha-icon>
          <ha-icon class="l" icon="mdi:chevron-left"></ha-icon><ha-icon class="r" icon="mdi:chevron-right"></ha-icon><b>OK</b></div>
          <div class="rcrow"><i><ha-icon icon="mdi:arrow-left"></ha-icon></i><i><ha-icon icon="mdi:home"></ha-icon></i><i><ha-icon icon="mdi:play-pause"></ha-icon></i></div></div>
        <div class="rcvol"><ha-icon icon="mdi:volume-plus"></ha-icon><ha-icon icon="mdi:volume-off"></ha-icon><ha-icon icon="mdi:volume-minus"></ha-icon></div>
        <div class="rcapps" style="grid-template-columns:repeat(${apps.length > 8 ? 3 : 2},1fr)">${apps.slice(0, TV_APPS_MAX).map(tile).join("")}</div></div>`;
  }

  _wireRemoteLeft(left) {
    const changed = () => { this._renderMenuLeft(); this._edited(); };
    const add = (x) => {
      const r = this._remoteEnsure();
      if (r.apps.length >= TV_APPS_MAX || r.apps.some((y) => y.app === x.app)) return;
      r.apps.push({ ...x });
      changed();
    };
    left.addEventListener("click", (e) => {
      const more = e.target.closest("button[data-rcadd]");
      if (more) { const x = [...TV_APPS, ...TV_MORE_APPS].find((y) => y.app === more.dataset.rcadd); if (x) add(x); return; }
      if (e.target.id === "rcadd") {
        const name = (this._el("rcname")?.value || "").trim();
        const app = (this._el("rcpkg")?.value || "").trim();
        if (!app) return;
        add({ name: name || this._tvAppName(app), app, icon: "apps" });
        return;
      }
      if (e.target.id === "rcreset") { if (this._menu.remote) this._menu.remote.apps = []; changed(); return; }
      const b = e.target.closest(".rcapp button[data-act]");
      if (!b) return;
      const r = this._remoteEnsure();
      const i = Number(b.closest(".rcapp").dataset.i);
      if (b.dataset.act === "del") r.apps.splice(i, 1);
      else if (b.dataset.act === "up" && i > 0) [r.apps[i - 1], r.apps[i]] = [r.apps[i], r.apps[i - 1]];
      if (!r.apps.length) r.apps = []; // leer: die Show nimmt wieder die üblichen
      changed();
    });
    left.addEventListener("change", (e) => {
      if (e.target.id === "rcbox") { this._remoteEnsure().entity = e.target.value; this._edited(); return; }
      const row = e.target.closest(".rcapp");
      if (!row) return;
      const r = this._remoteEnsure();
      const x = r.apps[Number(row.dataset.i)];
      if (!x) return;
      const v = e.target.value.trim();
      if (e.target.dataset.act === "name") x.name = v || this._tvAppName(x.app);
      if (e.target.dataset.act === "app" && v) x.app = v;
      if (e.target.dataset.act === "color") x.color = v.toLowerCase();
      changed();
    });
  }

  // --- Angebote (Hilal OS): die Lieblingsprodukte und die Märkte; die Preise sucht die Show selbst. ---

  _offersFrom(o) {
    if (!o) return null;
    return { favorites: [...(o.favorites || [])], stores: [...(o.stores || [])] };
  }

  _offersEnsure() {
    if (!this._menu.offers) this._menu.offers = { favorites: [], stores: [] };
    return this._menu.offers;
  }

  _offersLeftHtml() {
    const o = this._menu.offers || { favorites: [], stores: [] };
    const stores = o.stores.length ? o.stores : OFFER_DEFAULT_STORES;
    return `<label class="hint">Lieblingsprodukte</label>
      ${o.favorites.length ? "" : `<p class="hint">Noch keine hier. ${this._menu.offers ? "" : "Die Echo Show schickt ihre beim nächsten Verbinden."}</p>`}
      ${o.favorites.map((f, i) => `<div class="mtabrow ofav" data-i="${i}">
        <input type="text" data-act="name" value="${this._esc(f)}" maxlength="60">
        <button data-act="up" ${i === 0 ? "disabled" : ""} title="Nach vorne">▲</button>
        <button data-act="del" title="Entfernen">✕</button></div>`).join("")}
      <div class="row" style="margin-top:8px"><input type="text" id="ofnew" placeholder="z. B. Barilla Arrabbiata" maxlength="60">
        <button id="ofadd">+ Favorit</button></div>
      <label class="hint" style="display:block;margin-top:16px">Märkte</label>
      <div class="ostores">${OFFER_STORES.map((st) => `<label class="ochk"><input type="checkbox" data-store="${this._esc(st)}"
        ${stores.includes(st) ? "checked" : ""}> ${this._esc(st)}</label>`).join("")}</div>`;
  }

  _offersPreviewHtml() {
    const o = this._menu.offers || { favorites: [], stores: [] };
    const stores = o.stores.length ? o.stores : OFFER_DEFAULT_STORES;
    const cards = o.favorites.map((f) => `<div class="mtile" style="--fill:color-mix(in srgb, #172839 85%, #fff);--fg:#f1f4f7;cursor:default">
      <ha-icon icon="mdi:tag-heart-outline"></ha-icon><div class="name">${this._esc(f)}</div></div>`).join("");
    return `<div style="--mg:#172839;--ma:#f4a93c;--md:#a9b6c3;--mr:#2b4a57;display:contents">
      <div class="mtop"><div class="mtabs"><span class="on">Angebote</span><span>${this._esc(stores.join(" · "))}</span></div><span class="x">×</span></div>
      <div class="mgrid" style="grid-template-columns:repeat(2,1fr)">${cards || `<div class="mhead" style="grid-column:1/-1;color:#a9b6c3;cursor:default">Noch keine Favoriten.</div>`}</div></div>`;
  }

  _wireOffersLeft(left) {
    const changed = () => { this._renderMenuLeft(); this._edited(); };
    const add = () => {
      const el = this._el("ofnew");
      const name = (el?.value || "").trim();
      if (!name) return;
      const o = this._offersEnsure();
      if (!o.favorites.some((f) => f.toLowerCase() === name.toLowerCase())) o.favorites.push(name);
      changed();
    };
    left.addEventListener("click", (e) => {
      if (e.target.id === "ofadd") { add(); return; }
      const b = e.target.closest(".ofav button[data-act]");
      if (!b) return;
      const o = this._offersEnsure();
      const i = Number(b.closest(".ofav").dataset.i);
      if (b.dataset.act === "del") o.favorites.splice(i, 1);
      else if (b.dataset.act === "up" && i > 0) [o.favorites[i - 1], o.favorites[i]] = [o.favorites[i], o.favorites[i - 1]];
      changed();
    });
    left.addEventListener("keydown", (e) => { if (e.target.id === "ofnew" && e.key === "Enter") add(); });
    left.addEventListener("change", (e) => {
      const o = this._offersEnsure();
      const row = e.target.closest(".ofav");
      if (row && e.target.dataset.act === "name") {
        const v = e.target.value.trim();
        const i = Number(row.dataset.i);
        if (v) o.favorites[i] = v; else o.favorites.splice(i, 1);
        changed();
        return;
      }
      if (e.target.dataset.store !== undefined) {
        const now = o.stores.length ? o.stores : [...OFFER_DEFAULT_STORES];
        const st = e.target.dataset.store;
        o.stores = e.target.checked ? [...new Set([...now, st])] : now.filter((x) => x !== st);
        o.stores = OFFER_STORES.filter((x) => o.stores.includes(x));
        this._edited();
      }
    });
  }

  _deckFrom(d) {
    if (!d) return null;
    return { cols: d.cols || 5, rows: d.rows || 3,
      pages: (d.pages || []).map((p) => ({ name: p.name || "", buttons: (p.buttons || []).map((b) => ({ ...b })) })) };
  }

  _deckEnsure() {
    if (!this._menu.deck) {
      this._menu.deck = { cols: 5, rows: 3, pages: [{ name: "Seite 1", buttons: [] }] };
      this._deckNew = true; // erst eine Änderung macht es zu einem Deck, das gespeichert wird
    }
    const d = this._menu.deck;
    if (!d.pages.length) d.pages.push({ name: "Seite 1", buttons: [] });
    this._deckPage = Math.min(Math.max(this._deckPage || 0, 0), d.pages.length - 1);
    return d;
  }

  // Die Tasten der offenen Seite, auf das Raster aufgefüllt.
  _deckButtons() {
    const d = this._deckEnsure();
    const page = d.pages[this._deckPage];
    while (page.buttons.length < d.cols * d.rows) page.buttons.push({});
    return page.buttons;
  }

  _deckPageName(i) {
    const p = this._menu.deck?.pages[i];
    return (p && p.name) || `Seite ${i + 1}`;
  }

  _deckOn(b) {
    if (b.action !== "ha_toggle" || !b.entity) return false;
    const s = this._hass.states[b.entity]?.state;
    return ["on", "open", "opening", "playing", "unlocked", "home", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"].includes(s);
  }

  _deckColor(c) {
    if (!c) return "";
    return c.startsWith("#") ? c : DECK_NAMED[c] || "";
  }

  // Das Symbol, wie deck.Icon es auf der Show wählt.
  _deckIcon(b, on) {
    if (b.icon) return "mdi:" + b.icon;
    const dom = (b.entity || "").split(".")[0];
    const ha = { light: on ? "lightbulb-on" : "lightbulb-outline", switch: on ? "toggle-switch" : "toggle-switch-off-outline",
      input_boolean: on ? "toggle-switch" : "toggle-switch-off-outline", fan: on ? "fan" : "fan-off",
      cover: on ? "window-shutter-open" : "window-shutter", media_player: "play-pause", scene: "palette",
      script: "script-text-play", automation: "robot", button: "gesture-tap-button", input_button: "gesture-tap-button",
      lock: on ? "lock-open-variant" : "lock", climate: "thermostat" };
    const own = { obs_scene: "monitor", obs_stream: on ? "access-point" : "access-point-off", obs_record: on ? "record-rec" : "record",
      obs_mute: on ? "microphone-off" : "microphone", obs_source: on ? "eye" : "eye-off", pc_keys: "keyboard",
      pc_type: "form-textbox", pc_open: "open-in-app", pc_run: "script-text-play", page: "folder", wol: "power" };
    if (b.action === "ha_toggle" || b.action === "ha_run") return "mdi:" + (ha[dom] || "home-assistant");
    if (b.action === "tv_key") return "mdi:" + (TV_KEYS.find(([k]) => k === (b.value || "").toUpperCase().replace(/^KEYCODE_/, ""))?.[1] || "remote");
    if (b.action === "tv_app") return "mdi:apps";
    if (b.action === "tv_remote") return "mdi:remote-tv";
    if (b.action === "pc_power") return "mdi:" + ({ restart: "restart", sleep: "power-sleep", lock: "lock", menu: "power" }[b.value] || "power-standby");
    return own[b.action] ? "mdi:" + own[b.action] : "";
  }

  // Die Beschriftung, wie die Show sie zeigt.
  _deckLabel(b) {
    if (b.label) return b.label;
    switch (b.action) {
      case "ha_toggle": case "ha_run": return b.entity ? this._friendly(b.entity) : "";
      case "page": return b.page ? this._deckPageName(b.page - 1) : "";
      case "obs_scene": return b.scene || "";
      case "obs_stream": return "Stream";
      case "obs_record": return "Record";
      case "obs_mute": return b.input || "";
      case "obs_source": return b.source || "";
      case "pc_keys": return (b.value || "").toUpperCase();
      case "pc_type": return "Text";
      case "pc_open": case "pc_run": return b.value || "";
      case "wol": return b.computer || "Wake on LAN";
      case "tv_key": return TV_KEYS.find(([k]) => k === (b.value || "").toUpperCase().replace(/^KEYCODE_/, ""))?.[2] || b.value || "";
      case "tv_app": return this._tvAppName(b.value);
      case "tv_remote": return "Fernbedienung";
      case "pc_power": return b.value === "menu" ? b.computer || "PC" : DECK_POWER.find(([k]) => k === (b.value || "shutdown"))?.[1] || "";
    }
    return "";
  }

  // Die MAC-Adressen, die bekannt sind: von den Deck-Programmen der PCs (zuerst), aus Home Assistants
  // Geräten (ihre Verbindungen) und von den device_tracker-Entitäten.
  _deckMacs() {
    const out = [], seen = new Set();
    const add = (name, mac, pc) => {
      const m = String(mac || "").toUpperCase().replace(/-/g, ":");
      if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(m) || seen.has(m)) return;
      seen.add(m);
      out.push({ name: name || m, mac: m, pc: pc || "" });
    };
    for (const [pc, list] of Object.entries(this._deckInfo?.macs || {})) for (const m of list) add(pc, m, pc);
    for (const d of Object.values(this._devices || {})) {
      for (const [kind, v] of d.connections || []) if (kind === "mac") add(d.name_by_user || d.name, v);
    }
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (id.startsWith("device_tracker.") && st.attributes?.mac) add(st.attributes.friendly_name || id, st.attributes.mac);
    }
    const agents = out.filter((x) => x.pc), rest = out.filter((x) => !x.pc).sort((a, b) => a.name.localeCompare(b.name));
    return [...agents, ...rest];
  }

  _deckMacsHtml(chosen) {
    const q = (this._deckMacQ || "").toLowerCase();
    const hit = this._deckMacs().filter((x) => !q || x.name.toLowerCase().includes(q) || x.mac.toLowerCase().includes(q));
    const now = String(chosen || "").toUpperCase().replace(/-/g, ":");
    if (!hit.length) return `<div class="hint">Kein Gerät passt.</div>`;
    return hit.slice(0, 80).map((x) => `<button data-mac="${x.mac}" data-name="${this._esc(x.name)}" data-pc="${this._esc(x.pc)}"
      class="${x.mac === now ? "on" : ""}" title="${x.mac}"><ha-icon icon="mdi:${x.pc ? "desktop-tower-monitor" : "lan"}"></ha-icon>${this._esc(x.name)}
      <small style="opacity:.6">${x.mac.slice(-8)}</small></button>`).join("");
  }

  // Die Apps eines PCs als Knöpfe, gefiltert nach der Suche.
  _deckAppsHtml(apps, chosen) {
    const q = (this._deckAppQ || "").toLowerCase().replace(/[\s._-]/g, "");
    const hit = apps.filter((n) => !q || n.toLowerCase().replace(/[\s._-]/g, "").includes(q));
    if (!hit.length) return `<div class="hint">Keine App passt.</div>`;
    return hit.slice(0, 120).map((n) => `<button data-app="${this._esc(n)}" class="${n === chosen ? "on" : ""}">
      <ha-icon icon="${this._deckAppIcon(n)}"></ha-icon>${this._esc(n)}</button>`).join("")
      + (hit.length > 120 ? `<div class="hint">… und ${hit.length - 120} weitere: tippe mehr vom Namen.</div>` : "");
  }

  // Ein passendes Symbol für bekannte Apps.
  _deckAppIcon(name) {
    const n = name.toLowerCase();
    const known = [["firefox", "firefox"], ["chrom", "google-chrome"], ["edge", "microsoft-edge"], ["spotify", "spotify"],
      ["discord", "discord"], ["steam", "steam"], ["code", "microsoft-visual-studio-code"], ["terminal", "console"],
      ["konsole", "console"], ["powershell", "powershell"], ["files", "folder"], ["dolphin", "folder"], ["explorer", "folder"],
      ["vlc", "vlc"], ["obs", "record-rec"], ["thunderbird", "email"], ["outlook", "microsoft-outlook"], ["word", "microsoft-word"],
      ["writer", "file-document"], ["excel", "microsoft-excel"], ["calc", "calculator"], ["teams", "microsoft-teams"],
      ["whatsapp", "whatsapp"], ["telegram", "send"], ["youtube", "youtube"], ["netflix", "netflix"], ["gimp", "draw"],
      ["settings", "cog"], ["einstellungen", "cog"], ["rechner", "calculator"], ["notepad", "note-edit"], ["editor", "note-edit"]];
    const k = known.find(([w]) => n.includes(w));
    return "mdi:" + (k ? k[1] : "application");
  }

  _deckLeftHtml() {
    const d = this._deckEnsure();
    const info = this._deckInfo || {};
    const opts = (from, to, v) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map((n) => `<option value="${n}" ${n === v ? "selected" : ""}>${n}</option>`).join("");
    const pcs = (info.computers || []).length ? info.computers.map((c) => this._esc(c)).join(", ") : "keiner gekoppelt";
    const obs = info.obs_connected ? `verbunden, ${(info.obs_scenes || []).length} Szenen` : "nicht verbunden";
    return `<label class="hint">Raster (Spalten × Zeilen)</label>
      <div class="row dkgridset"><select id="dkcols">${opts(2, 8, d.cols)}</select><span>×</span><select id="dkrows">${opts(1, 5, d.rows)}</select></div>
      <label class="hint" style="display:block;margin-top:14px">Seiten</label>
      ${d.pages.map((p, i) => `<div class="mtabrow dkpage" data-p="${i}">
        <button data-act="go" class="${i === this._deckPage ? "on" : ""}" title="Zeigen">${i + 1}</button>
        <input type="text" data-act="name" placeholder="Seite ${i + 1}" value="${this._esc(p.name)}" maxlength="40">
        <button data-act="up" ${i === 0 ? "disabled" : ""} title="Nach vorne">▲</button>
        <button data-act="down" ${i === d.pages.length - 1 ? "disabled" : ""} title="Nach hinten">▼</button>
        <button data-act="del" ${d.pages.length < 2 ? "disabled" : ""} title="Seite löschen">✕</button></div>`).join("")}
      <div class="actions" style="margin-top:8px"><button id="dkaddpage" ${d.pages.length >= 10 ? "disabled" : ""}>+ Seite</button></div>
      <p class="hint">PCs: ${pcs} · OBS: ${obs}. Gekoppelt und eingerichtet werden sie auf der Einrichtungsseite der Show (Deck).</p>
      <label class="hint" style="display:block;margin-top:10px">Gerät als Taste hinzufügen</label>
      <input type="search" id="q" placeholder="Lampe, Szene, Skript … suchen" value="${this._esc(this._filter.text)}">`;
  }

  _deckDevicesHtml() {
    const text = this._filter.text.toLowerCase();
    const rows = [];
    for (const e of this._registry) {
      const dom = e.ei.split(".")[0];
      if (!DECK_TOGGLE.includes(dom) && !DECK_RUN.includes(dom)) continue;
      if (e.hb || e.ec != null) continue;
      const name = this._friendly(e.ei);
      if (text && !(name.toLowerCase().includes(text) || e.ei.includes(text))) continue;
      rows.push({ e, name, area: this._areaOf(e) || "Ohne Raum" });
    }
    rows.sort((a, b) => (a.area === "Ohne Raum") - (b.area === "Ohne Raum") || a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
    let html = "", group = null;
    for (const { e, name, area } of rows.slice(0, MAX_ROWS)) {
      if (area !== group) { html += `<div class="group">${this._esc(area)}</div>`; group = area; }
      html += `<div class="dev dkadd" data-entity="${e.ei}"><ha-icon icon="${this._esc(this._defaultIcon(e.ei))}"></ha-icon>
        <span class="n"><div>${this._esc(name)}</div><small>${e.ei}</small></span><button data-add="${e.ei}" title="Als Taste auf diese Seite">+</button></div>`;
    }
    return html || `<p class="hint">Nichts gefunden.</p>`;
  }

  // Die Vorschau, wie drawer_ottoman_deck.go den Reiter zeichnet.
  // Gerechnet in den Pixeln der Echo Show 8 (1280 × 800, wie drawer_ottoman_deck.go: dkGrid), gezeigt
  // in den 960 Einheiten der Vorschau.
  _deckPreviewHtml() {
    const d = this._deckEnsure();
    const buttons = this._deckButtons();
    const n = d.cols * d.rows;
    const S = 1.33, px = (v) => Math.round(v * S);
    const head = 109, m = px(14), gap = px(12), barH = px(48);
    const bar = d.pages.length > 1 || !d.pages.some((p) => p.buttons.some((b) => b.action));
    const ax0 = m, ay0 = head + m, ax1 = 1280 - m, ay1 = 800 - m;
    const gy1 = bar ? ay1 - barH - px(6) : ay1;
    // Die Tasten füllen die ganze Fläche, wie auf der Show (auch breiter als hoch).
    const kw = Math.floor((ax1 - ax0 - (d.cols - 1) * gap) / d.cols), kh = Math.floor((gy1 - ay0 - (d.rows - 1) * gap) / d.rows);
    const side = Math.min(kw, kh);
    const w = d.cols * kw + (d.cols - 1) * gap, h = d.rows * kh + (d.rows - 1) * gap;
    const x0 = ax0 + Math.floor((ax1 - ax0 - w) / 2), y0 = ay0 + Math.floor((gy1 - ay0 - h) / 2);
    const u = (v) => `calc(var(--u)*${(v * 0.75).toFixed(2)})`;
    const keys = buttons.slice(0, n).map((b, i) => {
      const sel = this._selected === "#" + i ? "sel" : "";
      const at = `left:${u(x0 + (i % d.cols) * (kw + gap))};top:${u(y0 + Math.floor(i / d.cols) * (kh + gap))};width:${u(kw)};height:${u(kh)}`;
      if (!b.action) return `<div class="dkkey empty ${sel}" draggable="true" data-idx="${i}" data-sel="#${i}" style="${at}"></div>`;
      const on = this._deckOn(b);
      const own = this._deckColor(b.color);
      const stateful = ["ha_toggle", "obs_scene", "obs_stream", "obs_record", "obs_mute", "obs_source"].includes(b.action)
        || (b.action === "wol" && !!b.computer);
      let fill = "#2b2b2f";
      if (on) fill = own || "#2eb85c";
      else if (own) fill = stateful ? `color-mix(in srgb, ${own} 38%, #2b2b2f)` : own;
      const icon = this._deckIcon(b, on);
      return `<div class="dkkey ${on ? "lit" : ""} ${sel}" draggable="true" data-idx="${i}" data-sel="#${i}" style="--c:${fill};${at}">
        ${icon ? `<ha-icon icon="${this._esc(icon)}"></ha-icon>` : ""}<div class="l">${this._esc(this._deckLabel(b))}</div>
        ${b.action === "page" ? `<span class="fold">›</span>` : ""}</div>`;
    }).join("");
    const dots = d.pages.length > 1 ? `<div class="dkdots">${d.pages.map((_, i) => `<i class="${i === this._deckPage ? "on" : ""}"></i>`).join("")}</div>` : "";
    const arrows = d.pages.length > 1 ? `<div class="dkarrows"><span data-dpage="prev">‹</span><span data-dpage="next">›</span></div>` : "";
    const [ground, accent] = MENU_COLORS[this._menu.look.theme || "start"] || MENU_COLORS.start;
    const tabs = this._menuTabsList().filter((t) => t.show !== false);
    const at = Math.max(tabs.findIndex((t) => t.id === "deck"), 0);
    const strip = tabs.slice(Math.max(0, at - 6), at + 1).map((t) => `<span class="${t.id === "deck" ? "on" : ""}">${this._esc(t.name
      || MENU_TABS.find(([k]) => k === t.id)?.[1] || t.id)}</span>`).join("");
    return `<div class="dktop" style="--mg:${ground};--ma:${accent};height:${u(head)}"><div class="mtabs">${strip}</div><span class="x">×</span></div>
      <div class="dkgrid" style="--k:${u(side)}">${keys}</div>
      ${bar ? `<div class="dkbar" style="top:${u(ay1 - barH)};height:${u(barH)};left:${u(ax0)};right:${u(m)}">
        <div class="dkt">${this._esc(this._deckPageName(this._deckPage))}${dots}</div>${arrows}</div>` : ""}`;
  }

  _deckPropsHtml() {
    const b = this._item(this._selected);
    if (!b) {
      return `<h2>Deck</h2><p class="hint">Tippe in der Vorschau auf ein Feld, um eine Taste anzulegen oder zu gestalten. Tasten ziehen
        tauscht sie. Links fügst du Geräte mit + hinzu, legst Seiten an und stellst das Raster ein.</p>
        <p class="hint">Eine Taste „Seite öffnen“ wirkt wie ein Ordner: auf der Show führt „Zurück“ wieder heraus. Auf der Show
        öffnet ein langer Druck auf eine Taste Umbenennen, Farbe, Verschieben und Leeren.</p>`;
    }
    const idx = this._items.indexOf(b);
    const a = b.action || "";
    const info = this._deckInfo || {};
    const list = (id, vals) => `<datalist id="${id}">${(vals || []).map((v) => `<option value="${this._esc(v)}">`).join("")}</datalist>`;
    let fields = "";
    if (a === "ha_toggle" || a === "ha_run") {
      const doms = a === "ha_toggle" ? DECK_TOGGLE : DECK_RUN;
      const ents = this._registry.filter((e) => doms.includes(e.ei.split(".")[0]) && !e.hb).map((e) => e.ei).sort();
      fields = `<label>Gerät (${a === "ha_toggle" ? "Lampe, Schalter …" : "Szene, Skript, Taste, Automation"})</label>
        <input type="text" id="dkentity" list="dkents" value="${this._esc(b.entity || "")}" placeholder="light.wohnzimmer">${list("dkents", ents)}
        ${b.entity ? `<div class="hint">${this._esc(this._friendly(b.entity))}</div>` : ""}`;
    } else if (a === "wol") {
      const pcs = info.computers || [];
      const ok = !b.value || /^([0-9a-f]{2}[:-]?){5}[0-9a-f]{2}$/i.test(b.value.trim());
      fields = `<label>MAC-Adresse des PCs</label>
        <input type="text" id="dkvalue" value="${this._esc(b.value || "")}" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17" spellcheck="false">
        ${ok ? "" : `<div class="hint" style="color:#ff8a80">Das ist keine MAC-Adresse (sechs Paare aus 0–9 und A–F).</div>`}
        ${this._deckMacs().length ? `<label>Bekannte Geräte <small class="hint">(antippen übernimmt die Adresse)</small></label>
          <input type="search" id="dkmacq" placeholder="Gerät suchen …" value="${this._esc(this._deckMacQ || "")}">
          <div class="dkapps" id="dkmacs">${this._deckMacsHtml(b.value)}</div>` : ""}
        <div class="hint">PCs mit dem Deck-Programm melden ihre Adresse selbst; dazu kommen die Geräte, die Home Assistant mit MAC-Adresse kennt
          (etwa über die Fritz!Box-Integration). Im BIOS und im Netzwerkadapter muss Wake on LAN an sein.</div>
        <label>Anzeige „läuft“ <small class="hint">(optional)</small></label>
        <select id="dkcomputer"><option value="">Ohne Anzeige</option>${pcs.map((c) =>
          `<option ${c === b.computer ? "selected" : ""}>${this._esc(c)}</option>`).join("")}</select>
        <div class="hint">Mit dem Deck-Programm auf dem PC leuchtet die Taste, solange er läuft.</div>`;
    } else if (a === "tv_key" || a === "tv_app" || a === "tv_remote") {
      fields = this._tvFieldsHtml(b);
    } else if (a === "page") {
      fields = `<label>Öffnet</label><select id="dkpagego">${this._menu.deck.pages.map((_, i) =>
        `<option value="${i + 1}" ${b.page === i + 1 ? "selected" : ""}>${this._esc(this._deckPageName(i))}</option>`).join("")}</select>`;
    } else if (a === "pc_power") {
      const pcs = info.computers || [];
      fields = `<label>PC</label>${pcs.length
        ? `<select id="dkcomputer">${(pcs.includes(b.computer) || !b.computer ? pcs : [b.computer, ...pcs]).map((c) =>
            `<option ${c === b.computer ? "selected" : ""}>${this._esc(c)}</option>`).join("")}</select>`
        : `<input type="text" id="dkcomputer" value="${this._esc(b.computer || "")}" placeholder="Name des PCs">`}
        <label>Was die Taste tut</label>
        <div class="seg dkpower">${DECK_POWER.map(([k, t]) => `<button data-power="${k}" class="${(b.value || "shutdown") === k ? "on" : ""}">${t}</button>`).join("")}</div>
        ${(b.value || "shutdown") === "menu" ? `<div class="hint">Ein Tipp auf der Show öffnet ein Fenster: Einschalten, Neu starten, Herunterfahren,
            Ruhezustand, Sperren. Für „Einschalten“ braucht es die MAC-Adresse:</div>
          <label>MAC-Adresse (für Einschalten)</label>
          <input type="text" id="dkmac" value="${this._esc(b.mac || "")}" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17" spellcheck="false">
          ${this._deckMacs().length ? `<input type="search" id="dkmacq" placeholder="Gerät suchen …" value="${this._esc(this._deckMacQ || "")}">
            <div class="dkapps" id="dkmacs">${this._deckMacsHtml(b.mac)}</div>` : ""}`
        : `<div class="hint">Herunterfahren und Neu starten brauchen auf der Show einen zweiten Tipp, damit es nicht aus Versehen passiert.</div>`}
        <div class="hint">Der PC braucht das Deck-Programm ab v1.30.5.</div>`;
    } else if (a.startsWith("pc_")) {
      const what = { pc_keys: ["Tasten", "ctrl+shift+m, media_play_pause, f13"], pc_type: ["Text", "Dieser Text wird getippt"],
        pc_open: ["App oder Webseite", "Unten antippen, oder https://youtube.com"], pc_run: ["Skript", "Name aus scripts.txt"] }[a];
      const pcs = info.computers || [];
      const pcField = pcs.length
        ? `<select id="dkcomputer">${(pcs.includes(b.computer) || !b.computer ? pcs : [b.computer, ...pcs]).map((c) =>
            `<option ${c === b.computer ? "selected" : ""}>${this._esc(c)}</option>`).join("")}</select>
           ${b.computer && !pcs.includes(b.computer) ? `<div class="hint" style="color:#ff8a80">„${this._esc(b.computer)}“ ist nicht gekoppelt.</div>` : ""}`
        : `<input type="text" id="dkcomputer" value="${this._esc(b.computer || "")}" placeholder="Name des PCs">
           <div class="hint">Noch kein PC gekoppelt (Einrichtungsseite der Show → Deck → Computers).</div>`;
      fields = `<label>PC</label>${pcField}
        <label>${what[0]}</label>${a === "pc_type"
          ? `<textarea id="dkvalue" rows="3" placeholder="${this._esc(what[1])}">${this._esc(b.value || "")}</textarea>
             <div class="hint">Steht in Home Assistant lesbar: keine Passwörter.</div>`
          : `<input type="text" id="dkvalue" value="${this._esc(b.value || "")}" placeholder="${this._esc(what[1])}">`}`;
      const pc = b.computer || pcs[0] || "";
      if (a === "pc_open") {
        const apps = (info.apps || {})[pc] || [];
        fields += apps.length
          ? `<label>Apps auf ${this._esc(pc)} <small class="hint">(${apps.length})</small></label>
             <input type="search" id="dkappq" placeholder="App suchen … (z. B. fire)" value="${this._esc(this._deckAppQ || "")}">
             <div class="dkapps" id="dkapps">${this._deckAppsHtml(apps, b.value)}</div>`
          : `<div class="hint">Die App-Liste von ${this._esc(pc || "dem PC")} kommt, sobald das Deck-Programm dort läuft und die Show es erreicht hat (bis zu drei Minuten). Ein Teil des Namens reicht auch: „firefox“ findet „Firefox ESR“.</div>`;
      }
      if (a === "pc_run") {
        const scripts = (info.scripts || {})[pc] || [];
        if (scripts.length) fields += `<div class="dkapps">${scripts.map((n) =>
          `<button data-app="${this._esc(n)}" class="${n === b.value ? "on" : ""}">${this._esc(n)}</button>`).join("")}</div>`;
      }
    } else if (a === "obs_scene" || a === "obs_source") {
      fields = `<label>Szene</label><input type="text" id="dkscene" list="dkscenes" value="${this._esc(b.scene || "")}">${list("dkscenes", info.obs_scenes)}`;
      if (a === "obs_source") fields += `<label>Quelle</label><input type="text" id="dksource" value="${this._esc(b.source || "")}">`;
    } else if (a === "obs_mute") {
      fields = `<label>Eingang</label><input type="text" id="dkinput" list="dkinputs" value="${this._esc(b.input || "")}"
        placeholder="Mikrofon, Desktop-Audio">${list("dkinputs", info.obs_inputs)}`;
    }
    const color = this._deckColor(b.color);
    return `<h2>Taste ${idx + 1} <small class="hint">${this._esc(this._deckPageName(this._deckPage))}</small></h2>
      <label>Aktion</label><select id="dkaction">${DECK_ACTIONS.map(([k, t]) => `<option value="${k}" ${a === k ? "selected" : ""}>${t}</option>`).join("")}</select>
      ${fields}
      ${a ? `<label>Beschriftung</label><input type="text" id="dklabel" maxlength="40" placeholder="${this._esc(this._deckLabel({ ...b, label: "" }))}" value="${this._esc(b.label || "")}">
      <label>Symbol (aus mdi)</label><div id="iconpicker"></div>
      <label>Farbe</label><div class="dkswatch">${["", ...DECK_COLORS].map((c) =>
        `<button data-color="${c}" class="${(b.color || "") === c ? "on" : ""}" style="--c:${c || "#2b2b2f"}" title="${c || "Standard"}">${c ? "" : "∅"}</button>`).join("")}
        <input type="color" id="dkcolor" value="${color || "#2b2b2f"}" title="Eigene Farbe"></div>
      <div class="actions"><button id="dkclear">Taste leeren</button></div>` : ""}`;
  }

  _wireDeckLeft(left) {
    // Das Deck nicht hier festhalten: Speichern und die Show ersetzen this._menu.deck, danach gingen
    // Änderungen in ein Deck, das niemand mehr zeigt. Jeder Handler holt sich das aktuelle.
    if (!this._deckInfoAt || Date.now() - this._deckInfoAt > 10000) { // die PCs und ihre Apps, frisch
      this._deckInfoAt = Date.now();
      this._hass.callWS({ type: "echo_studio/deck/info" }).then((i) => {
        this._deckInfo = i;
        if (this._mode === "menu" && this._part === "deck") { this._renderMenuLeft(); this._renderProps(); }
      }).catch(() => {});
    }
    let typing = null;
    left.addEventListener("input", (e) => {
      if (e.target.id !== "q") return;
      this._filter.text = e.target.value;
      clearTimeout(typing);
      typing = setTimeout(() => this._renderDeviceList(), 150);
    });
    left.addEventListener("change", (e) => {
      const d = this._deckEnsure();
      if (e.target.id === "dkcols" || e.target.id === "dkrows") {
        d[e.target.id === "dkcols" ? "cols" : "rows"] = Number(e.target.value);
        this._selected = null;
        this._useList();
        this._edited();
        return;
      }
      const row = e.target.closest(".dkpage");
      if (row && e.target.dataset.act === "name") {
        d.pages[Number(row.dataset.p)].name = e.target.value.trim();
        this._edited();
      }
    });
    left.addEventListener("click", (e) => {
      const d = this._deckEnsure();
      if (e.target.id === "dkaddpage") {
        if (d.pages.length >= 10) return;
        d.pages.push({ name: "", buttons: [] });
        this._deckGo(d.pages.length - 1);
        this._edited();
        return;
      }
      const b = e.target.closest(".dkpage button[data-act]");
      if (!b) return;
      const i = Number(b.closest(".dkpage").dataset.p);
      const act = b.dataset.act;
      if (act === "go") { this._deckGo(i); return; }
      if (act === "del") {
        if (d.pages.length < 2 || !confirm(`„${this._deckPageName(i)}“ mit ihren Tasten löschen?`)) return;
        d.pages.splice(i, 1);
        for (const p of d.pages) for (const k of p.buttons) {
          if (k.action === "page" && k.page) { if (k.page === i + 1) delete k.page; else if (k.page > i + 1) k.page--; }
        }
        this._deckGo(Math.min(this._deckPage, d.pages.length - 1));
        this._edited();
        return;
      }
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= d.pages.length) return;
      [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]];
      for (const p of d.pages) for (const k of p.buttons) {
        if (k.action === "page") { if (k.page === i + 1) k.page = j + 1; else if (k.page === j + 1) k.page = i + 1; }
      }
      if (this._deckPage === i) this._deckPage = j; else if (this._deckPage === j) this._deckPage = i;
      this._useList();
      this._renderMenuLeft();
      this._edited();
    });
    this._el("devlist")?.addEventListener("click", (e) => {
      const d = this._deckEnsure();
      const add = e.target.closest("button[data-add]");
      if (!add || this._part !== "deck") return;
      const id = add.dataset.add;
      const buttons = this._deckButtons();
      const free = buttons.slice(0, d.cols * d.rows).findIndex((k) => !k.action);
      if (free < 0) { this._error = "Diese Seite ist voll. Lege eine neue Seite an oder vergrößere das Raster."; this._renderTop(); return; }
      this._error = "";
      buttons[free] = { action: DECK_RUN.includes(id.split(".")[0]) ? "ha_run" : "ha_toggle", entity: id };
      this._selected = "#" + free;
      this._edited();
    });
    this._el("grid")?.addEventListener("click", (e) => {
      const d = this._deckEnsure();
      const p = e.target.closest("[data-dpage]");
      if (!p || this._part !== "deck") return;
      const n = d.pages.length;
      this._deckGo((this._deckPage + (p.dataset.dpage === "next" ? 1 : n - 1)) % n);
    });
  }

  _deckGo(i) {
    this._deckPage = i;
    this._selected = null;
    this._useList();
    this._renderMenuLeft();
    this._renderPreview();
    this._renderProps();
  }

  _wireDeckProps() {
    const on = (id, ev, fn) => { const el = this._el(id); if (el) el.addEventListener(ev, fn); };
    const b = this._item(this._selected);
    if (!b) return;
    const set = (patch, props = false) => {
      for (const [k, v] of Object.entries(patch)) { if (v === "" || v == null) delete b[k]; else b[k] = v; }
      this._edited(props);
    };
    on("dkaction", "change", (e) => {
      const a = e.target.value;
      const keep = { label: b.label, icon: b.icon, color: b.color };
      for (const k of Object.keys(b)) delete b[k];
      if (a) Object.assign(b, { action: a }, Object.fromEntries(Object.entries(keep).filter(([, v]) => v)));
      if (a === "page") b.page = Math.min(2, this._menu.deck.pages.length);
      if (a.startsWith("pc_") && this._deckInfo?.computers?.length) b.computer = this._deckInfo.computers[0];
      if (a === "pc_power") {
        b.value = "menu";
        const mac = this._deckInfo?.macs?.[b.computer]?.[0];
        if (mac) b.mac = mac.toUpperCase();
      }
      this._edited(true);
    });
    on("dkentity", "change", (e) => set({ entity: e.target.value.trim() }, true));
    on("dktvbox", "change", (e) => set({ entity: e.target.value }, true));
    this._el("props")?.querySelectorAll(".dktv").forEach((box) => box.addEventListener("click", (e) => {
      const k = e.target.closest("button[data-tvkey]");
      const app = e.target.closest("button[data-tvapp]");
      if (k) {
        const key = TV_KEYS.find(([x]) => x === k.dataset.tvkey);
        set({ value: key[0], ...(b.label && !TV_KEYS.some(([, , n]) => n === b.label) ? {} : { label: key[2] }) }, true);
      } else if (app) {
        const a = this._remoteApps().concat(TV_MORE_APPS).find((x) => x.app === app.dataset.tvapp);
        if (!a) return;
        const own = b.label && !this._remoteApps().concat(TV_MORE_APPS).some((x) => x.name === b.label);
        set({ value: a.app, ...(own ? {} : { label: a.name, icon: a.icon || "", color: b.color || a.color || "" }) }, true);
      }
    }));
    on("dkpagego", "change", (e) => set({ page: Number(e.target.value) }));
    on("dkcomputer", "change", (e) => {
      const pc = e.target.value.trim();
      const patch = { computer: pc };
      const mac = this._deckInfo?.macs?.[pc]?.[0]; // Wake on LAN: die Adresse, die das Deck-Programm meldet
      if (b.action === "wol" && mac && !b.value) patch.value = mac.toUpperCase();
      if (b.action === "pc_power" && b.value === "menu" && mac && !b.mac) patch.mac = mac.toUpperCase();
      set(patch, true);
    });
    on("dkmacq", "input", (e) => {
      this._deckMacQ = e.target.value;
      const box = this._el("dkmacs");
      if (box) box.innerHTML = this._deckMacsHtml(b.value);
    });
    this._el("dkmacs")?.addEventListener("click", (e) => {
      const m = e.target.closest("button[data-mac]");
      if (!m) return;
      const patch = b.action === "pc_power" ? { mac: m.dataset.mac } : { value: m.dataset.mac };
      if (m.dataset.pc) patch.computer = m.dataset.pc;
      if (!b.label && !m.dataset.pc && b.action === "wol") patch.label = m.dataset.name;
      this._deckMacQ = "";
      set(patch, true);
    });
    on("dkappq", "input", (e) => {
      this._deckAppQ = e.target.value;
      const box = this._el("dkapps");
      const pc = b.computer || this._deckInfo?.computers?.[0] || "";
      if (box) box.innerHTML = this._deckAppsHtml((this._deckInfo?.apps || {})[pc] || [], b.value);
    });
    this._el("props")?.querySelectorAll(".dkapps").forEach((box) => box.addEventListener("click", (e) => {
      const app = e.target.closest("button[data-app]");
      if (!app) return;
      const name = app.dataset.app;
      const patch = { value: name };
      if (!b.computer && this._deckInfo?.computers?.length) patch.computer = this._deckInfo.computers[0];
      if (!b.label) patch.label = name.replace(/\s+(ESR|Browser)$/i, "");
      if (!b.icon && b.action === "pc_open") { const ic = this._deckAppIcon(name).replace(/^mdi:/, ""); if (ic !== "application") patch.icon = ic; }
      this._deckAppQ = "";
      set(patch, true);
    }));
    on("dkvalue", "change", (e) => set({ value: e.target.value }));
    on("dkscene", "change", (e) => set({ scene: e.target.value.trim() }));
    on("dksource", "change", (e) => set({ source: e.target.value.trim() }));
    on("dkinput", "change", (e) => set({ input: e.target.value.trim() }));
    on("dklabel", "change", (e) => set({ label: e.target.value.trim() }));
    on("dkcolor", "change", (e) => set({ color: e.target.value.toLowerCase() }, true));
    this._el("props")?.querySelectorAll(".dkswatch button[data-color]").forEach((s) =>
      s.addEventListener("click", () => set({ color: s.dataset.color }, true)));
    this._el("props")?.querySelectorAll(".dkpower button[data-power]").forEach((p) =>
      p.addEventListener("click", () => set({ value: p.dataset.power }, true)));
    on("dkmac", "change", (e) => set({ mac: e.target.value.trim().toUpperCase() }));
    on("dkclear", "click", () => { for (const k of Object.keys(b)) delete b[k]; this._edited(true); });
    const holder = this._el("iconpicker");
    if (holder) {
      const picker = document.createElement("ha-icon-picker");
      picker.hass = this._hass;
      picker.value = b.icon ? "mdi:" + b.icon : "";
      picker.placeholder = this._deckIcon({ ...b, icon: "" }, false) || "mdi:gesture-tap";
      picker.addEventListener("value-changed", (e) => {
        const v = (e.detail.value || "").trim();
        if (v && !v.startsWith("mdi:")) { this._error = "Die Echo Show kennt nur Symbole aus mdi."; this._renderTop(); return; }
        this._error = "";
        set({ icon: v.replace(/^mdi:/, "") });
      });
      holder.appendChild(picker);
    }
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
    if (this._part === "radio") { this._wireRadioLeft(left); return; }
    if (this._part === "offers") { this._wireOffersLeft(left); return; }
    if (this._part === "remote") { this._wireRemoteLeft(left); return; }
    if (this._part === "deck") { this._wireDeckLeft(left); return; }
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
    if (this._part === "radio") { this._wireRadioProps(); return; }
    if (this._part === "deck") { this._wireDeckProps(); return; }
    if (this._part === "offers" || this._part === "remote") return;
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
    on("byroom", "click", () => {
      if (this._mode !== "menu" || !this._isList()) return;
      this._items.splice(0, this._items.length, ...this._byRoom(this._items));
      this._selected = null;
      this._edited();
    });
    this._wireGrid();
  }

  // byRoom ordnet die Kacheln list nach ihren Räumen in Home Assistant: je Raum eine Überschrift mit
  // seinem Namen, die Räume in der Reihenfolge, in der ihre erste Kachel kam, darin die Kacheln wie
  // vorher; was keinen Raum hat, zuletzt unter „Weitere“. Die Überschriften von vorher fallen weg.
  _byRoom(list) {
    const rooms = new Map();
    for (const it of list) {
      if (!it.entity) continue;
      const e = this._registry.find((x) => x.ei === it.entity);
      const room = (e && this._areaOf(e)) || "";
      if (!rooms.has(room)) rooms.set(room, []);
      rooms.get(room).push(it);
    }
    const out = [];
    const named = [...rooms.keys()].filter((r) => r);
    for (const room of [...named, ...(rooms.has("") ? [""] : [])]) {
      if (named.length) out.push({ heading: room || "Weitere" });
      out.push(...rooms.get(room));
    }
    return out;
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
