import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ArtistRun } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { pretty_subtitles } from "src/util/text.js";

export class QueueItem extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "QueueItem",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/queueitem.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "subtitle",
      ],
    }, this);
  }

  item?: QueueTrack;

  private _play_button!: Gtk.Button;
  private _image!: Gtk.Image;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;

  constructor() {
    super({});

    this._subtitle.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });
  }

  set_track(item: QueueTrack) {
    this.item = item;

    this._title.set_label(item.title);

    const subtitles = pretty_subtitles(item.artists);

    this._subtitle.set_markup(subtitles.markup);
    this._subtitle.tooltip_text = subtitles.plain;

    this._explicit.set_visible(item.isExplicit);

    load_thumbnails(this._image, item.thumbnails, 48);
  }
}
