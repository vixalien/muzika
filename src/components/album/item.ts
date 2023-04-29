import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { AlbumResultTrack } from "../../muse.js";

export class AlbumItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "AlbumItem",
      Template: "resource:///com/vixalien/muzika/components/album/item.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "number",
      ],
    }, this);
  }

  item?: AlbumResultTrack;

  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _number!: Gtk.Label;

  constructor() {
    super({});
  }

  set_item(number: number, item: AlbumResultTrack) {
    this.item = item;

    this._number.label = number.toString();

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      this._subtitle.set_label(item.artists[0].name);
    } else {
      this._subtitle.set_label("");
    }

    this._explicit.set_visible(item.isExplicit);
  }
}
