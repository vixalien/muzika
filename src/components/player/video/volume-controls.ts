import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";
import { get_volume_icon_name } from "src/util/volume";

export class VolumeControls extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "VolumeControls",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/video/volume-controls.ui",
        InternalChildren: ["button", "adjustment", "scale"],
      },
      this,
    );
  }

  private _button!: Gtk.ToggleButton;
  private _adjustment!: Gtk.Adjustment;
  private _scale!: Gtk.Scale;

  listeners = new SignalListeners();

  update_icon(muted: boolean, volume: number) {
    this._button.set_icon_name(get_volume_icon_name(muted, volume));
  }

  private update_values() {
    const player = get_player(),
      cubic_volume = player.cubic_volume,
      muted = player.muted;

    this.update_icon(muted, cubic_volume);

    this._button.set_active(muted || cubic_volume === 0);

    // don't update the value if the user is currently interacting with the slider
    if (
      this._adjustment.value != cubic_volume &&
      (this._scale.get_state_flags() & Gtk.StateFlags.ACTIVE) === 0
    ) {
      this._adjustment.value = cubic_volume;
    }
  }

  private last_value = 0;

  private on_togglebutton_toggled(button: Gtk.ToggleButton) {
    const player = get_player();

    if (button.active) {
      this.last_value = this._adjustment.value;
      player.cubic_volume = 0;
    } else {
      player.cubic_volume = this.last_value;
    }

    this.update_values();
  }

  private on_scale_value_changed() {
    const player = get_player();

    const volume = this._adjustment.value;

    player.cubic_volume = volume;

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
    const value = this._adjustment.value;

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

    this.listeners.connect(player, "notify::cubic-volume", () => {
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
