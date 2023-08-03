import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

export class PlayerProgressBar extends Gtk.ProgressBar {
  static {
    GObject.registerClass({
      GTypeName: "PlayerProgressBar",
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
        animation: GObject.ParamSpec.object(
          "animation",
          "Animation",
          "The animation object",
          GObject.ParamFlags.READWRITE,
          Adw.TimedAnimation,
        ),
      },
      Signals: {},
    }, this);
  }

  constructor() {
    super({
      hexpand: true,
      valign: Gtk.Align.START,
    });

    this.add_css_class("osd");
  }

  get value() {
    return this.fraction * this.duration;
  }

  set value(value: number) {
    this.fraction = Math.min(value / this.duration, 1);
  }

  private _duration = 1;

  get duration() {
    return this._duration;
  }

  set_duration(value: number) {
    if (value === this._duration) return;

    this._duration = value;
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
