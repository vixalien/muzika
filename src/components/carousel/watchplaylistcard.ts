import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { WatchPlaylist } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";

export class WatchPlaylistCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "WatchPlaylistCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/watchplaylistcard.ui",
      InternalChildren: [
        "title",
        "subtitle",
        "dynamic_image",
      ],
    }, this);
  }

  playlist?: WatchPlaylist;

  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _dynamic_image!: DynamicImage;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_watch_playlist(playlist: WatchPlaylist) {
    this.playlist = playlist;

    this._title.tooltip_text = this._title.label = playlist.title;
    this._subtitle.tooltip_text = this._subtitle.label = "Start Radio";

    load_thumbnails(this._dynamic_image.image, playlist.thumbnails, 160);

    this._dynamic_image.setup_playlist(playlist.playlistId);
  }
}
