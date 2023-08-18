import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GstAudio from "gi://GstAudio";

import { VideoControls } from "./controls";
import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";

VideoControls;

export class VolumeControls extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "VolumeControls",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/video/volume-controls.ui",
      InternalChildren: ["button", "adjustment", "scale"],
    }, this);
  }

  private _button!: Gtk.ToggleButton;
  private _adjustment!: Gtk.Adjustment;
  private _scale!: Gtk.Scale;

  listeners = new SignalListeners();

  constructor() {
    super();
  }

  private get_volume_slider_value() {
    return GstAudio.stream_volume_convert_volume(
      GstAudio.StreamVolumeFormat.CUBIC,
      GstAudio.StreamVolumeFormat.LINEAR,
      this._adjustment.value,
    );
  }

  private set_volume_slider_value(value: number) {
    this._adjustment.value = GstAudio
      .stream_volume_convert_volume(
        GstAudio.StreamVolumeFormat.LINEAR,
        GstAudio.StreamVolumeFormat.CUBIC,
        value,
      );
  }

  update_icon(muted: boolean, volume: number) {
    let icon_name: string;

    if (muted) {
      icon_name = "audio-volume-muted-symbolic";
    } else {
      if (volume === 0) {
        icon_name = "audio-volume-muted-symbolic";
      } else if (volume < 0.33) {
        icon_name = "audio-volume-low-symbolic";
      } else if (volume < 0.66) {
        icon_name = "audio-volume-medium-symbolic";
      } else {
        icon_name = "audio-volume-high-symbolic";
      }
    }

    this.get_volume_slider_value();

    this._button.set_icon_name(icon_name);
  }

  private update_values() {
    const player = get_player(),
      volume = player.volume,
      muted = player.muted;

    this.update_icon(muted, volume);

    this._button.set_active(muted || volume === 0);

    // don't update the value if the user is currently interacting with the slider
    if (
      this.get_volume_slider_value() != volume &&
      (this._scale.get_state_flags() & Gtk.StateFlags.ACTIVE) === 0
    ) {
      this.set_volume_slider_value(volume);
    }
  }

  private last_value = 0;

  private on_togglebutton_toggled(button: Gtk.ToggleButton) {
    const player = get_player();

    if (button.active) {
      this.last_value = this.get_volume_slider_value();
      player.volume = 0;
    } else {
      player.volume = this.last_value;
    }

    this.update_values();
  }

  private on_scale_value_changed() {
    const player = get_player();

    const volume = this.get_volume_slider_value();

    player.volume = volume;

    if (player.muted) {
      player.muted = false;
    }

    this.update_icon(false, volume);
  }

  private on_query_tooltip(
    _widget: Gtk.VolumeButton,
    _x: number,
    _y: number,
    _keyboard_mode: boolean,
    tooltip: Gtk.Tooltip,
  ) {
    const value = this.get_volume_slider_value();

    if (value === 0) {
      tooltip.set_text(_("Muted"));
    } else if (value === 1) {
      tooltip.set_text(_("Full volume"));
    } else {
      tooltip.set_text(`${Math.round(value * 100)}%`);
    }

    return true;
  }

  private setup_listeners() {
    const player = get_player();

    this.update_values();

    this.listeners.connect(player, "notify::volume", () => {
      this.update_values();
    });

    this.listeners.connect(player, "notify::muted", () => {
      this.update_values();
    });
  }

  vfunc_map(): void {
    super.vfunc_map();
    this.setup_listeners();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
