import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gst from "gi://Gst";
import Adw from "gi://Adw";

export class PlayerScale extends Gtk.Scale {
  static {
    GObject.registerClass({
      GTypeName: "PlayerScale",
      Properties: {
        duration: GObject.ParamSpec.double(
          "duration",
          "Duration",
          "Duration in nanoseconds",
          GObject.ParamFlags.READABLE,
          0,
          Number.MAX_SAFE_INTEGER,
          0,
        ),
        value: GObject.ParamSpec.double(
          "value",
          "Value",
          "Value in nanoseconds",
          GObject.ParamFlags.READWRITE,
          0,
          Number.MAX_SAFE_INTEGER,
          0,
        ),
        buffering: GObject.ParamSpec.boolean(
          "buffering",
          "Buffering",
          "Whether the player is buffering",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
      Signals: {
        "user-changed-value": {
          param_types: [GObject.TYPE_DOUBLE],
        },
      },
    }, this);
  }

  constructor() {
    super({
      hexpand: true,
      valign: Gtk.Align.CENTER,
      draw_value: false,
      adjustment: Gtk.Adjustment.new(
        0,
        0,
        100 * Gst.SECOND,
        Gst.MSECOND,
        10 * Gst.MSECOND,
        2,
      ),
    });

    this.connect("change-value", (_, _scroll, value: number) => {
      this.user_changed_value();
    });
  }

  private user_changed_value() {
    this.emit("user-changed-value", this.value);
    this.notify("value");
  }

  get value() {
    return this.adjustment.value;
  }

  set value(value: number) {
    this.adjustment.value = value;
  }

  get duration() {
    return this.adjustment.upper;
  }

  set_duration(value: number) {
    if (value === this.duration) return;

    this.adjustment.upper = value;
  }

  private _buffering: boolean = false;

  get buffering() {
    return this._buffering;
  }

  set buffering(value: boolean) {
    this._buffering = value;

    if (value) {
      this.add_css_class("buffering");
    } else {
      this.remove_css_class("buffering");
    }
  }
  update_position(position: number) {
    this.value = position;
    this.notify("value");
  }
}
