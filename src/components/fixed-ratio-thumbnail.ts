import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

export interface FixedRatioThumbnailProps
  extends Gtk.Widget.ConstructorProperties {
  paintable?: Gdk.Paintable | null;
  // aspect_ratio?: number;
  min_width?: number;
}

export class FixedRatioThumbnail extends Gtk.Widget implements Gtk.Orientable {
  static {
    GObject.registerClass({
      GTypeName: "FixedRatioThumbnail",
      Properties: {
        paintable: GObject.ParamSpec.object(
          "paintable",
          "Paintable",
          "The currently displayed paintable",
          GObject.ParamFlags.READWRITE,
          Gdk.Paintable,
        ),
        // aspect_ratio: GObject.ParamSpec.int(
        //   "aspect-ratio",
        //   "Aspect Ratio",
        //   "The aspect ratio of the displayed image",
        //   GObject.ParamFlags.READWRITE,
        //   0,
        //   100,
        //   0,
        // ),
        min_width: GObject.ParamSpec.int(
          "min-width",
          "Minimum Width",
          "The minimum width of this image",
          GObject.ParamFlags.READWRITE,
          0,
          GLib.MAXINT32,
          0,
        ),
        max_width: GObject.ParamSpec.int(
          "max-width",
          "Maximum Width",
          "The maximum width of this image",
          GObject.ParamFlags.READWRITE,
          -1,
          GLib.MAXINT32,
          -1,
        ),
        min_height: GObject.ParamSpec.int(
          "min-height",
          "Minimum Height",
          "The minimum height of this image",
          GObject.ParamFlags.READWRITE,
          0,
          GLib.MAXINT32,
          0,
        ),
        max_height: GObject.ParamSpec.int(
          "max-height",
          "Maximum Height",
          "The maximum height of this image",
          GObject.ParamFlags.READWRITE,
          -1,
          GLib.MAXINT32,
          -1,
        ),
        orientation: GObject.ParamSpec.enum(
          "orientation",
          "Orientation",
          "The orientation of the image",
          GObject.ParamFlags.READWRITE,
          Gtk.Orientation,
          Gtk.Orientation.HORIZONTAL,
        ),
        can_expand: GObject.ParamSpec.boolean(
          "can-expand",
          "Can Expand",
          "Whether to expand the image to fill the available space",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
      Implements: [Gtk.Orientable],
    }, this);
  }

  constructor(props?: Partial<FixedRatioThumbnailProps>) {
    super({
      ...props,
    });
  }

  // property: orientation

  private _orientation: Gtk.Orientation = Gtk.Orientation.HORIZONTAL;

  get orientation(): Gtk.Orientation {
    return this._orientation;
  }

  set orientation(orientation: Gtk.Orientation) {
    if (this._orientation == orientation) return;

    this._orientation = orientation;

    this.notify("orientation");
    this.queue_resize();
  }

  get_orientation(): Gtk.Orientation {
    return this.orientation;
  }

  set_orientation(orientation: Gtk.Orientation): void {
    this.orientation = orientation;
  }

  // property: paintable

  private _paintable: Gdk.Paintable | null = null;

  get paintable(): Gdk.Paintable | null {
    return this._paintable;
  }

  set paintable(paintable: Gdk.Paintable | null) {
    if (this._paintable == paintable) return;

    this.clear_paintable();

    this._paintable = paintable;

    if (paintable != null) {
      const paintable_flags = paintable.get_flags();
      if ((paintable_flags & Gdk.PaintableFlags.CONTENTS) == 0) {
        paintable.connect(
          "invalidate-contents",
          this.paintable_invalidate_contents_binded,
        );
      }

      if ((paintable_flags & Gdk.PaintableFlags.SIZE) == 0) {
        paintable.connect(
          "invalidate-size",
          this.paintable_invalidate_size_binded,
        );
      }
    }

    this.notify("paintable");
    this.queue_draw();
    this.queue_resize();
  }

  // property: min-width

  private _min_width: number = 0;

  get min_width(): number {
    return this._min_width;
  }

  set min_width(min_width: number) {
    if (this._min_width == min_width) return;

    this._min_width = min_width;

    this.notify("min-width");
    this.queue_resize();
  }

  // property: min-height

  private _min_height: number = 0;

  get min_height(): number {
    return this._min_height;
  }

  set min_height(min_height: number) {
    if (this._min_height == min_height) return;

    this._min_height = min_height;

    this.notify("min-width");
    this.queue_resize();
  }

  // property: max-width

  private _max_width: number = -1;

  get max_width(): number {
    return this._max_width;
  }

  set max_width(max_width: number) {
    if (this._max_width == max_width) return;

    this._max_width = max_width;

    this.notify("max-width");
    this.queue_resize();
  }

  // property: max-height

  private _max_height: number = -1;

  get max_height(): number {
    return this._max_height;
  }

  set max_height(max_height: number) {
    if (this._max_height == max_height) return;

    this._max_height = max_height;

    this.notify("max-width");
    this.queue_resize();
  }

  // property: max-height

  private _can_expand: boolean = false;

  get can_expand(): boolean {
    return this._can_expand;
  }

  set can_expand(can_expand: boolean) {
    if (this._can_expand == can_expand) return;

    this._can_expand = can_expand;

    this.notify("max-width");
    this.queue_resize();
  }

  get aspect_ratio() {
    return this.paintable?.get_intrinsic_aspect_ratio() || 16 / 9;
  }

  vfunc_measure(
    orientation: Gtk.Orientation,
    for_size: number,
  ): [number, number, number, number] {
    let size: number,
      minimum_baseline = -1,
      natural_baseline = -1;

    const expand = this.can_expand;

    size = orientation === Gtk.Orientation.HORIZONTAL
      ? min_if_present(
        (expand ? Math.max(for_size, this.min_height) : this.min_height) *
          this.aspect_ratio,
        this.max_height,
      )
      : min_if_present(
        (expand ? Math.max(for_size, this.min_width) : this.min_width) /
          this.aspect_ratio,
        this.max_width,
      );

    return [size, size, minimum_baseline, natural_baseline];
  }

  vfunc_snapshot(snapshot: Gtk.Snapshot): void {
    if (this._paintable == null) {
      return;
    }

    const widget_width = this.get_width();
    const widget_height = this.get_height();

    this._paintable.snapshot(snapshot, widget_width, widget_height);
  }

  private clear_paintable() {
    if (this._paintable == null) return;

    const flags = this._paintable.get_flags();

    if ((flags & Gdk.PaintableFlags.CONTENTS) == 0) {
      GObject.signal_handlers_disconnect_by_func(
        this._paintable,
        this.paintable_invalidate_contents_binded,
      );
    }

    if ((flags & Gdk.PaintableFlags.SIZE) == 0) {
      GObject.signal_handlers_disconnect_by_func(
        this._paintable,
        this.paintable_invalidate_size_binded,
      );
    }
  }

  vfunc_get_request_mode(): Gtk.SizeRequestMode {
    if (this.orientation === Gtk.Orientation.VERTICAL) {
      return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    } else {
      return Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT;
    }
  }

  private paintable_invalidate_contents() {
    this.queue_draw();
  }

  private paintable_invalidate_contents_binded = this
    .paintable_invalidate_contents.bind(this);

  private paintable_invalidate_size() {
    this.queue_resize();
  }

  private paintable_invalidate_size_binded = this
    .paintable_invalidate_size.bind(this);
}

function max_if_present(...values: number[]) {
  return Math.max(...values.filter((v) => v > 0));
}

function min_if_present(...values: number[]) {
  return Math.max(...values.filter((v) => v > 0));
}
