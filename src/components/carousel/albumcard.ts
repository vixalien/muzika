import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { ParsedAlbum } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class AlbumCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "AlbumCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/albumcard.ui",
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "subtitle",
        "album_type",
        "separator",
        "image",
      ],
    }, this);
  }

  album?: ParsedAlbum;

  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _album_type!: Gtk.Label;
  _separator!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_album(album: ParsedAlbum) {
    this.album = album;

    this._title.tooltip_text = this._title.label = album.title;

    const subtitle = album.artists[0]?.name ?? album.year;

    if (subtitle) {
      this._subtitle.set_label(subtitle);
    } else {
      this._separator.set_visible(false);
    }

    this._explicit.set_visible(album.isExplicit);

    if (album.album_type) {
      this._album_type.set_label(album.album_type);
    } else {
      this._album_type.set_visible(false);
      this._separator.set_visible(false);
    }

    load_thumbnails(this._image, album.thumbnails, 160);
  }
}
