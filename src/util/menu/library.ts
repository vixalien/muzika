import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { ParsedSong } from "libmuse";
import { MenuProp } from ".";

type MenuTokens = ParsedSong["feedbackTokens"];

export type LibraryRowCallback = (status: NonNullable<MenuTokens>) => void;

export function menuLibraryRow(
  tokens: MenuTokens,
  cb?: LibraryRowCallback,
): MenuProp {
  if (!tokens) return null;

  let label: string,
    action: string,
    getNewTokens: (tokens: NonNullable<MenuTokens>) => NonNullable<MenuTokens>;

  if (tokens.saved) {
    if (!tokens.remove) return null;

    label = "Remove from library";
    action = get_action_string("remove", tokens.remove);
    getNewTokens = (tokens) => {
      return { ...tokens, saved: false };
    };
  } else {
    if (!tokens.add) return null;

    label = "Add to library";
    action = get_action_string("add", tokens.add);
    getNewTokens = (tokens) => {
      return { ...tokens, saved: true };
    };
  }

  const menu = new Gio.MenuItem();
  menu.set_label(label);
  menu.set_attribute_value("custom", GLib.Variant.new_string("library-button"));

  (menu as any)["__child"] = (popover: Gtk.Popover) => {
    const label_widget = new Gtk.Label({
      label,
      halign: Gtk.Align.START,
    });

    const button = new Gtk.Button({
      css_name: "modelbutton",
      child: label_widget,
    });
    button.set_detailed_action_name(action);

    button.connect("clicked", () => {
      popover.popdown();
      cb?.(getNewTokens(tokens));
    });

    return button;
  };

  return menu;
}

function get_action_string(action: "add" | "remove", token: string) {
  return `win.edit-library(\("${action}", "${token}"\))`;
}
