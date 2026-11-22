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
    assert got == {"version": 1, "tabs": [], "light": [], "scenes": [], "look": {"theme": "", "columns": 0},
                   "radio": {"favorites": [], "country": "", "genres": None, "start": "", "sort": "popular", "hide": []}}


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


def test_radio_keeps_favorites_genres_and_choices():
    got = menu.clean_menu({"radio": {
        "favorites": [{"name": " 1LIVE ", "url": "https://wdr/1live", "logo": "https://wdr/logo.png", "extra": 1},
                      {"name": "1 Live", "url": "https://other"}, {"name": "SWR3", "url": "http://swr3", "logo": "data:x"}],
        "country": "de", "genres": [{"tag": "Schlager"}, {"tag": "news", "name": "Infos"}, {"tag": "schlager"}],
        "start": "fav", "sort": "az", "hide": ["search", "near"]}})["radio"]
    assert got["favorites"] == [{"name": "1LIVE", "url": "https://wdr/1live", "logo": "https://wdr/logo.png"},
                                {"name": "SWR3", "url": "http://swr3"}]
    assert got["country"] == "DE"
    assert got["genres"] == [{"tag": "schlager"}, {"tag": "news", "name": "Infos"}]
    assert (got["start"], got["sort"], got["hide"]) == ("fav", "az", ["near", "search"])


@pytest.mark.parametrize("radio", [
    {"favorites": [{"name": "x", "url": "ftp://x"}]},
    {"favorites": [{"name": "", "url": "https://x"}]},
    {"country": "DEU"},
    {"genres": [{"tag": "<b>"}]},
    {"start": "tv"},
    {"sort": "random"},
    {"hide": ["fav"]},
    {"favorites": [{"name": f"S{i}", "url": f"https://s/{i}"} for i in range(61)]},
])
def test_radio_rejects(radio):
    with pytest.raises(menu.MenuError):
        menu.clean_menu({"radio": radio})


def test_radio_favorite_adds_once_and_removes():
    m = menu.clean_menu({"radio": {"favorites": [{"name": "SWR3", "url": "https://swr3"}]}})
    m = menu.radio_favorite(m, {"name": "WDR 2", "url": "https://wdr2"}, True)
    m = menu.radio_favorite(m, {"name": "wdr 2", "url": "https://elsewhere"}, True)
    assert [f["name"] for f in m["radio"]["favorites"]] == ["SWR3", "wdr 2"]
    m = menu.radio_favorite(m, {"name": "SWR 3", "url": "https://swr3"}, False)
    assert [f["name"] for f in m["radio"]["favorites"]] == ["wdr 2"]
    with pytest.raises(menu.MenuError):
        menu.radio_favorite(m, {"name": "x", "url": "nope"}, True)


def test_deck_is_kept_and_cleaned():
    got = menu.clean_menu({"deck": {"cols": 12, "rows": 0, "pages": [
        {"name": " Wohnzimmer ", "buttons": [
            {"action": "ha_toggle", "entity": "light.eck", "icon": "mdi:lamp", "color": "#FB8C00", "label": "Eck"},
            {},
            {"action": "page", "page": 2},
            {"action": "pc_keys", "computer": "PC", "value": "ctrl+shift+m"},
            {"action": "rm -rf"},
            {"action": "ha_run", "entity": "nicht gültig"},
            {},
        ]}]}})
    deck = got["deck"]
    assert deck["cols"] == 8 and deck["rows"] == 1
    page = deck["pages"][0]
    assert page["name"] == "Wohnzimmer"
    assert page["buttons"][0] == {"action": "ha_toggle", "entity": "light.eck", "icon": "lamp", "color": "#fb8c00", "label": "Eck"}
    assert page["buttons"][1] == {}
    assert page["buttons"][2] == {"action": "page", "page": 2}
    assert page["buttons"][4] == {}  # unbekannte Aktion
    assert page["buttons"][5] == {"action": "ha_run"}  # ohne gültige Entität
    assert len(page["buttons"]) == 6  # leere Felder am Ende fallen weg


def test_no_deck_stays_absent():
    assert "deck" not in menu.clean_menu({})
    assert "deck" not in menu.clean_menu({"deck": None})


def test_deck_info_keeps_only_names():
    info = menu.clean_deck_info({"computers": ["PC", 3, ""], "obs_scenes": ["Szene"], "key": "geheim", "obs_connected": True})
    assert info == {"computers": ["PC"], "obs_scenes": ["Szene"], "obs_inputs": [], "obs_connected": True,
                    "apps": {}, "scripts": {}, "macs": {}}
    info = menu.clean_deck_info({"apps": {"PC": ["Firefox ESR", 5, ""], "": ["x"]}, "scripts": {"PC": "kein"}})
    assert info["apps"] == {"PC": ["Firefox ESR"]} and info["scripts"] == {}
