import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { get_player } from "src/application";
import { PlayerScale } from "../scale";

export class MiniVideoPlayer extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "MiniVideoPlayer",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/video/mini.ui",
      InternalChildren: [
        "play_button",
        "progress_label",
        "duration_label",
        "scale",
      ],
    }, this);
  }

  private _play_button!: Gtk.Button;
  private _progress_label!: Gtk.Label;
  private _duration_label!: Gtk.Label;
  private _scale!: PlayerScale;

  constructor() {
    super();

    this.setup_player();
  }

  song_changed() {
    this._scale.value = 0;
    this._progress_label.label = seconds_to_string(0);

    const track = get_player().queue.current?.object;

    if (track) {
      this._duration_label.label = track.duration_seconds
        ? seconds_to_string(track.duration_seconds)
        : track.duration ?? "00:00";
      {}
    }
  }

  private setup_player() {
    const player = get_player();

    this.song_changed();

    // update the player when the current song changes
    player.queue.connect(
      "notify::current",
      this.song_changed.bind(this),
    );

    player.connect("notify::is-buffering", () => {
      this.update_play_button();
    });

    player.connect("notify::playing", () => {
      this.update_play_button();
    });

    player.connect("notify::duration", () => {
      this._scale.set_duration(player.duration);
      this._duration_label.label = micro_to_string(player.duration);
    });

    this._scale.connect("user-changed-value", (_, value) => {
      this.activate_action(
        "player.seek",
        GLib.Variant.new_double(this._scale.value),
      );
    });

    // buttons

    // this.setup_volume_button();

    player.connect("notify::timestamp", () => {
      this._scale.update_position(player.timestamp);
      this._progress_label.label = micro_to_string(player.timestamp);
    });
  }

  private update_play_button() {
    const player = get_player();

    this._scale.buffering = player.is_buffering && player.playing;

    if (player.playing) {
      this._play_button.icon_name = "media-playback-pause-symbolic";
    } else {
      this._play_button.icon_name = "media-playback-start-symbolic";
    }
  }

  private skip_backwards() {
    const player = get_player();

    player.seek(Math.max(player.timestamp - 10000000, 0));
  }

  private skip_forward() {
    const player = get_player();

    const new_timestamp = player.timestamp + 10000000;

    if (new_timestamp < player.duration) {
      player.seek(new_timestamp);
    } else {
      player.queue.next();
    }
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

function micro_to_seconds(micro: number) {
  return micro / 1000000;
}

function micro_to_string(micro: number) {
  return seconds_to_string(micro_to_seconds(micro));
}
