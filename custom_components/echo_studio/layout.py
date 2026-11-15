"""Die Gestaltung der Echo-Show-Karten: prüfen und bereinigen (reines Modul, ohne Home Assistant).

Eine Gestaltung ist eine Liste von Einträgen in Anzeigereihenfolge:

    {"version": 1, "items": [
        {"heading": "Wohnzimmer"},
        {"entity": "light.eck_led", "name": "Eck-LED", "icon": "mdi:led-strip",
         "icon_image": "", "icon_mask": "", "image": "a1b2.jpg", "color_on": "#E9A23B", "color_off": "",
         "hide_name": false, "hide_state": false, "size": "1x1"}
    ]}

Eine Überschrift beginnt einen Abschnitt. Leere Felder heißen „wie die Echo Show es von sich aus
zeigt“. Bilder sind Dateinamen im Ordner von Echo Studio (FILES_DIR). icon_mask ist das Symbol
als Maske (weiß auf durchsichtig), für ein Symbol, das die Echo Show nicht selbst kennt.
"""

from __future__ import annotations

import re
from typing import Any

from .const import MAX_ITEMS, SIZES

_ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
# mdi:… und Symbole aus Paketen wie Material Symbols (m3of:…); die Echo Show kennt nur mdi und
# zeichnet die anderen nach ihrer Maske (icon_mask), die Echo Studio beim Auswählen erzeugt.
_ICON = re.compile(r"^[a-z0-9_]{1,16}:[a-z0-9_-]{1,64}$")
_FILE_KEYS = ("image", "icon_image", "icon_mask")
_FILE = re.compile(r"^[a-f0-9]{8,40}\.(png|jpg|webp|svg)$")


class LayoutError(ValueError):
    """Die Gestaltung ist nicht zu gebrauchen."""


def _text(v: Any, limit: int) -> str:
    return str(v).strip()[:limit] if isinstance(v, str) else ""


def clean_layout(raw: Any) -> dict[str, Any]:
    """Prüft eine Gestaltung und gibt sie bereinigt zurück; unbekannte Felder fallen weg."""
    if not isinstance(raw, dict):
        raise LayoutError("Gestaltung ist kein Objekt")
    items = raw.get("items", [])
    if not isinstance(items, list):
        raise LayoutError("items ist keine Liste")
    if len(items) > MAX_ITEMS:
        raise LayoutError(f"mehr als {MAX_ITEMS} Einträge")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            raise LayoutError("ein Eintrag ist kein Objekt")
        if "heading" in item:
            heading = _text(item["heading"], 40)
            if heading:
                out.append({"heading": heading})
            continue
        entity = item.get("entity")
        if not isinstance(entity, str) or not _ENTITY.match(entity):
            raise LayoutError(f"ungültige Entität: {entity!r}")
        if entity in seen:
            continue  # doppelt: nur einmal
        seen.add(entity)
        tile: dict[str, Any] = {"entity": entity}
        name = _text(item.get("name"), 40)
        if name:
            tile["name"] = name
        icon = _text(item.get("icon"), 82)
        if icon:
            if not _ICON.match(icon):
                raise LayoutError(f"ungültiges Symbol: {icon!r}")
            tile["icon"] = icon
        for key in _FILE_KEYS:
            f = _text(item.get(key), 48)
            if f:
                if not _FILE.match(f):
                    raise LayoutError(f"ungültige Datei: {f!r}")
                tile[key] = f
        for key in ("color_on", "color_off"):
            c = _text(item.get(key), 7)
            if c:
                if not _COLOR.match(c):
                    raise LayoutError(f"ungültige Farbe: {c!r}")
                tile[key] = c.upper()
        for key in ("hide_name", "hide_state"):
            if item.get(key) is True:
                tile[key] = True
        size = item.get("size", "1x1")
        tile["size"] = size if size in SIZES else "1x1"
        out.append(tile)
    return {"version": 1, "items": out}


def files_in(layout: dict[str, Any]) -> set[str]:
    """Die Bilder, die eine Gestaltung braucht."""
    return {i[k] for i in layout.get("items", []) for k in _FILE_KEYS if i.get(k)}
