import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { match, MatchFunction } from "path-to-regexp";

import { Window } from "../window";
import { NavbarButton } from "./button";
import { NavbarSection } from "./section";

// make sure to first register dependencies
import "./button";
import "./title";
import "./section";

export class NavbarView extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarView",
        Template: "resource:///com/vixalien/muzika/components/navbar/index.ui",
        InternalChildren: [
          "section",
        ],
      },
      this,
    );
  }

  window: Window;
  last_button: NavbarButton;

  private _section!: NavbarSection;

  button_map = new Map<MatchFunction, NavbarButton>();

  constructor(window: Window) {
    super();

    this.window = window;

    this.last_button = (this._section.items.get_first_child() as Gtk.ListBoxRow)
      .child as NavbarButton;

    this._section.items.select_row(
      this._section.items.get_first_child()! as Gtk.ListBoxRow,
    );

    this._section.items.connect("row-activated", (_, row) => {
      const child = row.child as NavbarButton;

      if (!(child instanceof NavbarButton)) return;

      if (!child.link) return;

      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string(`muzika:${child.link}`),
      );
    });

    this.window.navigator.connect("notify::current-uri", () => {
      const path = this.window.navigator.current_uri;

      if (path) this.navigated(path);
    });

    this.setup_buttons();
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

    for (const [fn, button] of this.button_map) {
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
      if (row.child === button) {
        this._section.items.select_row(row);
        return;
      }

      row = row.get_next_sibling() as Gtk.ListBoxRow;
    }
  }
}
