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
        animation: GObject.ParamSpec.object(
          "animation",
          "Animation",
          "The animation object",
          GObject.ParamFlags.READWRITE,
          Adw.TimedAnimation,
        ),
      },
      Signals: {
        "user-changed-value": {
          param_types: [GObject.TYPE_DOUBLE],
        },
      },
    }, this);
  }

  animation: Adw.TimedAnimation | null = null;

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
      if (this.animation) {
        // first end the animation to reduce jiggling of duration label
        this.animation.connect("done", () => {
          // reset the value to what it was before the animation ended
          this.adjustment.value = value;
          this.user_changed_value();
        });

        this.animation.skip();
      } else {
        this.user_changed_value();
      }
    });
  }

  private user_changed_value() {
    this.setup_animation(this.duration, this.value);
    this.emit("user-changed-value", this.value);
    this.notify("value");
  }

  reset() {
    if (this.animation) {
      this.animation.reset();
      this.animation = null;
    }

    // this.adjustment.value = 0;
  }

  private setup_animation(duration: number, position: number) {
    this.reset();

    const target = Adw.PropertyAnimationTarget.new(this, "value");

    this.animation = new Adw.TimedAnimation({
      duration: (duration - position) / Gst.MSECOND,
      target,
      widget: this,
      value_from: position,
      value_to: duration,
      easing: Adw.Easing.LINEAR,
    });
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

    this.setup_animation(value, 0);
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

  play(position?: number) {
    if (!this.animation) return;

    if (position) {
      this.setup_animation(this.duration, position);
    }

    if (this.animation.state === Adw.AnimationState.PLAYING) {
      return;
    }

    this.animation.play();
  }

  pause() {
    if (!this.animation || this.animation.state != Adw.AnimationState.PLAYING) {
      return;
    }

    this.animation.pause();
  }
}
