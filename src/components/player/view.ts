import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Song } from "../../muse.js";
import { Player, TrackMetadata } from "../../player/index.js";
import { load_thumbnails } from "../webimage.js";

export interface PlayerViewOptions {
  player: Player;
}

export class PlayerView extends Gtk.ActionBar {
  static {
    GObject.registerClass({
      Template: "resource:///com/vixalien/muzika/components/player/view.ui",
      InternalChildren: [
        "image",
        "title",
        "subtitle",
        "shuffle_button",
        "previous_button",
        "play_button",
        "next_button",
        "repeat_button",
        "progress_label",
        "progress_scale",
        "progress_adjustment",
        "duration_label",
        "volume_button",
        "queue_button",
        "lyrics_buttons",
      ],
    }, this);
  }

  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _shuffle_button!: Gtk.ToggleButton;
  _previous_button!: Gtk.Button;
  _play_button!: Gtk.Button;
  _next_button!: Gtk.Button;
  _repeat_button!: Gtk.ToggleButton;
  _progress_label!: Gtk.Label;
  _progress_scale!: Gtk.ScaleButton;
  _progress_adjustment!: Gtk.Adjustment;
  _duration_label!: Gtk.Label;
  _volume_button!: Gtk.ToggleButton;
  _queue_button!: Gtk.ToggleButton;
  _lyrics_buttons!: Gtk.ToggleButton;

  player: Player;

  constructor(options: PlayerViewOptions) {
    super();

    this.player = options.player;
    this.setup_player();
  }

  setup_player() {
  }

  show_song(meta: TrackMetadata) {
    this._title.label = meta.track.title;
    this._subtitle.label = meta.track.artists[0].name;

    this._lyrics_buttons.set_sensitive(false);

    load_thumbnails(this._image, meta.track.thumbnails, 74);
  }
}
