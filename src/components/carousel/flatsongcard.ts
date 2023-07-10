import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { FlatSong } from "../../muse.js";
import { DynamicImage, DynamicImageState } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";
import { pretty_subtitles } from "src/util/text.js";

export class FlatSongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "FlatSongCard",
      Template:
        "resource:///com/vixalien/muzika/ui/components/carousel/flatsong.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "dynamic_image",
      ],
    }, this);
  }

  song?: FlatSong;

  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;
  private _dynamic_image!: DynamicImage;

  constructor() {
    super();

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

  set_song(song: FlatSong) {
    this.song = song;

    this._title.tooltip_text = this._title.label = song.title;

    const subtitles = pretty_subtitles(song.artists ?? []);

    this._subtitle.label = subtitles.markup;
    this._subtitle.tooltip_text = subtitles.plain;

    this._explicit.set_visible(song.isExplicit);

    this._dynamic_image.load_thumbnails(song.thumbnails);

    if (song.videoId) {
      this._dynamic_image.setup_video(song.videoId);
    }
  }

  set_state(state: DynamicImageState) {
    this._dynamic_image.state = state;
  }
}
