import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { ParsedPlaylist } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class PlaylistCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/playlistcard.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "description_label",
      ],
    }, this);
  }

  playlist?: ParsedPlaylist;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _description_label!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_playlist(playlist: ParsedPlaylist) {
    this.playlist = playlist;

    this._title.set_label(playlist.title);
    this._description_label.set_label(playlist.description ?? "");

    load_thumbnails(this._image, playlist.thumbnails, 160);
  }
}
