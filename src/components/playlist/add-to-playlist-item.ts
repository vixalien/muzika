import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { AddToPlaylistItem } from "libmuse";

import { load_thumbnails } from "../webimage.js";

export class AddToPlaylistItemCard extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "AddToPlaylistItemCard",
        Template:
          "resource:///com/vixalien/muzika/ui/components/playlist/add-to-playlist-item.ui",
        InternalChildren: ["title", "subtitle", "image"],
      },
      this,
    );
  }

  item?: AddToPlaylistItem;

  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _image!: Gtk.Image;

  show_item(item: AddToPlaylistItem) {
    this.item = item;

    this._title.label = item.title;
    this._subtitle.label = item.songs;

    load_thumbnails(this._image, item.thumbnails, this._image.pixel_size);
  }
}
