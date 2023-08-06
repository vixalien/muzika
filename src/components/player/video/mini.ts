import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { get_player } from "src/application";
import { PlayerScale } from "../scale";
import { SignalListeners } from "src/util/signal-listener";
import { micro_to_string, seconds_to_string } from "src/util/time";

export class MiniVideoControls extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "MiniVideoControls",
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

  song_changed() {
    this._scale.value = 0;
    this._progress_label.label = seconds_to_string(0);

    const player = get_player();
    const track = player.queue.current?.object;

    if (track) {
      this._scale.update_position(player.timestamp);
      this._progress_label.label = micro_to_string(player.timestamp);

      this._duration_label.label = track.duration_seconds
        ? seconds_to_string(track.duration_seconds)
        : track.duration ?? "00:00";
      {}
    }
  }

  private listeners = new SignalListeners();

  private setup_player() {
    const player = get_player();

    this.song_changed();

    // update the player when the current song changes
    this.listeners.connect(
      player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.update_play_button();

    this.listeners.connect(player, "notify::is-buffering", () => {
      this.update_play_button();
    });

    this.listeners.connect(
      player,
      "notify::playing",
      () => {
        this.update_play_button();
      },
    );

    this._scale.set_duration(player.duration);
    this._duration_label.label = micro_to_string(player.duration);

    this.listeners.connect(
      player,
      "notify::duration",
      () => {
        this._scale.set_duration(player.duration);
        this._duration_label.label = micro_to_string(player.duration);
      },
    );

    this.listeners.connect(
      this._scale,
      "user-changed-value",
      ((_: any, value: number) => {
        this.activate_action(
          "player.seek",
          GLib.Variant.new_double(this._scale.value),
        );
      }) as any,
    );

    // buttons

    // this.setup_volume_button();

    this.listeners.connect(
      player,
      "notify::timestamp",
      () => {
        this._scale.update_position(player.timestamp);
        this._progress_label.label = micro_to_string(player.timestamp);
      },
    );
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

  clear_listeners() {
    this.listeners.clear();
  }

  vfunc_map(): void {
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.clear_listeners();
    super.vfunc_unmap();
  }
}
