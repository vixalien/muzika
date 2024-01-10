import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { LikeStatus } from "libmuse";

function getNewLikeStatus(status: LikeStatus): [string, LikeStatus] {
  switch (status) {
    case "DISLIKE":
      return [_("Remove from disliked songs"), "INDIFFERENT"];
    case "LIKE":
      return [_("Remove from liked songs"), "INDIFFERENT"];
    case "INDIFFERENT":
      return [_("Add to liked songs"), "LIKE"];
  }
}

export type LikeRowCallback = (status: LikeStatus) => void;

export function menuLikeRow(
  status: LikeStatus | null,
  videoId: string,
  cb?: LikeRowCallback,
) {
  if (!status) return null;

  const [message, newStatus] = getNewLikeStatus(status);

  const menu = new Gio.MenuItem();
  menu.set_label(message);
  menu.set_attribute_value("custom", GLib.Variant.new_string("rate-button"));

  (menu as any)["__child"] = (popover: Gtk.Popover) => {
    const button = new Gtk.Button({
      css_classes: ["flat"],
      css_name: "modelbutton",
      child: new Gtk.Label({
        label: message,
        xalign: 0,
      }),
    });

    button.connect("clicked", () => {
      cb?.(newStatus);
      button.activate_action(
        "win.rate-song",
        GLib.Variant.new_array(GLib.VariantType.new("s"), [
          GLib.Variant.new_string(videoId),
          GLib.Variant.new_string(newStatus),
        ]),
      );
      popover.popdown();
    });

    return button;
  };

  return menu;
}
