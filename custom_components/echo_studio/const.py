"""Konstanten von Echo Studio."""

DOMAIN = "echo_studio"

# Das Label, das ein Gerät auf die Echo Show bringt (dasselbe liest die Echo Show).
LABEL = "echo"

# Seitenleiste und Oberfläche
PANEL_URL = "echo-studio"
PANEL_TITLE = "Echo Studio"
PANEL_ICON = "mdi:tablet-dashboard"
PANEL_ELEMENT = "echo-studio-panel"
STATIC_URL = "/echo_studio_static"

# Ereignis nach dem Speichern: die Echo Show lädt dann neu
EVENT_UPDATED = "echo_studio_updated"

# Nach dem Speichern des Menüs (menu.py): die Echo Show liest es dann neu
EVENT_MENU_UPDATED = "echo_studio_menu_updated"

# Gespeicherte Gestaltung, und das Menü
STORAGE_KEY = "echo_studio.layout"
MENU_STORAGE_KEY = "echo_studio.menu"
STORAGE_VERSION = 1

# Eigene Bilder und Icons: in <config>/echo_studio, ausgeliefert nur mit Anmeldung
FILES_DIR = "echo_studio"
FILES_URL = "/api/echo_studio/file"
MAX_IMAGE_BYTES = 2 * 1024 * 1024
IMAGE_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg"}

# Der Ezan (Hilal OS): eine eigene MP3, hochgeladen in Echo Studio, liegt bei den Bildern; die Show holt
# sie mit ihrer Anmeldung und spielt sie zu den Gebetszeiten.
AUDIO_URL = "/api/echo_studio/audio"
AUDIO_SUFFIX = ".mp3"
MAX_AUDIO_BYTES = 12 * 1024 * 1024

# Grenzen, damit eine kaputte Oberfläche nichts Riesiges speichert
MAX_ITEMS = 300
SIZES = ("1x1", "2x1", "2x2")
