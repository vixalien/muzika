import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gst from "gi://Gst";
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

  animation: Adw.TimedAnimation | null = null;

  constructor() {
    super({
      hexpand: true,
      valign: Gtk.Align.START,
    });

    this.add_css_class("osd");
  }

  reset() {
    if (this.animation) {
      this.animation.reset();
      this.animation = null;
    }
  }

  private setup_animation(duration: number, position: number) {
    this.reset();

    const target = Adw.PropertyAnimationTarget.new(this, "fraction");

    this.animation = new Adw.TimedAnimation({
      duration: (duration - position) / Gst.MSECOND,
      target,
      widget: this,
      value_from: position / duration,
      value_to: 1,
      easing: Adw.Easing.LINEAR,
    });
  }

  get value() {
    return this.fraction * this.duration;
  }

  set value(value: number) {
    this.fraction = value / this.duration;
  }

  private _duration = 1;

  get duration() {
    return this._duration;
  }

  set_duration(value: number) {
    if (value === this._duration) return;

    this._duration = value;

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

  update_position(position: number) {
    const playing = this.animation?.state === Adw.AnimationState.PLAYING;

    this.setup_animation(this.duration, position);

    if (playing) {
      this.animation?.play();
    } else {
      this.value = position;
      this.notify("value");
    }
  }
}
