"""Die Prüfung des Menüs (custom_components/echo_studio/menu.py), ohne Home Assistant."""

import importlib.util
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1] / "custom_components" / "echo_studio"
_spec = importlib.util.spec_from_file_location("echo_studio_menu", ROOT / "menu.py")
menu = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(menu)


def test_empty_is_the_default():
    got = menu.clean_menu({})
    assert got == {"version": 1, "tabs": [], "light": [], "scenes": [], "look": {"theme": "", "columns": 0}}


def test_keeps_tabs_items_and_look():
    got = menu.clean_menu({
        "tabs": [{"id": "light", "name": " Lampen ", "show": True}, {"id": "football", "show": False}, {"id": "light"}],
        "light": [{"heading": "Wohnzimmer"}, {"entity": "light.eck_led", "name": "Eck-LED", "icon": "mdi:led-strip",
                   "color_on": "#f4a93c", "size": "2x2"}, {"entity": "light.eck_led"}],
        "scenes": [{"entity": "scene.abend"}, {"entity": "script.gute_nacht"}],
        "look": {"theme": "graphite", "columns": 4},
        "extra": 1,
    })
    assert got["tabs"] == [{"id": "light", "name": "Lampen"}, {"id": "football", "show": False}]
    assert got["light"] == [{"heading": "Wohnzimmer"},
                            {"entity": "light.eck_led", "name": "Eck-LED", "icon": "mdi:led-strip", "color_on": "#F4A93C"}]
    assert [i["entity"] for i in got["scenes"]] == ["scene.abend", "script.gute_nacht"]
    assert got["look"] == {"theme": "graphite", "columns": 4}


def test_one_tab_always_stays():
    got = menu.clean_menu({"tabs": [{"id": "light", "show": False}, {"id": "music", "show": False}]})
    assert "show" not in got["tabs"][0]


@pytest.mark.parametrize("bad", [
    {"tabs": [{"id": "kitchen"}]},
    {"light": [{"entity": "scene.abend"}]},
    {"scenes": [{"entity": "light.eck_led"}]},
    {"light": [{"entity": "light.x", "icon": "m3of:bulb"}]},
    {"light": [{"entity": "light.x", "color_on": "red"}]},
    {"look": {"theme": "pink"}},
    {"look": {"columns": 9}},
    {"look": {"columns": True}},
    "nonsense",
])
def test_refuses_what_the_show_cannot_draw(bad):
    with pytest.raises(menu.MenuError):
        menu.clean_menu(bad)
