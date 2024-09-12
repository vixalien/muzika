// from: https://gitlab.gnome.org/World/amberol/-/blob/main/src/volume_control.rs

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";
import { get_volume_icon_name } from "src/util/volume";

export class MuzikaNPVolumeControl extends Gtk.Widget {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPVolumeControl",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/volume-control.ui",
        CssName: "np-volume",
        Properties: {
          volume: GObject.param_spec_double(
            "volume",
            "volume",
            "Volume",
            0.0,
            1.0,
            1.0,
            GObject.ParamFlags.READWRITE,
          ),
          muted: GObject.param_spec_boolean(
            "muted",
            "muted",
            "muted",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
        InternalChildren: ["volume_adjustment", "volume_low_button"],
      },
      this,
    );

    this.set_layout_manager_type(Gtk.BoxLayout.$gtype);
    this.set_accessible_role(Gtk.AccessibleRole.GROUP);

    this.install_property_action("volume.toggle-mute", "muted");
  }

  private _volume_adjustment!: Gtk.Adjustment;
  private _volume_low_button!: Gtk.Button;

  get volume() {
    return this._volume_adjustment.value;
  }

  set volume(value: number) {
    this._volume_adjustment.value = value;
  }

  private prev_volume = 0;

  private _muted = false;

  get muted() {
    return this._muted;
  }

  set muted(value: boolean) {
    if (value === this._muted) return;

    if (value) {
      this.prev_volume = this._volume_adjustment.value;
      this._volume_adjustment.value = 0;
    } else {
      this._volume_adjustment.value = this.prev_volume;
    }
    this._muted = value;
  }

  private adjustment_value_changed_cb(adjustment: Gtk.Adjustment) {
    this._volume_low_button.icon_name = get_volume_icon_name(
      false,
      adjustment.value,
    );

    this.notify("volume");
  }

  private volume_scale_scrolled_cb(
    _: Gtk.EventControllerScroll,
    __: number,
    dy: number,
  ) {
    const delta = dy * this._volume_adjustment.step_increment;
    const d = Math.max(
      Math.min(
        this._volume_adjustment.value - delta,
        this._volume_adjustment.upper,
      ),
      0,
    );
    this._volume_adjustment.value = d;

    return true;
  }

  private listeners = new SignalListeners();

  vfunc_map() {
    super.vfunc_map();

    this.listeners.add_bindings(
      get_player().bind_property(
        "cubic-volume",
        this,
        "volume",
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
      ),
      get_player().bind_property(
        "muted",
        this,
        "muted",
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
      ),
    );
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
