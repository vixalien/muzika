import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { QueueTrack } from "libmuse";

import { load_thumbnails } from "../webimage.js";
import { pretty_subtitles } from "src/util/text.js";
import { setup_link_label } from "src/util/label.js";

export class QueueItem extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "QueueItem",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/queueitem.ui",
        InternalChildren: ["image", "title", "explicit", "subtitle"],
      },
      this,
    );
  }

  item?: QueueTrack;

  private _image!: Gtk.Image;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;

  constructor() {
    super({});

    setup_link_label(this._subtitle);
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
