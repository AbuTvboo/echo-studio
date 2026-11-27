"""Echo Studio: die Karten der Echo Show (TECHO5) in Home Assistant gestalten.

Die Integration hält die Gestaltung (layout.py) und die eigenen Bilder, bietet sie über die
Websocket-API an und hängt die Oberfläche als Seite in die Seitenleiste. Welche Geräte auf die Echo
Show kommen, steht im Label „echo“; das setzt die Oberfläche direkt in Home Assistant.

Die Echo Show (TECHO5, Dashboard „Geräte mit Label echo“) liest die Gestaltung mit
echo_studio/layout/get und die Bilder über FILES_URL, beides mit ihrem eigenen Zugang. Hilal OS liest
dazu das Menü (menu.py) mit echo_studio/menu/get und hört auf EVENT_MENU_UPDATED.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
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
    AUDIO_SUFFIX,
    AUDIO_URL,
    DOMAIN,
    EVENT_MENU_UPDATED,
    EVENT_UPDATED,
    FILES_DIR,
    FILES_URL,
    IMAGE_TYPES,
    LABEL,
    MAX_AUDIO_BYTES,
    MAX_IMAGE_BYTES,
    MENU_STORAGE_KEY,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    STATIC_URL,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .layout import LayoutError, clean_layout, files_in
from .menu import MenuError, clean_deck_info, clean_menu, ezan_files, radio_favorite

_LOGGER = logging.getLogger(__name__)

# Die Version aus manifest.json: sie hängt an der Adresse der Oberfläche, damit der Browser nach einem
# Update die neue lädt und nicht die alte aus seinem Speicher.
VERSION = json.loads((Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))["version"]
FRONTEND_DIR = Path(__file__).parent / "frontend"


class StudioData:
    """Was die Integration zur Laufzeit hält."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.layout: dict[str, Any] = {"version": 1, "items": []}
        self.menu_store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, MENU_STORAGE_KEY)
        self.menu: dict[str, Any] = clean_menu({})
        # Was die Show zuletzt über OBS und ihre PCs sagte (nur Namen), für den Deck-Designer.
        self.deck_info: dict[str, Any] = {"computers": [], "obs_scenes": [], "obs_inputs": [], "obs_connected": False,
                                          "apps": {}, "scripts": {}, "macs": {}}
        self.files = Path(hass.config.path(FILES_DIR))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = StudioData(hass)
    stored = await data.store.async_load()
    if stored:
        try:
            data.layout = clean_layout(stored)
        except LayoutError as err:
            _LOGGER.warning("Gespeicherte Gestaltung verworfen: %s", err)
    stored_menu = await data.menu_store.async_load()
    if stored_menu:
        try:
            data.menu = clean_menu(stored_menu)
        except MenuError as err:
            _LOGGER.warning("Gespeichertes Menü verworfen: %s", err)
    await hass.async_add_executor_job(lambda: data.files.mkdir(exist_ok=True))
    hass.data[DOMAIN] = data

    if not hass.data.get(f"{DOMAIN}_registered"):
        # Websocket-Befehle, Dateien und statische Pfade lassen sich nicht abmelden: einmal je Start.
        for handler in (ws_layout_get, ws_layout_save, ws_menu_get, ws_menu_save, ws_radio_favorite,
                        ws_deck_save, ws_deck_hello, ws_deck_info, ws_offers_save, ws_image_upload, ws_info):
            websocket_api.async_register_command(hass, handler)
        hass.http.register_view(StudioFileView())
        hass.http.register_view(StudioAudioView())
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


@websocket_api.websocket_command({vol.Required("type"): "echo_studio/menu/get"})
@callback
def ws_menu_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Das Menü der Echo Show, für die Oberfläche und für Hilal OS."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    connection.send_result(msg["id"], data.menu)


@websocket_api.websocket_command(
    {vol.Required("type"): "echo_studio/menu/save", vol.Required("menu"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_menu_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Speichert das Menü; die Echo Show liest es gleich neu."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        menu = clean_menu(msg["menu"])
    except MenuError as err:
        connection.send_error(msg["id"], "invalid_menu", str(err))
        return
    unused = ezan_files(data.menu) - ezan_files(menu)  # ein ersetzter Ezan: die alte Datei weg
    data.menu = menu
    await data.menu_store.async_save(menu)
    if unused:
        await hass.async_add_executor_job(_remove_files, data.files, unused)
    hass.bus.async_fire(EVENT_MENU_UPDATED, {"tabs": len(menu["tabs"])})
    connection.send_result(msg["id"], menu)


@websocket_api.websocket_command(
    {vol.Required("type"): "echo_studio/radio/favorite", vol.Required("station"): dict, vol.Required("add"): bool}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_radio_favorite(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Ein Herz auf der Echo Show: der Sender kommt in die Favoriten des Radios oder heraus."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        menu = clean_menu(radio_favorite(data.menu, msg["station"], msg["add"]))
    except MenuError as err:
        connection.send_error(msg["id"], "invalid_station", str(err))
        return
    data.menu = menu
    await data.menu_store.async_save(menu)
    hass.bus.async_fire(EVENT_MENU_UPDATED, {"tabs": len(menu["tabs"]), "radio": True})
    connection.send_result(msg["id"], menu)


@websocket_api.websocket_command(
    {vol.Required("type"): "echo_studio/deck/save", vol.Required("deck"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_deck_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Die Show hat ihr Deck geändert (oder schickt es zum ersten Mal): es kommt ins Menü."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        menu = clean_menu({**data.menu, "deck": msg["deck"]})
    except MenuError as err:
        connection.send_error(msg["id"], "invalid_deck", str(err))
        return
    if menu == data.menu:
        connection.send_result(msg["id"], menu)
        return
    data.menu = menu
    await data.menu_store.async_save(menu)
    hass.bus.async_fire(EVENT_MENU_UPDATED, {"tabs": len(menu["tabs"]), "deck": True})
    connection.send_result(msg["id"], menu)


@websocket_api.websocket_command(
    {vol.Required("type"): "echo_studio/offers/save", vol.Required("offers"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_offers_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Die Show hat ihre Favoriten der Angebote geändert (der Stern) oder schickt sie zum ersten Mal."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        menu = clean_menu({**data.menu, "offers": msg["offers"]})
    except MenuError as err:
        connection.send_error(msg["id"], "invalid_offers", str(err))
        return
    if menu == data.menu:
        connection.send_result(msg["id"], menu)
        return
    data.menu = menu
    await data.menu_store.async_save(menu)
    hass.bus.async_fire(EVENT_MENU_UPDATED, {"tabs": len(menu["tabs"]), "offers": True})
    connection.send_result(msg["id"], menu)


@websocket_api.websocket_command(
    {vol.Required("type"): "echo_studio/deck/hello", vol.Required("info"): dict}
)
@websocket_api.require_admin
@callback
def ws_deck_hello(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Die Show sagt, welche PCs und welche Szenen und Eingänge in OBS es gibt (nur Namen)."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    try:
        data.deck_info = clean_deck_info(msg["info"])
    except MenuError as err:
        connection.send_error(msg["id"], "invalid_info", str(err))
        return
    connection.send_result(msg["id"], data.deck_info)


@websocket_api.websocket_command({vol.Required("type"): "echo_studio/deck/info"})
@callback
def ws_deck_info(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Für den Deck-Designer: die PCs und OBS' Szenen, wie die Show sie zuletzt sagte."""
    data = _data(hass)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Echo Studio ist nicht eingerichtet")
        return
    connection.send_result(msg["id"], data.deck_info)


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
        suffix = Path(name).suffix
        if data is None or "/" in name or name.startswith(".") or (suffix not in IMAGE_TYPES.values() and suffix != AUDIO_SUFFIX):
            return web.Response(status=404)
        path = data.files / name
        if not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=404)
        return web.FileResponse(path, headers={"Cache-Control": "private, max-age=86400"})


def is_mp3(raw: bytes) -> bool:
    """Ob raw eine MP3 ist: ein ID3-Kopf oder der Anfang eines Layer-III-Rahmens."""
    if raw[:3] == b"ID3":
        return True
    head = raw[:4096]
    return any(head[i] == 0xFF and head[i + 1] & 0xE0 == 0xE0 and (head[i + 1] >> 1) & 0x03 == 0x01
               for i in range(len(head) - 1))


class StudioAudioView(HomeAssistantView):
    """Nimmt eine MP3 an (der Ezan) und gibt ihren Dateinamen zurück: gleiche Datei, gleicher Name."""

    url = AUDIO_URL
    name = "api:echo_studio:audio"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        data = _data(hass)
        user = request.get("hass_user")
        if data is None:
            return self.json_message("Echo Studio ist nicht eingerichtet", status_code=404)
        if user is None or not user.is_admin:
            return self.json_message("Nur für Administratoren", status_code=403)
        # Die ganze Datei: content.read(n) gibt nur, was gerade angekommen ist (ein paar KB).
        if (request.content_length or 0) > MAX_AUDIO_BYTES:
            return self.json_message("Die Datei ist größer als 12 MB", status_code=400)
        buf = bytearray()
        async for chunk in request.content.iter_chunked(64 * 1024):
            buf.extend(chunk)
            if len(buf) > MAX_AUDIO_BYTES:
                return self.json_message("Die Datei ist größer als 12 MB", status_code=400)
        raw = bytes(buf)
        if not raw:
            return self.json_message("Die Datei ist leer", status_code=400)
        if request.content_length and len(raw) != request.content_length:
            return self.json_message("Die Datei kam nicht ganz an, bitte noch einmal", status_code=400)
        if not is_mp3(raw):
            return self.json_message("Das ist keine MP3-Datei", status_code=400)
        name = hashlib.sha256(raw).hexdigest()[:24] + AUDIO_SUFFIX
        await hass.async_add_executor_job(_write_file, data.files / name, raw)
        return self.json({"file": name, "bytes": len(raw)})
