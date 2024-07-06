import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import type { QueueTrack } from "libmuse";

import { PlayerScale } from "./scale.js";
import { escape_label, pretty_subtitles } from "src/util/text.js";
import { MuzikaPlayer } from "src/player";
import { micro_to_string } from "src/util/time.js";
import { PlayerPreview } from "./preview.js";
import { SignalListeners } from "src/util/signal-listener.js";
import { get_player } from "src/application.js";
import {
  bind_play_icon,
  bind_repeat_button,
  bind_track_artists,
  bind_track_title,
} from "src/player/helpers.js";
import { setup_link_label } from "src/util/label.js";
import { MuzikaNPDetailsSwitcher } from "./now-playing/switcher.js";

GObject.type_ensure(PlayerPreview.$gtype);
GObject.type_ensure(PlayerScale.$gtype);

export class FullPlayerView extends Gtk.ActionBar {
  static {
    GObject.registerClass({
      GTypeName: "FullPlayerView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/full.ui",
      Properties: {
        details_stack: GObject.param_spec_object(
          "details-stack",
          "Detais View Stack",
          "The view stack to show details switchers for",
          Adw.ViewStack.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
        show_details: GObject.param_spec_boolean(
          "show-details",
          "Show Details",
          "If the details should be shown",
          false,
          GObject.ParamFlags.READWRITE,
        ),
      },
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
        "switcher",
      ],
    }, this);
  }

  show_details = false;
  details_stack!: Adw.ViewStack;

  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _play_image!: Gtk.Image;
  private _repeat_button!: Gtk.ToggleButton;
  private _progress_label!: Gtk.Label;
  private _duration_label!: Gtk.Label;
  private _volume_button!: Gtk.VolumeButton;
  private _switcher!: MuzikaNPDetailsSwitcher;

  player: MuzikaPlayer;

  constructor() {
    super();

    this.player = get_player();

    this._volume_button.adjustment = Gtk.Adjustment.new(
      this.player.volume,
      0,
      1,
      0.01,
      0.1,
      0,
    );

    this.bind_property(
      "show-details",
      this._switcher,
      "show-details",
      GObject.BindingFlags.BIDIRECTIONAL,
    );

    this.bind_property(
      "details-stack",
      this._switcher,
      "details-stack",
      GObject.BindingFlags.BIDIRECTIONAL,
    );

    // we can't put this in `setup_player` because that method is only ever
    // called on map, and invisible widgets can't be mapped
    // @ts-expect-error incorrect types
    this.player.queue.bind_property_full(
      "current",
      this,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
      (_, from) => {
        return [true, !!from];
      },
      null,
    );
  }

  private listeners = new SignalListeners();

  setup_player() {
    this.listeners.add_bindings(
      bind_play_icon(this._play_image),
      ...bind_repeat_button(this._repeat_button),
      ...bind_track_title(this._title),
      ...bind_track_artists(this._subtitle),
      this.player.bind_property(
        "cubic-volume",
        this._volume_button.adjustment,
        "value",
        GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE,
      ),
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "duration",
        this._duration_label,
        "label",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [true, micro_to_string(this.player.duration)];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "timestamp",
        this._progress_label,
        "label",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [
            true,
            micro_to_string(
              this.player.initial_seek_to ?? this.player.timestamp,
            ),
          ];
        },
        null,
      ),
    );

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

    [this._title, this._subtitle].forEach((label) => {
      setup_link_label(label);
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
  }

  private gesture_pressed_cb(gesture: Gtk.Gesture) {
    gesture.set_state(Gtk.EventSequenceState.CLAIMED);

    this.activate_action(
      "win.visible-view",
      GLib.Variant.new_string("video"),
    );
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
