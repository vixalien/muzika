import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { PlayerScale } from "./scale.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { escape_label, pretty_subtitles } from "src/util/text.js";
import { MuzikaPlayer } from "src/player";
import { micro_to_string, seconds_to_string } from "src/util/time.js";
import { PlayerPreview } from "./preview.js";
import { SignalListeners } from "src/util/signal-listener.js";
import { get_player } from "src/application.js";
import { bind_play_icon, bind_repeat_button } from "src/player/helpers.js";

GObject.type_ensure(PlayerPreview.$gtype);

export class FullPlayerView extends Gtk.ActionBar {
  static {
    GObject.registerClass({
      GTypeName: "FullPlayerView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/full.ui",
      InternalChildren: [
        "title",
        "subtitle",
        "shuffle_button",
        "prev_button",
        "play_image",
        "next_button",
        "repeat_button",
        "progress_label",
        "duration_label",
        "volume_button",
        "scale_and_timer",
      ],
    }, this);
  }

  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _play_image!: Gtk.Image;
  _repeat_button!: Gtk.ToggleButton;
  _progress_label!: Gtk.Label;
  _duration_label!: Gtk.Label;
  _volume_button!: Gtk.VolumeButton;
  _scale_and_timer!: Gtk.Box;

  player: MuzikaPlayer;

  scale: PlayerScale;

  constructor() {
    super();

    this.player = get_player();

    this.scale = new PlayerScale();
    this.scale.insert_after(this._scale_and_timer, this._progress_label);

    this._volume_button.adjustment = Gtk.Adjustment.new(
      this.player.volume,
      0,
      1,
      0.01,
      0.1,
      0,
    );
  }

  song_changed() {
    this._progress_label.label = micro_to_string(this.player.timestamp);

    const song = this.player.queue.current?.object;

    if (song) {
      this.show_song(song!);
    }
  }

  private listeners = new SignalListeners();

  setup_player() {
    this.song_changed();

    // update the player when the current song changes
    this.listeners.connect(
      this.player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.add_bindings(
      bind_play_icon(this._play_image),
    );

    this.listeners.connect(this.player, "notify::duration", () => {
      this._duration_label.label = micro_to_string(this.player.duration);
    });

    // buttons

    this.listeners.add_bindings(
      ...bind_repeat_button(this._repeat_button),
    );

    // setting up volume button

    this._volume_button.adjustment.value = this.player.cubic_volume;

    this.listeners.connect(this.player, "notify::cubic-volume", () => {
      this._volume_button.adjustment.value = this.player.cubic_volume;
    });

    this.listeners.connect(this._volume_button, "value-changed", () => {
      this.player.cubic_volume = this._volume_button.adjustment.value;
    });

    this.listeners.connect(this._volume_button, "query-tooltip", (
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
    });

    this.listeners.connect(this.player, "notify::timestamp", () => {
      this._progress_label.label = micro_to_string(this.player.timestamp);
    });

    this.listeners.connect(this.scale, "notify::value", (_, value) => {
      this._progress_label.label = micro_to_string(value);
    });

    [this._title, this._subtitle].forEach((label) => {
      this.listeners.connect(
        label,
        "activate-link",
        (_: Gtk.Label, uri: string) => {
          if (uri && uri.startsWith("muzika:")) {
            this.activate_action(
              "navigator.visit",
              GLib.Variant.new_string(uri),
            );

            return true;
          }
        },
      );
    });
  }

  show_song(track: QueueTrack) {
    // labels

    if (track.album) {
      this._title.set_markup(
        `<a href="muzika:album:${track.album.id}?track=${track.videoId}">${
          escape_label(track.title)
        }</a>`,
      );
      this._title.tooltip_text = track.title;
    } else {
      this._title.use_markup = false;
      this._title.label = track.title;
      this._title.tooltip_text = track.title;
    }

    const subtitle = pretty_subtitles(track.artists);

    this._subtitle.set_markup(subtitle.markup);
    this._subtitle.tooltip_text = subtitle.plain;

    this._duration_label.label = track.duration_seconds
      ? seconds_to_string(track.duration_seconds)
      : track.duration ?? "00:00";
  }

  vfunc_map(): void {
    this.listeners.clear();
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
