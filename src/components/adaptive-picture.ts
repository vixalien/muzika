// code borrowed from https://github.com/dino/dino/blob/8c8c2dc4b0e08a2e6d73b45fba795d462595418f/main/src/ui/widgets/fixed_ratio_picture.vala
// thanks Nahu!
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

export class AdaptivePicture extends Gtk.Widget {
  static {
    GObject.registerClass({
      GTypeName: "AdaptivePicture",
      Properties: {
        min_width: GObject.ParamSpec.int(
          "min-width",
          "Min Width",
          "Min Width",
          GObject.ParamFlags.READWRITE,
          GLib.MININT32,
          GLib.MAXINT32,
          -1,
        ),
        max_width: GObject.ParamSpec.int(
          "max-width",
          "Max Width",
          "Max Width",
          GObject.ParamFlags.READWRITE,
          GLib.MININT32,
          GLib.MAXINT32,
          10000,
        ),
        min_height: GObject.ParamSpec.int(
          "min-height",
          "Min Height",
          "Min Height",
          GObject.ParamFlags.READWRITE,
          GLib.MININT32,
          GLib.MAXINT32,
          -1,
        ),
        max_height: GObject.ParamSpec.int(
          "max-height",
          "Max Height",
          "Max Height",
          GObject.ParamFlags.READWRITE,
          GLib.MININT32,
          GLib.MAXINT32,
          100000,
        ),
        paintable: GObject.ParamSpec.object(
          "paintable",
          "Paintable",
          "Paintable",
          GObject.ParamFlags.READWRITE,
          Gdk.Paintable.$gtype,
        ),
        content_fit: GObject.ParamSpec.enum(
          "content_fit",
          "Content Fit",
          "Content Fit",
          GObject.ParamFlags.READWRITE,
          Gtk.ContentFit.$gtype,
          Gtk.ContentFit.FILL,
        ),
        fill_space: GObject.ParamSpec.boolean(
          "fill-space",
          "Fill Space",
          "Whether to fill all available space",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
    }, this);
  }

  min_width = -1;
  max_width = GLib.MAXINT32;
  min_height = -1;
  max_height = GLib.MAXINT32;
  fill_space = false;

  get paintable() {
    return this._inner.paintable;
  }

  set paintable(paintable: Gdk.Paintable) {
    this._stack.set_visible_child_name("picture");
    this._inner.paintable = paintable;
  }

  get content_fit() {
    return this._inner.content_fit;
  }

  set content_fit(content_fit: Gtk.ContentFit) {
    this._inner.content_fit = content_fit;
  }

  private _inner = new Gtk.Picture();
  private _image = Gtk.Image.new_from_icon_name("image-missing-symbolic");
  private _stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.CROSSFADE,
  });

  constructor(props?: Partial<Gtk.Widget.ConstructorProperties>) {
    super({
      css_name: "picture",
      name: "picture",
      ...props,
    });

    this.add_css_class("fixed-ratio");

    this._stack.add_named(this._image, "image");
    this._stack.add_named(this._inner, "picture");

    this._stack.set_visible_child_name("image");

    this._stack.insert_after(this, null);
    this.connect("notify", () => {
      this._image.pixel_size = Math.min(this.min_width, this.min_height);
      this.queue_resize();
    });
  }

  private measure_target_size() {
    let width: number, height: number;

    if (this.width_request != -1 && this.height_request != -1) {
      width = this.width_request;
      height = this.height_request;
    } else {
      width = this.min_width;
      height = this.min_height;

      if (this._inner.should_layout()) {
        const [
          _child_min = 0,
          child_nat = 0,
          _child_min_baseline = -1,
          _child_nat_baseline = -1,
        ] = this._inner.measure(Gtk.Orientation.HORIZONTAL, -1);
        width = Math.max(child_nat, width);
      }

      width = Math.min(width, this.max_width);

      if (this._inner.should_layout()) {
        const [
          _child_min = 0,
          child_nat = 0,
          _child_min_baseline = -1,
          _child_nat_baseline = -1,
        ] = this._inner.measure(Gtk.Orientation.VERTICAL, width);
        height = Math.max(child_nat, height);
      }

      if (height > this.max_height) {
        height = this.max_height;
        width = this.min_width;

        if (this._inner.should_layout()) {
          const [
            _child_min = 0,
            child_nat = 0,
            _child_min_baseline = -1,
            _child_nat_baseline = -1,
          ] = this._inner.measure(Gtk.Orientation.HORIZONTAL, this.max_height);
          width = Math.max(child_nat, width);
        }

        width = Math.min(width, this.max_width);
      }
    }

    return [width, height];
  }

  vfunc_measure(
    orientation: Gtk.Orientation,
    for_size: number,
  ): [number, number, number, number] {
    const minimum_baseline = -1;
    const natural_baseline = -1;
    let minimum: number, natural: number;

    const [width, height] = this.measure_target_size();

    if (this.fill_space) {
      if (orientation == Gtk.Orientation.HORIZONTAL) {
        minimum = this.min_width;
        natural = width;
      } else if (for_size == -1) {
        minimum = this.min_height;
        natural = height;
      } else {
        minimum = natural = height * for_size / width;
      }
    } else {
      if (orientation == Gtk.Orientation.VERTICAL) {
        minimum = natural = Math.min(this.min_height, height);
      } else {
        minimum = natural = Math.min(this.min_width, width);
      }
    }

    return [minimum, natural, minimum_baseline, natural_baseline];
  }

  vfunc_size_allocate(width: number, height: number, baseline: number): void {
    if (this._stack.should_layout()) {
      this._stack.allocate(width, height, baseline, null);
    }
  }

  vfunc_get_request_mode(): Gtk.SizeRequestMode {
    if (this.fill_space) {
      return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    }
    return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
  }

  vfunc_dispose(): void {
    this._stack.unparent();
    super.vfunc_dispose();
  }
}
