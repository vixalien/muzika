import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { PlaylistItem } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class PlaylistItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItem",
      Template:
        "resource:///com/vixalien/muzika/components/playlist/playlistitem.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "subtitle",
        "image",
      ],
    }, this);
  }

  item?: PlaylistItem;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;

  constructor() {
    super({});
  }

  set_item(item: PlaylistItem) {
    this.item = item;

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      this._subtitle.set_label(item.artists[0].name);
    } else {
      this._subtitle.set_label("");
    }

    this._explicit.set_visible(item.isExplicit);

    load_thumbnails(this._image, item.thumbnails, 48);
  }
}
