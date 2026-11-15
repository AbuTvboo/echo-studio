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

# Gespeicherte Gestaltung
STORAGE_KEY = "echo_studio.layout"
STORAGE_VERSION = 1

# Eigene Bilder und Icons: in <config>/echo_studio, ausgeliefert nur mit Anmeldung
FILES_DIR = "echo_studio"
FILES_URL = "/api/echo_studio/file"
MAX_IMAGE_BYTES = 2 * 1024 * 1024
IMAGE_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg"}

# Grenzen, damit eine kaputte Oberfläche nichts Riesiges speichert
MAX_ITEMS = 300
SIZES = ("1x1", "2x1", "2x2")
