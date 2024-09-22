// Adapted from https://gitlab.gnome.org/World/amberol/-/blob/988c790d462adf6ccd9de74e0de79d7acb238732/src/marquee.rs
// SPDX-FileCopyrightText: 2023 Yuri Izmer, Angelo Verlain
// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Graphene from "gi://Graphene";
import Gsk from "gi://Gsk";
import Pango from "gi://Pango";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

export class MuzikaMarquee extends Gtk.Widget {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaMarquee",
        Properties: {
          label: GObject.param_spec_string(
            "label",
            "Label",
            "Label text",
            "",
            GObject.ParamFlags.READWRITE,
          ),
          width_chars: GObject.param_spec_int(
            "width-chars",
            "Width in Characters",
            "",
            0,
            GLib.MAXINT32,
            0,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Signals: {
          activate_link: {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this,
    );

    this.set_css_name("label");
    this.set_accessible_role(Gtk.AccessibleRole.LABEL);
  }

  private _rotation_progress = 0;
  private _label_fits = true;
  private _width_chars = 0;

  private _child = new Gtk.Label({
    xalign: 0,
    use_markup: true,
  });
  private _animation = new Adw.TimedAnimation({
    widget: this,
    value_from: 0,
    value_to: 1.0,
    easing: Adw.Easing.LINEAR,
    duration: 1000, // We'll update this dynamically
    target: Adw.CallbackAnimationTarget.new(
      this._set_rotation_progress.bind(this),
    ),
  });

  constructor() {
    super();

    this._child.set_parent(this);

    this._animation.connect("done", () => {
      GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        MuzikaMarquee.DELAY * 1000,
        () => {
          if (
            !this._label_fits &&
            this._animation.state !== Adw.AnimationState.PLAYING
          ) {
            this._animation.play();
          }

          return GLib.SOURCE_REMOVE;
        },
      );
    });

    this._animation.connect("notify::value", () => {
      this._set_rotation_progress(this._animation.value);
    });

    this._child.connect("activate-link", (_, arg) => {
      this.emit("activate-link", arg);

      return true;
    });
  }

  vfunc_measure(
    orientation: Gtk.Orientation,
    for_size: number,
  ): [number, number, number, number] {
    if (orientation === Gtk.Orientation.HORIZONTAL) {
      return [0, this._width_pixels(), -1, -1];
    } else {
      return this._child.measure(orientation, for_size);
    }
  }

  vfunc_size_allocate(width: number): void {
    const [, natural] = this._child.get_preferred_size();
    if (!natural) return;
    const child_width = Math.max(natural.width || 0, width);

    this._child.allocate(child_width, natural.height, -1, null);

    this._animation.duration = Math.max(child_width, 20) * 25;

    if (this._child.get_allocated_width() > width) {
      this._label_fits = false;
      this._start_animation();
    } else {
      this._label_fits = true;
      this._stop_animation();
    }
  }

  vfunc_snapshot(snapshot: Gtk.Snapshot): void {
    if (this._label_fits) {
      return super.vfunc_snapshot(snapshot);
    }

    const width = this.get_width();

    const child_snapshot = new Gtk.Snapshot();
    super.vfunc_snapshot(child_snapshot);
    const node = child_snapshot.to_node();

    if (!node) return;

    const label_bounds = node.get_bounds();
    const label_width = label_bounds.get_width();
    const label_height = label_bounds.get_height();

    const gradient_width = MuzikaMarquee.SPACING * 0.5;

    const bounds = new Graphene.Rect({
      origin: new Graphene.Point({
        x: -gradient_width,
        y: label_bounds.get_y(),
      }),
      size: new Graphene.Size({
        width: width + gradient_width,
        height: label_height,
      }),
    });

    snapshot.push_mask(Gsk.MaskMode.INVERTED_ALPHA);

    const l_start = bounds.get_top_left();
    const l_end = bounds.get_top_left();
    l_end.x += gradient_width;

    snapshot.append_linear_gradient(bounds, l_start, l_end, [
      new Gsk.ColorStop({
        offset: 0,
        color: new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 1 }),
      }),
      new Gsk.ColorStop({
        offset: 1,
        color: new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 0 }),
      }),
    ]);

    const r_start = bounds.get_top_right();
    r_start.x -= gradient_width;
    const r_end = bounds.get_top_right();

    snapshot.append_linear_gradient(bounds, r_start, r_end, [
      new Gsk.ColorStop({
        offset: 0,
        color: new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 0 }),
      }),
      new Gsk.ColorStop({
        offset: 1,
        color: new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 1 }),
      }),
    ]);

    snapshot.pop();

    snapshot.push_clip(bounds);

    snapshot.translate(
      new Graphene.Point({
        x: -(label_width + MuzikaMarquee.SPACING) * this._rotation_progress,
        y: 0,
      }),
    );

    snapshot.append_node(node);
    snapshot.translate(
      new Graphene.Point({ x: label_width + MuzikaMarquee.SPACING, y: 0 }),
    );
    snapshot.append_node(node);

    snapshot.pop();
    snapshot.pop();
  }

  get label() {
    return this._child.label;
  }

  set label(value: string) {
    if (this._child.label === value) return;

    this._child.label = value;
    this.notify("label");

    // restart animation i label was changed
    if (this._animation.state === Adw.AnimationState.PLAYING) {
      this._animation.skip();
    }
  }

  get width_chars() {
    return this._width_chars;
  }

  set width_chars(value: number) {
    if (this._width_chars === value) return;

    this._width_chars = value;
    this.notify("width-chars");
    this.queue_resize();
  }

  private _set_rotation_progress(value: number) {
    this._rotation_progress = value % 1.0;
    this.queue_draw();
  }

  private _width_pixels() {
    const metrics = this.get_pango_context().get_metrics(null, null);
    const char_width = Math.max(
      metrics.get_approximate_char_width(),
      metrics.get_approximate_digit_width(),
    );
    const width = char_width * this._width_chars;
    return width / Pango.SCALE;
  }

  _start_animation() {
    if (this._animation.state == Adw.AnimationState.PLAYING) return;

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, MuzikaMarquee.DELAY * 1000, () => {
      if (this._animation.state !== Adw.AnimationState.PLAYING) {
        this._animation.play();
      }

      return GLib.SOURCE_REMOVE;
    });
  }

  _stop_animation() {
    this._animation.pause();
  }

  static SPACING = 12;
  static DELAY = 3;
}
