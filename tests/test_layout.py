"""Die Prüfung der Gestaltung (custom_components/echo_studio/layout.py), ohne Home Assistant."""

import importlib.util
import pathlib
import sys
import types

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1] / "custom_components" / "echo_studio"


def _load():
    # layout.py importiert nur .const: beide ohne das Paket (und ohne Home Assistant) laden.
    pkg = types.ModuleType("echo_studio")
    pkg.__path__ = [str(ROOT)]
    sys.modules["echo_studio"] = pkg
    for name in ("const", "layout"):
        spec = importlib.util.spec_from_file_location(f"echo_studio.{name}", ROOT / f"{name}.py")
        mod = importlib.util.module_from_spec(spec)
        sys.modules[f"echo_studio.{name}"] = mod
        spec.loader.exec_module(mod)
    return sys.modules["echo_studio.layout"]


layout = _load()


def test_clean_keeps_what_is_set_and_drops_the_rest():
    got = layout.clean_layout({"items": [
        {"heading": "  Wohnzimmer  "},
        {"entity": "light.eck", "name": "Eck-LED", "icon": "mdi:led-strip", "color_on": "#e9a23b",
         "hide_name": True, "hide_state": False, "size": "2x1", "evil": "<script>"},
        {"entity": "switch.kaffee"},
        {"entity": "switch.kaffee", "name": "doppelt"},
        {"heading": "   "},
    ]})
    assert got == {"version": 1, "items": [
        {"heading": "Wohnzimmer"},
        {"entity": "light.eck", "name": "Eck-LED", "icon": "mdi:led-strip", "color_on": "#E9A23B",
         "hide_name": True, "size": "2x1"},
        {"entity": "switch.kaffee", "size": "1x1"},
    ]}


@pytest.mark.parametrize("item", [
    {"entity": "not an entity"},
    {"entity": "light.x", "color_on": "red"},
    {"entity": "light.x", "icon": "bulb"},
    {"entity": "light.x", "icon": "mdi:<script>"},
    {"entity": "light.x", "icon_mask": "../mask.png"},
    {"entity": "light.x", "image": "../../secrets.yaml"},
    "nope",
])
def test_bad_items_are_refused(item):
    with pytest.raises(layout.LayoutError):
        layout.clean_layout({"items": [item]})


def test_too_many_items_are_refused():
    with pytest.raises(layout.LayoutError):
        layout.clean_layout({"items": [{"heading": str(i)} for i in range(layout.MAX_ITEMS + 1)]})


def test_unknown_size_falls_back_and_files_are_listed():
    got = layout.clean_layout({"items": [
        {"entity": "light.a", "size": "9x9", "image": "abcdef0123456789abcdef01.jpg"},
        {"entity": "light.b", "icon_image": "0123456789abcdef01234567.png"},
    ]})
    assert got["items"][0]["size"] == "1x1"
    assert layout.files_in(got) == {"abcdef0123456789abcdef01.jpg", "0123456789abcdef01234567.png"}


def test_icons_from_other_sets_keep_their_mask():
    got = layout.clean_layout({"items": [
        {"entity": "sensor.feuchte", "icon": "m3of:humidity-high", "icon_mask": "0123456789abcdef01234567.png"},
    ]})
    assert got["items"][0]["icon"] == "m3of:humidity-high"
    assert layout.files_in(got) == {"0123456789abcdef01234567.png"}
