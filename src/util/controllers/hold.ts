import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Settings } from "src/util/settings.js";

/**
 * Allows Muzika to request/not-request playing in the background
 */
export class MuzikaHoldController extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaHoldController",
        Properties: {
          active: GObject.param_spec_boolean(
            "active",
            "Active",
            "Whether the app is playing in the background",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  listener: number;

  constructor() {
    super();

    /**
     * track changes in the `background-play` key, and enable/disable background
     * playback respectively based on if there's an ongoing task
     */
    this.listener = Settings.connect("changed::background-play", () => {
      this.set_holding(this.active);
    });
  }

  clear() {
    Settings.disconnect(this.listener);
  }

  private _active = false;

  get active() {
    return this._active;
  }

  set active(value) {
    if (this.active === value) return;

    this.set_holding(value);

    this._active = value;
    this.notify("active");
  }

  private set_holding(value: boolean) {
    if (value && Settings.get_boolean("background-play")) {
      Gtk.Application.get_default()?.hold();
    } else {
      Gtk.Application.get_default()?.release();
    }
  }
}
