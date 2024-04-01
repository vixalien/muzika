import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { LikeStatus } from "libmuse";

export type LikeRowCallback = (status: LikeStatus) => void;

export function menuLikeRow(
  status: LikeStatus | null,
  videoId: string,
  cb?: LikeRowCallback,
) {
  if (!status) return null;
  const menu = new Gio.MenuItem();
  menu.set_label(_("Change rating of track"));
  menu.set_attribute_value("custom", GLib.Variant.new_string("rate-button"));

  (menu as any)["__child"] = (popover: Gtk.Popover) => {
    const change_rating = (newStatus: LikeStatus) => {
      cb?.(newStatus);
      popover.activate_action(
        "win.rate-song",
        GLib.Variant.new_array(GLib.VariantType.new("s"), [
          GLib.Variant.new_string(videoId),
          GLib.Variant.new_string(newStatus),
          GLib.Variant.new_string(status),
        ]),
      );
      popover.popdown();
    };

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 3,
      margin_bottom: 3,
    });

    const liked = status === "LIKE";
    const like_button = new Gtk.ToggleButton({
      icon_name: "thumbs-up-symbolic",
      css_classes: ["flat"],
      hexpand: true,
      active: liked,
      tooltip_text: liked
        ? _("Remove from liked songs")
        : _("Add to liked songs"),
    });

    like_button.connect("toggled", () => {
      change_rating(liked ? "INDIFFERENT" : "LIKE");
    });

    const disliked = status === "DISLIKE";
    const dislike_button = new Gtk.ToggleButton({
      icon_name: "thumbs-down-symbolic",
      css_classes: ["flat"],
      hexpand: true,
      active: disliked,
      tooltip_text: disliked
        ? _("Remove from liked songs")
        : _("Add to disliked songs"),
    });

    dislike_button.connect("toggled", () => {
      change_rating(disliked ? "INDIFFERENT" : "DISLIKE");
    });

    box.append(like_button);
    box.append(dislike_button);

    return box;
  };

  return menu;
}
