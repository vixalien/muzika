import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GstAudio from "gi://GstAudio";

import { VideoControls } from "./controls";
import { SignalListeners } from "src/util/signal-listener";
import { Settings } from "src/application";

VideoControls;

export class VolumeControls extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "VolumeControls",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/video/volume-controls.ui",
      InternalChildren: ["button", "adjustment"],
    }, this);
  }

  private _button!: Gtk.ToggleButton;
  private _adjustment!: Gtk.Adjustment;

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
    const adjusted_value = this._adjustment.value = GstAudio
      .stream_volume_convert_volume(
        GstAudio.StreamVolumeFormat.LINEAR,
        GstAudio.StreamVolumeFormat.CUBIC,
        value,
      );

    let icon_name: string, toggled = false;

    if (adjusted_value === 0) {
      icon_name = "audio-volume-muted-symbolic";
      toggled = true;
    } else if (adjusted_value < 0.33) {
      icon_name = "audio-volume-low-symbolic";
    } else if (adjusted_value < 0.66) {
      icon_name = "audio-volume-medium-symbolic";
    } else {
      icon_name = "audio-volume-high-symbolic";
    }

    this._button.set_icon_name(icon_name);
    this._button.set_active(toggled);
  }

  private last_value = 0;

  private on_togglebutton_toggled() {
    const value = this.get_volume_slider_value();

    let new_value: number;

    if (value === 0) {
      new_value = this.last_value;
    } else {
      this.last_value = value;
      new_value = 0;
    }

    this.set_volume_slider_value(new_value);
    Settings.set_double("volume", new_value);
  }

  private on_adjustment_value_changed() {
    Settings.set_double("volume", this.get_volume_slider_value());
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
    this.set_volume_slider_value(Settings.get_double("volume"));

    this.listeners.connect(Settings, "changed::volume", () => {
      const volume = Settings.get_double("volume");

      if (volume !== this.get_volume_slider_value()) {
        this.set_volume_slider_value(volume);
      }
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
