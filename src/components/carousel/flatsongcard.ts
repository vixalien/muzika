import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { FlatSong } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class FlatSongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "FlatSongCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/flatsong.ui",
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

  song?: FlatSong;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_song(song: FlatSong) {
    this.song = song;

    this._title.set_label(song.title);

    if (song.artists && song.artists.length > 0) {
      this._subtitle.set_label(song.artists[0].name);
    } else {
      this._subtitle.set_label("");
    }

    this._explicit.set_visible(song.isExplicit);

    load_thumbnails(this._image, song.thumbnails, 48);
  }
}
