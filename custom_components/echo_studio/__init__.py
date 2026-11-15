"""Echo Studio: die Karten der Echo Show (TECHO5) in Home Assistant gestalten.

Die Integration hält die Gestaltung (layout.py) und die eigenen Bilder, bietet sie über die
Websocket-API an und hängt die Oberfläche als Seite in die Seitenleiste. Welche Geräte auf die Echo
Show kommen, steht im Label „echo“; das setzt die Oberfläche direkt in Home Assistant.

Die Echo Show (TECHO5, Dashboard „Geräte mit Label echo“) liest die Gestaltung mit
echo_studio/layout/get und die Bilder über FILES_URL, beides mit ihrem eigenen Zugang.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol
from aiohttp import web

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import KEY_HASS, HomeAssistantView, StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    DOMAIN,
    EVENT_UPDATED,
    FILES_DIR,
    FILES_URL,
    IMAGE_TYPES,
    LABEL,
    MAX_IMAGE_BYTES,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    STATIC_URL,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .layout import LayoutError, clean_layout, files_in

_LOGGER = logging.getLogger(__name__)

VERSION = "0.1.3"
FRONTEND_DIR = Path(__file__).parent / "frontend"


class StudioData:
    """Was die Integration zur Laufzeit hält."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.layout: dict[str, Any] = {"version": 1, "items": []}
        self.files = Path(hass.config.path(FILES_DIR))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = StudioData(hass)
    stored = await data.store.async_load()
    if stored:
        try:
            data.layout = clean_layout(stored)
        except LayoutError as err:
            _LOGGER.warning("Gespeicherte Gestaltung verworfen: %s", err)
    await hass.async_add_executor_job(lambda: data.files.mkdir(exist_ok=True))
    hass.data[DOMAIN] = data

    if not hass.data.get(f"{DOMAIN}_registered"):
        # Websocket-Befehle, Dateien und statische Pfade lassen sich nicht abmelden: einmal je Start.
        for handler in (ws_layout_get, ws_layout_save, ws_image_upload, ws_info):
            websocket_api.async_register_command(hass, handler)
        hass.http.register_view(StudioFileView())
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
        hass.data[f"{DOMAIN}_registered"] = True

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_ELEMENT,
        frontend_url_path=PANEL_URL,
        module_url=f"{STATIC_URL}/echo-studio-panel.js?v={VERSION}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=True,
        config={"label": LABEL, "files_url": FILES_URL, "version": VERSION},
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, PANEL_URL)
    hass.data.pop(DOMAIN, None)
    return True


def _data(hass: HomeAssistant) -> StudioData | None:
    return hass.data.get(DOMAIN)


@websocket_api.websocket_command({vol.Required("type"): "echo_studio/info"})
@callback
def ws_info(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Version und Label, damit die Echo Show weiß, mit wem sie spricht."""
    connection.send_result(msg["id"], {"version": VERSION, "label": LABEL, "files_url": FILES_URL})


@websocket_api.websocket_command({vol.Required("type"): "echo_studio/layout/get"})
@callback
def ws_layout_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Die Gestaltung, für die Oberfläche und für die Echo Show."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    connection.send_result(msg["id"], data.layout)


@websocket_api.websocket_command(
    {vol.Required("type"): "echo_studio/layout/save", vol.Required("layout"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_layout_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Speichert die Gestaltung und räumt Bilder weg, die sie nicht mehr braucht."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        layout = clean_layout(msg["layout"])
    except LayoutError as err:
        connection.send_error(msg["id"], "invalid_layout", str(err))
        return
    old = files_in(data.layout)
    data.layout = layout
    await data.store.async_save(layout)
    # Die Echo Show hört darauf und liest die Gestaltung gleich neu.
    hass.bus.async_fire(EVENT_UPDATED, {"items": len(layout["items"])})
    unused = old - files_in(layout)
    if unused:
        await hass.async_add_executor_job(_remove_files, data.files, unused)
    connection.send_result(msg["id"], layout)


def _remove_files(folder: Path, names: set[str]) -> None:
    for name in names:
        try:
            (folder / name).unlink(missing_ok=True)
        except OSError as err:
            _LOGGER.debug("Bild %s nicht gelöscht: %s", name, err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "echo_studio/image/upload",
        vol.Required("content_type"): vol.In(list(IMAGE_TYPES)),
        vol.Required("data"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_image_upload(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Nimmt ein Bild (Base64) an und gibt seinen Dateinamen zurück: gleiches Bild, gleicher Name."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        raw = base64.b64decode(msg["data"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_image", "Bild ist kein gültiges Base64")
        return
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        connection.send_error(msg["id"], "invalid_image", "Bild ist leer oder größer als 2 MB")
        return
    name = hashlib.sha256(raw).hexdigest()[:24] + IMAGE_TYPES[msg["content_type"]]
    await hass.async_add_executor_job(_write_file, data.files / name, raw)
    connection.send_result(msg["id"], {"file": name, "url": f"{FILES_URL}/{name}"})


def _write_file(path: Path, raw: bytes) -> None:
    if not path.exists():
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(raw)
        tmp.replace(path)


class StudioFileView(HomeAssistantView):
    """Liefert die eigenen Bilder aus, nur mit Anmeldung (die Oberfläche nutzt signierte Pfade)."""

    url = FILES_URL + "/{name}"
    name = "api:echo_studio:file"
    requires_auth = True

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        data = _data(hass)
        if data is None or "/" in name or name.startswith(".") or Path(name).suffix not in IMAGE_TYPES.values():
            return web.Response(status=404)
        path = data.files / name
        if not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=404)
        return web.FileResponse(path, headers={"Cache-Control": "private, max-age=86400"})
