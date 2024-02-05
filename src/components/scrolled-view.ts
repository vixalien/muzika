import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";

export class ScrolledView extends Gtk.Widget {
  static {
    GObject.registerClass({
      GTypeName: "ScrolledView",
      Implements: [
        Gtk.Buildable,
        Gtk.Scrollable,
      ],
      Properties: {
        header: GObject.param_spec_object(
          "header",
          "Header",
          "The header widget",
          Gtk.Widget.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
        footer: GObject.param_spec_object(
          "footer",
          "Footer",
          "The footer widget",
          Gtk.Widget.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
        child: GObject.param_spec_object(
          "child",
          "child",
          "The Child widget",
          Gtk.Scrollable.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
        hadjustment: GObject.param_spec_object(
          "hadjustment",
          "Hadjustment",
          "Horizontal Adjustment",
          Gtk.Adjustment.$gtype,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
        ),
        vadjustment: GObject.param_spec_object(
          "vadjustment",
          "Vadjustment",
          "Vertical Adjustment",
          Gtk.Adjustment.$gtype,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
        ),
        vscroll_policy: GObject.param_spec_enum(
          "vscroll-policy",
          "VScroll-Policy",
          "Vertical Scroll Policy",
          Gtk.ScrollablePolicy.$gtype,
          Gtk.ScrollablePolicy.MINIMUM,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
        ),
        hscroll_policy: GObject.param_spec_enum(
          "hscroll-policy",
          "HScroll-Policy",
          "Horizontal Scroll Policy",
          Gtk.ScrollablePolicy.$gtype,
          Gtk.ScrollablePolicy.MINIMUM,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
        ),
      },
    }, this);

    // this.set_layout_manager_type(Gtk.BoxLayout.$gtype);
  }

  constructor() {
    super();

    // const mgr = this.get_layout_manager() as Gtk.BoxLayout;

    // mgr.orientation = Gtk.Orientation.VERTICAL;

    this.child_adjustment[Gtk.Orientation.HORIZONTAL].connect("changed", () => {
      console.log("hchanged!");
    });

    this.child_adjustment[Gtk.Orientation.HORIZONTAL].connect("changed", () => {
      console.log("vchanged!");
    });
  }

  // property header
  private _header?: Gtk.Widget;
  public get header() {
    return this._header;
  }
  public set header(widget: Gtk.Widget | undefined) {
    if (widget === this._header) return;

    if (this._header) {
      this._header.unparent();
    }

    widget?.set_parent(this);

    this._header = widget;
    this.notify("header");
  }

  // property child
  private _child?: Gtk.Widget;
  public get child() {
    return this._child;
  }
  public set child(widget: Gtk.Widget | undefined) {
    if (widget === this._child) return;

    if (this._child) {
      this._child.unparent();
    }

    if (widget) {
      this.setup_child(widget);
    }
  }

  // property footer
  private _footer?: Gtk.Widget;
  public get footer() {
    return this._footer;
  }
  public set footer(widget: Gtk.Widget | undefined) {
    if (widget === this._footer) return;

    if (this._footer) {
      this._footer.unparent();
    }

    widget?.set_parent(this);
    this._footer = widget;
    this.notify("footer");
  }

  vfunc_add_child(
    builder: Gtk.Builder,
    child: GObject.Object,
    type?: string | null | undefined,
  ): void {
    if (!(child instanceof Gtk.Widget)) return;

    if (type === "header") {
      this.header = child;
    } else if (type === "footer") {
      this.footer = child;
    } else {
      this.child = child;
    }
  }

  // scrollable

  // adjustments

  private adjustment: OrientedPair<Gtk.Adjustment> = {
    "0": new Gtk.Adjustment(),
    "1": new Gtk.Adjustment(),
  };

  // hadjustment
  public get hadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.HORIZONTAL];
  }
  public set hadjustment(v: Gtk.Adjustment) {
    this.adjustment[Gtk.Orientation.HORIZONTAL] = v;
    this.queue_allocate();
    this.notify("hadjustment");
    v.connect("value-changed", () => this.queue_allocate());
  }

  public get vadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.VERTICAL];
  }
  public set vadjustment(v: Gtk.Adjustment) {
    this.adjustment[Gtk.Orientation.VERTICAL] = v;
    v.connect("value-changed", () => this.queue_allocate());
    this.notify("vadjustment");
    this.queue_allocate();
  }

  // scroll policy

  private scroll_policy = orientedPair(Gtk.ScrollablePolicy.MINIMUM);

  // vscroll-policy
  public get vscroll_policy(): Gtk.ScrollablePolicy {
    return this.scroll_policy[Gtk.Orientation.VERTICAL];
  }
  public set vscroll_policy(v: Gtk.ScrollablePolicy) {
    if (v === this.vscroll_policy) return;
    this.scroll_policy[Gtk.Orientation.VERTICAL] = v;
    this.queue_resize();
    this.notify("vscroll-policy");
  }

  // hscroll-policy
  public get hscoll_policy(): Gtk.ScrollablePolicy {
    return this.scroll_policy[Gtk.Orientation.HORIZONTAL];
  }
  public set hscoll_policy(v: Gtk.ScrollablePolicy) {
    if (v === this.hscoll_policy) return;
    this.scroll_policy[Gtk.Orientation.HORIZONTAL] = v;
    this.queue_resize();
    this.notify("hscroll-policy");
  }

  private child_adjustment = orientedPair(
    new Gtk.Adjustment(),
    new Gtk.Adjustment(),
  );

  private setup_child(child: Gtk.Widget) {
    if (!isScrollable(child)) {
      throw new Error("A ScrolledView child must be scrollable.");
    }

    child.hadjustment = this.child_adjustment[Gtk.Orientation.HORIZONTAL];
    child.vadjustment = this.child_adjustment[Gtk.Orientation.VERTICAL];

    this._child = child;
    child.set_parent(this);
    this.notify("child");
  }

  vfunc_snapshot(snapshot: Gtk.Snapshot): void {
    this._header && this.snapshot_child(this._header, snapshot);
    this._child && this.snapshot_child(this._child, snapshot);
    this._footer && this.snapshot_child(this._footer, snapshot);
  }

  private set_adjustment_values(
    orientation: Gtk.Orientation,
    viewport_size: number,
    child_size: number,
  ) {
    const adjustment = this.adjustment[orientation];
    const upper = child_size;
    let value = adjustment.value;

    /* We clamp to the left in RTL mode */
    if (
      orientation === Gtk.Orientation.HORIZONTAL &&
      this.get_direction() === Gtk.TextDirection.RTL
    ) {
      const dist = adjustment.upper - value - adjustment.page_size;
      value = upper - dist - viewport_size;
    }

    adjustment.configure(
      value,
      0,
      upper,
      viewport_size * 0.1,
      viewport_size * 0.9,
      viewport_size,
    );
  }

  vfunc_size_allocate(width: number, height: number, baseline: number): void {
    const children = [this._header, this._child, this._footer];
    this.adjustment[Gtk.Orientation.VERTICAL].freeze_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].freeze_notify();

    // get the total and each widget's size
    const { totals, sizes } = this.get_widgets_sizes(children, width, height);

    // update the adjustment to reflect the total widget's sizes
    this.set_adjustment_values(
      Gtk.Orientation.HORIZONTAL,
      width,
      totals[Gtk.Orientation.HORIZONTAL],
    );
    this.set_adjustment_values(
      Gtk.Orientation.VERTICAL,
      height,
      totals[Gtk.Orientation.VERTICAL],
    );

    let x = this.adjustment[Gtk.Orientation.HORIZONTAL].value,
      y = this.adjustment[Gtk.Orientation.VERTICAL].value;

    // give each child an allocation
    for (const child of children) {
      if (child && child.visible) {
        const child_size = sizes.get(child)!;

        if (!child_size) throw new Error("oops...");

        const allocation = new Gdk.Rectangle();

        allocation.width = child_size[Gtk.Orientation.HORIZONTAL];
        allocation.height = child_size[Gtk.Orientation.VERTICAL];
        allocation.x = -x;
        allocation.y = -y;

        // x += allocation.width;
        y -= allocation.height;

        child.size_allocate(allocation, -1);
      }
    }

    this.adjustment[Gtk.Orientation.VERTICAL].thaw_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].thaw_notify();

    // for (
    //   const orientation of [
    //     Gtk.Orientation.VERTICAL,
    //     Gtk.Orientation.HORIZONTAL,
    //   ]
    // ) {
    //   const adjustment = this.adjustment[orientation];

    //   this.child_adjustment[orientation].configure(
    //     adjustment.value,
    //     adjustment.lower,
    //     adjustment.upper,
    //     adjustment.step_increment,
    //     adjustment.page_increment,
    //     adjustment.page_size,
    //   );
    // }

    // return super.vfunc_size_allocate(width, height, baseline);
  }

  // vfunc_size_allocate(width: number, height: number, baseline: number): void {
  //   const header_size = this.get_widget_size(this._header, width, height);
  //   const remnants = [
  //     width - header_size[Gtk.Orientation.HORIZONTAL],
  //     height - header_size[Gtk.Orientation.VERTICAL],
  //   ];
  // }

  private get_widgets_sizes(
    widgets: (Gtk.Widget | undefined)[],
    max_width: number,
    max_height: number,
  ) {
    const orientation =
      this.get_request_mode() === Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH
        ? Gtk.Orientation.VERTICAL
        : Gtk.Orientation.HORIZONTAL;

    const sizes = new Map<Gtk.Widget, OrientedPair<number>>();

    function getTotal(orientation: Gtk.Orientation) {
      return Array.from(sizes.values()).reduce(
        (total, size) => total + size[orientation],
        0,
      );
    }

    for (const widget of widgets) {
      const width = orientation === Gtk.Orientation.HORIZONTAL
        ? max_width - getTotal(orientation)
        : max_width;
      const height = orientation === Gtk.Orientation.VERTICAL
        ? max_height - getTotal(orientation)
        : max_height;

      const size = this.get_widget_size(widget, width, height);

      if (widget) {
        sizes.set(widget, size);
      }
    }

    let totals;

    if (orientation === Gtk.Orientation.VERTICAL) {
      totals = orientedPair(
        // TODO: widght must be Max(width)
        max_width,
        getTotal(Gtk.Orientation.VERTICAL),
      );
    } else {
      totals = orientedPair(
        getTotal(Gtk.Orientation.HORIZONTAL),
        max_height,
      );
    }

    return { totals, sizes };
  }

  private get_widget_size(
    widget: Gtk.Widget | undefined,
    max_width: number,
    max_height: number,
  ) {
    const child_size = orientedPair(0);

    if (widget && widget.visible) {
      child_size[Gtk.Orientation.HORIZONTAL] = max_width;
      child_size[Gtk.Orientation.VERTICAL] = max_height;

      const orientation =
        this.get_request_mode() === Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT
          ? Gtk.Orientation.VERTICAL
          : Gtk.Orientation.HORIZONTAL;

      const opposite = orientation === Gtk.Orientation.VERTICAL
        ? Gtk.Orientation.HORIZONTAL
        : Gtk.Orientation.VERTICAL;

      let min, nat;

      [min, nat] = widget.measure(orientation, -1);

      if (this.scroll_policy[orientation] === Gtk.ScrollablePolicy.MINIMUM) {
        child_size[orientation] = Math.max(child_size[orientation], min);
      } else {
        child_size[orientation] = Math.max(child_size[orientation], nat);
      }

      [min, nat] = widget.measure(opposite, child_size[orientation]);

      if (this.scroll_policy[opposite] === Gtk.ScrollablePolicy.MINIMUM) {
        child_size[opposite] = min;
      } else {
        child_size[opposite] = nat;
      }
    }

    return child_size;
  }

  vfunc_get_request_mode(): Gtk.SizeRequestMode {
    return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
  }
}

type OrientedPair<T> = Record<Gtk.Orientation, T>;

function orientedPair<T>(
  initial_value: T,
  initial_value2?: T,
): OrientedPair<T> {
  return {
    "0": initial_value,
    "1": initial_value2 || initial_value,
  };
}

function isScrollable(
  widget: Gtk.Widget,
): widget is Gtk.Widget & Gtk.Scrollable {
  return ("hadjustment" in widget) && ("vadjustment" in widget);
}
