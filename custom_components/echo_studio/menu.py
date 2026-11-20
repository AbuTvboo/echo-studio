"""Das Menü der Echo Show (Hilal OS): prüfen und bereinigen (reines Modul, ohne Home Assistant).

Das Menü ist das Seitenfenster mit den Reitern Licht, Musik, Radio, TV, Fußball, Kameras, Szenen …,
das auf der Startseite die Kachel „Menü“ öffnet. Seine Einstellung:

    {"version": 1,
     "tabs": [{"id": "light", "show": true, "name": "Lampen"}, {"id": "music"}, …],
     "light":  [{"heading": "Wohnzimmer"}, {"entity": "light.eck_led", "name": "Eck-LED",
                 "icon": "mdi:led-strip", "color_on": "#F4A93C", "color_off": ""}, …],
     "scenes": [{"entity": "scene.abend"}, …],
     "look": {"theme": "start", "columns": 4}}

tabs: die Reiter in ihrer Reihenfolge; show false blendet einen aus, name gibt ihm einen eigenen Namen.
Reiter, die hier nicht stehen, kommen dahinter. light und scenes: welche Kacheln die Reiter Licht und
Szenen zeigen, in dieser Reihenfolge, Überschriften beginnen Abschnitte; leer heißt „wie bisher“ (die
Geräte mit dem Label echo). look: das Farbthema des Menüs und wie viele Kacheln nebeneinander (0 heißt
„so viele, wie passen“).
"""

from __future__ import annotations

import re
from typing import Any

# Die Reiter, die die Echo Show kennt.
TABS = ("light", "music", "radio", "tv", "football", "cameras", "scenes", "announce", "call", "todo")

# Die Farbthemen: „start“ die Farben der Startseite, „show“ das Design der Echo Show, die übrigen wie
# die Farbthemen des Fernsehens.
THEMES = ("", "start", "show", "blue", "midnight", "emerald", "aubergine", "bordeaux", "sunset", "graphite", "ocean")

# Was in welche Liste darf.
DOMAINS = {"light": ("light", "switch"), "scenes": ("scene", "script")}

MAX_MENU_ITEMS = 120

_ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_ICON = re.compile(r"^mdi:[a-z0-9-]{1,64}$")  # die Echo Show zeichnet im Menü nur mdi-Symbole


class MenuError(ValueError):
    """Die Einstellung des Menüs ist nicht zu gebrauchen."""


def _text(v: Any, limit: int) -> str:
    return str(v).strip()[:limit] if isinstance(v, str) else ""


def _items(raw: Any, kind: str) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise MenuError(f"{kind} ist keine Liste")
    if len(raw) > MAX_MENU_ITEMS:
        raise MenuError(f"{kind}: mehr als {MAX_MENU_ITEMS} Einträge")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            raise MenuError(f"{kind}: ein Eintrag ist kein Objekt")
        if "heading" in item:
            heading = _text(item["heading"], 40)
            if heading:
                out.append({"heading": heading})
            continue
        entity = item.get("entity")
        if not isinstance(entity, str) or not _ENTITY.match(entity):
            raise MenuError(f"{kind}: ungültige Entität {entity!r}")
        if entity.split(".")[0] not in DOMAINS[kind]:
            raise MenuError(f"{kind}: {entity} gehört nicht hierher")
        if entity in seen:
            continue
        seen.add(entity)
        tile: dict[str, Any] = {"entity": entity}
        name = _text(item.get("name"), 40)
        if name:
            tile["name"] = name
        icon = _text(item.get("icon"), 70)
        if icon:
            if not _ICON.match(icon):
                raise MenuError(f"{kind}: ungültiges Symbol {icon!r} (nur mdi:…)")
            tile["icon"] = icon
        for key in ("color_on", "color_off"):
            c = _text(item.get(key), 7)
            if c:
                if not _COLOR.match(c):
                    raise MenuError(f"{kind}: ungültige Farbe {c!r}")
                tile[key] = c.upper()
        out.append(tile)
    return out


def clean_menu(raw: Any) -> dict[str, Any]:
    """Prüft die Einstellung des Menüs und gibt sie bereinigt zurück; unbekannte Felder fallen weg."""
    if not isinstance(raw, dict):
        raise MenuError("Menü ist kein Objekt")
    tabs_raw = raw.get("tabs", [])
    if not isinstance(tabs_raw, list):
        raise MenuError("tabs ist keine Liste")
    tabs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for t in tabs_raw:
        if not isinstance(t, dict) or t.get("id") not in TABS:
            raise MenuError(f"unbekannter Reiter: {t!r}")
        if t["id"] in seen:
            continue
        seen.add(t["id"])
        tab: dict[str, Any] = {"id": t["id"]}
        if t.get("show") is False:
            tab["show"] = False
        name = _text(t.get("name"), 20)
        if name:
            tab["name"] = name
        tabs.append(tab)
    if tabs and all(t.get("show") is False for t in tabs):
        tabs[0].pop("show", None)  # ein Reiter bleibt immer
    look_raw = raw.get("look") or {}
    if not isinstance(look_raw, dict):
        raise MenuError("look ist kein Objekt")
    theme = look_raw.get("theme", "")
    if theme not in THEMES:
        raise MenuError(f"unbekanntes Farbthema: {theme!r}")
    columns = look_raw.get("columns", 0)
    if not isinstance(columns, int) or isinstance(columns, bool) or not (columns == 0 or 2 <= columns <= 6):
        raise MenuError("columns ist 0 oder 2 bis 6")
    return {
        "version": 1,
        "tabs": tabs,
        "light": _items(raw.get("light"), "light"),
        "scenes": _items(raw.get("scenes"), "scenes"),
        "look": {"theme": theme, "columns": columns},
    }
