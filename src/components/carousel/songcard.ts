import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ParsedSong } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class SongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SongCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/songcard.ui",
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

  song?: ParsedSong;

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

  set_song(song: ParsedSong) {
    this.song = song;

    if (song.videoId) {
      this._play_button.action_name = "queue.play-song";
      this._play_button.action_target = GLib.Variant.new_string(
        song.videoId,
      );
    } else {
      this._play_button.hide();
    }

    this._title.set_label(song.title);
    this._subtitle.set_label(song.artists[0].name);
    this._explicit.set_visible(song.isExplicit);

    load_thumbnails(this._image, song.thumbnails, 160);
  }
}
