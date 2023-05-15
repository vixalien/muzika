import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gst from "gi://Gst";

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
      this.update_progress();
    });

    this.player.connect("notify::seeking-enabled", () => {
      this.update_seeking();
    });

    this.player.connect("notify::position", () => {
      this.update_progress();
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

    this._progress_scale.connect("change-value", () => {
      if (this.player.seeking_enabled) {
        this.player.playbin.seek_simple(
          Gst.Format.TIME,
          Gst.SeekFlags.FLUSH | Gst.SeekFlags.SKIP,
          this._progress_adjustment.value,
        );
      }
    });
  }

  update_play_button() {
    if (this.player.playing) {
      this._play_image.icon_name = "media-playback-pause-symbolic";
    } else {
      this._play_image.icon_name = "media-playback-start-symbolic";
    }
  }

  update_seeking() {
    this._progress_scale.set_sensitive(this.player.seeking_enabled);

    if (this.player.seeking_enabled) {
      this._progress_adjustment.set_lower(this.player.seeking_low);
      this._progress_adjustment.set_upper(this.player.seeking_high);
    }
  }

  update_progress_cb() {
    const position = this.player.get_position();
    if (position != null) {
      this._progress_adjustment.value = position;
      this._progress_label.label = nano_to_string(position);
    }
  }

  update_progress_timeout: number | null = null;

  update_progress() {
    if (this.player.playing) {
      if (!this.update_progress_timeout) {
        this.update_progress_timeout = GLib.timeout_add(
          GLib.PRIORITY_DEFAULT,
          100,
          () => {
            this.update_progress_cb();
            return GLib.SOURCE_CONTINUE;
          },
        );
      }
    } else {
      if (this.update_progress_timeout != null) {
        GLib.source_remove(this.update_progress_timeout);
        this.update_progress_timeout = null;
      }
    }
  }

  show_song({ track, options }: TrackMetadata) {
    // thumbnail

    load_thumbnails(this._image, track.thumbnails, 74);

    // labels

    this._title.label = track.title;
    this._subtitle.label = track.artists[0].name;

    this._duration_label.label = track.duration?.toString() ?? "";

    // toggle buttons

    this._lyrics_button.set_sensitive(options.lyrics != null);

    // buttons

    this._prev_button.set_sensitive(this.player.queue.can_play_previous);
    this._next_button.set_sensitive(this.player.queue.can_play_next);

    // progress

    this._progress_adjustment.value = 0;
  }
}

function seconds_to_string(seconds: number) {
  // show the duration in the format "mm:ss"
  // show hours if the duration is longer than an hour

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  seconds = Math.floor(seconds % 60);

  let string = "";

  if (hours > 0) {
    string += hours.toString().padStart(2, "0") + ":";
  }

  string += minutes.toString().padStart(2, "0") + ":";

  string += seconds.toString().padStart(2, "0");

  return string;
}

function nano_to_seconds(nano: number) {
  return nano / Gst.SECOND;
}

function nano_to_string(nano: number) {
  return seconds_to_string(nano_to_seconds(nano));
}
