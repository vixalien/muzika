import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { LikeStatus, rate_song } from "libmuse";
import { MenuItemWithChild } from ".";

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

  (menu as MenuItemWithChild)["__child"] = (popover: Gtk.Popover) => {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 3,
      margin_bottom: 3,
    });

    const { like_button, dislike_button } = create_like_buttons({
      status,
      parent: popover,
      cb: (newStatus) => {
        popover.popdown();
        cb?.(newStatus);
      },
      videoId,
    });

    box.append(like_button);
    box.append(dislike_button);

    return box;
  };

  return menu;
}

export interface CreateLikeButtonsProps {
  videoId: string;
  status: LikeStatus;
  parent: Gtk.Widget;
  cb?: LikeRowCallback;
}

export function create_like_buttons({
  status,
  parent,
  videoId,
  cb,
}: CreateLikeButtonsProps) {
  const change_rating = (newStatus: LikeStatus) => {
    cb?.(newStatus);
    parent.activate_action(
      "win.rate-song",
      GLib.Variant.new("(sss)", [videoId, newStatus, status ?? ""]),
    );
  };

  const props = get_button_props(status);

  const like_button = new Gtk.ToggleButton({
    icon_name: "thumbs-up-symbolic",
    css_classes: ["flat"],
    hexpand: true,
    ...props.like,
  });

  like_button.connect("toggled", () => {
    change_rating(props.like.active ? "INDIFFERENT" : "LIKE");
  });

  const dislike_button = new Gtk.ToggleButton({
    icon_name: "thumbs-down-symbolic",
    css_classes: ["flat"],
    hexpand: true,
    ...props.dislike,
  });

  dislike_button.connect("toggled", () => {
    change_rating(props.dislike.active ? "INDIFFERENT" : "DISLIKE");
  });

  return { like_button, dislike_button };
}

export function get_button_props(likeStatus: LikeStatus) {
  const liked = likeStatus === "LIKE";
  const disliked = likeStatus === "DISLIKE";

  return {
    like: {
      active: liked,
      tooltip_text: liked
        ? _("Remove from liked songs")
        : _("Add to liked songs"),
    },
    dislike: {
      active: disliked,
      tooltip_text: disliked
        ? _("Remove from liked songs")
        : _("Add to disliked songs"),
    },
  };
}

export async function change_song_rating(
  videoId: string,
  status: LikeStatus,
  oldStatus?: LikeStatus,
) {
  await rate_song(videoId, status as LikeStatus);

  const toast = new Adw.Toast();
  switch (status as LikeStatus) {
    case "DISLIKE":
      toast.title = _("Added to disliked songs");
      break;
    case "LIKE":
      toast.title = _("Added to liked songs");
      toast.button_label = _("Liked songs");
      toast.action_name = "navigator.visit";
      toast.action_target = GLib.Variant.new_string("muzika:playlist:LM");
      break;
    case "INDIFFERENT":
      if (oldStatus === "LIKE") {
        toast.title = _("Removed from liked songs");
      } else {
        toast.title = _("Removed from disliked songs");
      }
      break;
  }
  return toast;
}
