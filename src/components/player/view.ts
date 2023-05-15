import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gst from "gi://Gst";

import { Player, TrackMetadata } from "../../player/index.js";
import { RepeatMode } from "../../player/queue.js";
import { load_thumbnails } from "../webimage.js";
import { Settings } from "src/application.js";

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
  _volume_button!: Gtk.VolumeButton;
  _queue_button!: Gtk.ToggleButton;
  _lyrics_button!: Gtk.ToggleButton;

  player: Player;

  constructor(options: PlayerViewOptions) {
    super();

    this.player = options.player;
    this.setup_player();
  }

  setup_player() {
    const cb = () => {
      const song = this.player.current?.item;
      if (song == null) {
        this.revealed = false;
      } else {
        this.revealed = true;
        this.show_song(song!);
      }
    };

    cb();

    // update the player when the current song changes
    this.player.connect("notify::current", cb);

    this.player.connect("notify::playing", () => {
      this.update_play_button();
      this.update_progress();
    });

    this.player.connect("notify::seeking-enabled", () => {
      this.update_seeking();
    });

    this.player.connect("notify::position", () => {
      this.update_progress_cb();
    });

    this._progress_scale.connect("change-value", () => {
      if (this.player.seeking_enabled) {
        this.activate_action(
          "player.seek",
          GLib.Variant.new_double(this._progress_adjustment.value),
        );
      }
    });

    // buttons

    this.update_repeat_button();

    this.player.queue.connect("notify::repeat", () => {
      this.update_repeat_button();
    });

    this.player.queue.connect("notify::shuffle", () => {
      this._shuffle_button.set_active(this.player.queue.shuffle);
    });

    this.setup_volume_button();
  }

  setup_volume_button() {
    this._volume_button.adjustment = Gtk.Adjustment.new(
      Settings.get_double("volume"),
      0,
      1,
      0.01,
      0.1,
      0,
    );

    this._volume_button.connect("value-changed", () => {
      Settings.set_double("volume", this._volume_button.adjustment.value);
    });

    this._volume_button.connect(
      "query-tooltip",
      (
        _widget: Gtk.VolumeButton,
        _x: number,
        _y: number,
        _keyboard_mode: boolean,
        tooltip: Gtk.Tooltip,
      ) => {
        tooltip.set_text(
          `${Math.round(this._volume_button.adjustment.value * 100)}%`,
        );
        return true;
      },
    );
  }

  update_repeat_button() {
    const repeat_mode = this.player.queue.repeat;

    this._repeat_button.set_active(
      repeat_mode === RepeatMode.ALL || repeat_mode === RepeatMode.ONE,
    );

    switch (repeat_mode) {
      case RepeatMode.ALL:
        this._repeat_button.icon_name = "media-playlist-repeat-symbolic";
        this._repeat_button.tooltip_text = "Repeat All Songs";
        break;
      case RepeatMode.ONE:
        this._repeat_button.icon_name = "media-playlist-repeat-song-symbolic";
        this._repeat_button.tooltip_text = "Repeat the Current Song";
        break;
      case RepeatMode.NONE:
        this._repeat_button.icon_name = "media-playlist-consecutive-symbolic";
        this._repeat_button.tooltip_text = "Enable Repeat";
        break;
    }
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
    if (this.player.playing && !this.player.buffering) {
      if (!this.update_progress_timeout) {
        setTimeout(() => {
          this.update_progress_timeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            100,
            () => {
              this.update_progress_cb();
              return GLib.SOURCE_CONTINUE;
            },
          );
        }, 1000);
      }
    } else {
      if (this.update_progress_timeout != null) {
        GLib.source_remove(this.update_progress_timeout);
        this.update_progress_timeout = null;
      }
    }
  }

  show_song({ track, options }: TrackMetadata) {
    this.update_progress_cb();

    // thumbnail

    load_thumbnails(this._image, track.thumbnails, 74);

    // labels

    this._title.label = track.title;
    this._subtitle.label = track.artists[0].name;

    this._duration_label.label = track.duration?.toString() ?? "";

    // toggle buttons

    this._lyrics_button.set_sensitive(options.lyrics != null);

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
