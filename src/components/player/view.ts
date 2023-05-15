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
      GTypeName: "PlayerView",
      Template: "resource:///com/vixalien/muzika/components/player/view.ui",
      InternalChildren: [
        "image",
        "title",
        "subtitle",
        "shuffle_button",
        "prev_button",
        "play_button",
        "play_image",
        "next_button",
        "repeat_button",
        "progress_label",
        "progress_scale",
        "progress_adjustment",
        "duration_label",
        "volume_button",
        "queue_button",
        "lyrics_button",
      ],
    }, this);
  }

  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _shuffle_button!: Gtk.ToggleButton;
  _prev_button!: Gtk.Button;
  _play_button!: Gtk.Button;
  _play_image!: Gtk.Image;
  _next_button!: Gtk.Button;
  _repeat_button!: Gtk.ToggleButton;
  _progress_label!: Gtk.Label;
  _progress_scale!: Gtk.ScaleButton;
  _progress_adjustment!: Gtk.Adjustment;
  _duration_label!: Gtk.Label;
  _volume_button!: Gtk.ToggleButton;
  _queue_button!: Gtk.ToggleButton;
  _lyrics_button!: Gtk.ToggleButton;

  player: Player;

  constructor(options: PlayerViewOptions) {
    super();

    this.player = options.player;
    this.setup_player();
  }

  setup_player() {
    // hide the player if the queue is empty
    this.player.queue.list.connect("notify::n-items", () => {
      this.revealed = this.player.queue.list.n_items > 0;
    });

    // update the player when the current song changes
    this.player.connect("notify::current", () => {
      const song = this.player.current?.item;
      if (song == null) return;

      this.show_song(song!);
    });

    this.player.connect("notify::playing", () => {
      this.update_play_button();
    });

    // buttons

    this._play_button.connect("clicked", () => {
      this.player.play_pause();
    });

    this._prev_button.connect("clicked", () => {
      this.player.previous();
    });

    this._next_button.connect("clicked", () => {
      this.player.next();
    });
  }

  update_play_button() {
    if (this.player.playing) {
      this._play_image.icon_name = "media-playback-pause-symbolic";
    } else {
      this._play_image.icon_name = "media-playback-start-symbolic";
    }
  }

  show_song({ track, options }: TrackMetadata) {
    this._title.label = track.title;
    this._subtitle.label = track.artists[0].name;

    this._duration_label.label = track.duration?.toString() ?? "";

    this._lyrics_button.set_sensitive(options.lyrics != null);

    this._prev_button.set_sensitive(this.player.queue.can_play_previous);
    this._next_button.set_sensitive(this.player.queue.can_play_next);

    load_thumbnails(this._image, track.thumbnails, 74);
  }
}
