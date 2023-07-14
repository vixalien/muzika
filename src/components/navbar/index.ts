import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { match, MatchFunction } from "path-to-regexp";

import { get_library_playlists, get_option } from "../../muse";
import { Window } from "../../window";
import { NavbarButton } from "./button";
import { NavbarSection } from "./section";

NavbarSection;

export class NavbarView extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/navbar/index.ui",
        InternalChildren: [
          "section",
          "search",
        ],
        Signals: {
          activated: {
            param_types: [GObject.TYPE_STRING],
          },
          searched: {},
        },
      },
      this,
    );
  }

  window: Window;
  last_button: NavbarButton;

  private _section!: NavbarSection;
  private _search!: Gtk.SearchEntry;

  button_map = new Map<MatchFunction, NavbarButton>();
  playlists = new Map<MatchFunction, NavbarButton>();

  constructor(window: Window, view: Adw.NavigationSplitView) {
    super();

    this.window = window;

    this.last_button = (this._section.items.get_first_child() as Gtk.ListBoxRow)
      .child as NavbarButton;

    this._section.items.select_row(
      this._section.items.get_first_child()! as Gtk.ListBoxRow,
    );

    this._section.items.connect("row-activated", (_, row) => {
      const child = row as NavbarButton;

      if (!(child instanceof NavbarButton)) return;

      if (!child.link) return;

      this.emit("activated", child.link);
    });

    this.window.navigator.connect("notify::current-uri", () => {
      const path = this.window.navigator.current_uri;

      if (path) this.navigated(path);
    });

    this.setup_buttons();

    this._search.connect("activate", () => {
      this.search();
    });

    this._search.connect("next-match", () => {
      this.search();
    });

    get_option("auth").addEventListener("token-changed", () => {
      this.update_buttons();
      this.update_playlists();
    });

    this.update_buttons();
    this.update_playlists();
  }

  update_buttons() {
    const logged_in = get_option("auth").has_token();

    for (const [_, button] of this.button_map) {
      if (button.requires_login) {
        button.visible = logged_in;
      }
    }
  }

  clear_playlists() {
    this.playlists.forEach((button) => {
      button.unparent();
    });

    this.playlists.clear();
  }

  update_playlists() {
    this.clear_playlists();

    if (get_option("auth").has_token()) {
      get_library_playlists()
        .then((playlists) => {
          this.clear_playlists();

          playlists.items.forEach((playlist) => {
            const url = new URL("muzika:playlist:" + playlist.playlistId);

            const path = url.pathname.replace(/(?<!\\):/g, "/");

            const button = new NavbarButton();
            button.icon_name = "view-grid-symbolic";
            button.label = playlist.title;
            button.link = "playlist:" + playlist.playlistId;

            this.playlists.set(
              match(path),
              button,
            );

            this._section.items.append(button);
          });
        }).catch((err) => {
          this.clear_playlists();

          throw err;
        });
    } else {
      this.clear_playlists();
    }
  }

  search() {
    const query = this._search.text;

    this.activate_action(
      "navigator.visit",
      GLib.Variant.new_string(`muzika:search:${encodeURIComponent(query)}`),
    );

    this.emit("searched");
  }

  setup_buttons() {
    let row = this._section.items.get_first_child() as Gtk.ListBoxRow;

    while (row) {
      const child = row.child as NavbarButton;

      if (child instanceof NavbarButton) {
        if (!child.link) return;

        const url = new URL("muzika:" + child.link);

        const path = url.pathname.replace(/(?<!\\):/g, "/");

        this.button_map.set(
          match(path),
          child,
        );
      }

      row = row.get_next_sibling() as Gtk.ListBoxRow;
    }
  }

  navigated(uri: string) {
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    for (const [fn, button] of [...this.button_map, ...this.playlists]) {
      const result = fn(path);

      if (result) {
        this.activate_button(button);
        this.last_button = button;
        return;
      }
    }

    this.activate_button(this.last_button);
  }

  activate_button(button: NavbarButton) {
    this._section.items.unselect_all();

    let row = this._section.items.get_first_child() as Gtk.ListBoxRow | null;

    while (row) {
      if (row === button) {
        this._section.items.select_row(row);
        return;
      }

      row = row.get_next_sibling() as Gtk.ListBoxRow;
    }
  }

  set_search(query: string) {
    if (this._search.text === query) return;

    this._search.text = query;

    // move cursor to end
    this._search.set_position(query.length);
  }
}
