/* Partly adapted from: https://gitlab.gnome.org/GNOME/gtk/-/blob/main/gtk/gtkviewport.c#L41

 * GTK - The GIMP Toolkit
 * Copyright (C) 1995-1997 Peter Mattis, Spencer Kimball and Josh MacDonald
 * Copyright (C) 1997-2000 The GTK+ Team
 * Copyright (C) 2024 Angelo Verlain
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see <http://www.gnu.org/licenses/>.
 */

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GLib from "gi://GLib";
import {
  get_opposite_orientation,
  OrientedPair,
  orientedPair,
} from "src/util/orientation";
import { SignalListeners } from "src/util/signal-listener";

export class AnnotatedView extends Gtk.Widget {
  static {
    GObject.registerClass(
      {
        GTypeName: "AnnotatedView",
        Implements: [Gtk.Buildable, Gtk.Scrollable],
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
          spacing: GObject.param_spec_uint(
            "spacing",
            "Spacing",
            "The separation between elements",
            0,
            GLib.MAXUINT32,
            0,
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          ),
        },
      },
      this,
    );
  }

  // property header
  private _header?: Gtk.Widget;
  get header() {
    return this._header;
  }
  set header(widget: Gtk.Widget | undefined) {
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
  get child() {
    return this._child;
  }
  set child(widget: Gtk.Widget | undefined) {
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
  get footer() {
    return this._footer;
  }
  set footer(widget: Gtk.Widget | undefined) {
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

  private adjustment = orientedPair(new Gtk.Adjustment(), new Gtk.Adjustment());
  private adjustment_listeners = orientedPair(
    new SignalListeners(),
    new SignalListeners(),
  );

  private set_adjustment(
    orientation: Gtk.Orientation,
    adjustment?: Gtk.Adjustment,
  ) {
    if (adjustment === this.adjustment[orientation]) return;

    if (!adjustment) {
      adjustment = Gtk.Adjustment.new(0, 0, 0, 0, 0, 0);
    } else {
      adjustment.configure(0, 0, 0, 0, 0, 0);
    }

    this.clear_adjustment(orientation);

    this.adjustment[orientation] = adjustment;

    this.adjustment_listeners[orientation].add(
      adjustment,
      adjustment.connect("value-changed", () => {
        this.queue_allocate();
      }),
    );

    this.queue_allocate();
  }

  private clear_adjustment(orientation: Gtk.Orientation) {
    this.adjustment_listeners[orientation].clear();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.adjustment[orientation] = null!;
  }

  // hadjustment
  get hadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.HORIZONTAL];
  }
  set hadjustment(v: Gtk.Adjustment) {
    this.set_adjustment(Gtk.Orientation.HORIZONTAL, v);
  }

  get vadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.VERTICAL];
  }
  set vadjustment(v: Gtk.Adjustment) {
    this.set_adjustment(Gtk.Orientation.VERTICAL, v);
  }

  // scroll policy

  private scroll_policy = orientedPair(Gtk.ScrollablePolicy.MINIMUM);

  // vscroll-policy
  get vscroll_policy(): Gtk.ScrollablePolicy {
    return this.scroll_policy[Gtk.Orientation.VERTICAL];
  }
  set vscroll_policy(v: Gtk.ScrollablePolicy) {
    if (v === this.vscroll_policy) return;
    this.scroll_policy[Gtk.Orientation.VERTICAL] = v;
    this.queue_resize();
    this.notify("vscroll-policy");
  }

  // hscroll-policy
  get hscoll_policy(): Gtk.ScrollablePolicy {
    return this.scroll_policy[Gtk.Orientation.HORIZONTAL];
  }
  set hscoll_policy(v: Gtk.ScrollablePolicy) {
    if (v === this.hscoll_policy) return;
    this.scroll_policy[Gtk.Orientation.HORIZONTAL] = v;
    this.queue_resize();
    this.notify("hscroll-policy");
  }

  // spacing

  private _spacing = 0;
  get spacing(): number {
    return this._spacing;
  }
  set spacing(v: number) {
    if (v === this.spacing) return;
    this._spacing = v;
    this.queue_resize();
    this.notify("spacing");
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
    if (this._header) this.snapshot_child(this._header, snapshot);
    if (this._child) this.snapshot_child(this._child, snapshot);
    if (this._footer) this.snapshot_child(this._footer, snapshot);
  }

  private set_adjustment_values(
    orientation: Gtk.Orientation,
    viewport_size: number,
    child_size: number,
  ) {
    const adjustment = this.adjustment[orientation];
    const upper = child_size;
    let value = adjustment.value;

    // getting the handler ID registered while setting the adjustment
    const handler =
      this.adjustment_listeners[orientation].listeners.get(adjustment)?.[0];

    if (handler) {
      GObject.signal_handler_block(adjustment, handler);
    }

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

    if (handler) {
      GObject.signal_handler_unblock(adjustment, handler);
    }
  }

  vfunc_size_allocate(width: number, height: number): void {
    const children = [this._header, this._child, this._footer];

    this.adjustment[Gtk.Orientation.VERTICAL].freeze_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].freeze_notify();

    // update adjust values
    const child_adjustment = this.child_adjustment[1];
    child_adjustment.freeze_notify();

    // get the total and each widget's size
    const { totals, sizes } = this.get_widgets_sizes(children, width, height);

    const total_spacing = this.spacing * Math.max(0, sizes.size - 1);

    // update the adjustment to reflect the total widget's sizes
    this.set_adjustment_values(
      Gtk.Orientation.HORIZONTAL,
      width,
      totals[Gtk.Orientation.HORIZONTAL],
    );
    this.set_adjustment_values(
      Gtk.Orientation.VERTICAL,
      height,
      totals[Gtk.Orientation.VERTICAL] + total_spacing,
    );

    const x = this.adjustment[Gtk.Orientation.HORIZONTAL].value;
    let y = this.adjustment[Gtk.Orientation.VERTICAL].value;

    // give each child an allocation
    for (const child of children) {
      if (child && child.visible) {
        const child_size = sizes.get(child);

        if (!child_size) throw new Error("oops...");

        const allocation = new Gdk.Rectangle();

        allocation.width = child_size[Gtk.Orientation.HORIZONTAL];
        allocation.height = child_size[Gtk.Orientation.VERTICAL];
        allocation.x = -x;
        allocation.y = -y;

        let y_offset = 0,
          visible_height = 0;

        // scroll the child widget direct using it's scrollable interface
        if (child === this._child && isScrollable(child)) {
          const widget_height = allocation.height;
          y_offset = Math.max(0, y);

          visible_height = Math.min(
            widget_height,
            height + Math.min(y, 0),
            Math.max(0, widget_height - y),
          );

          allocation.height = visible_height;
          allocation.y += y_offset;

          y -= widget_height;
        } else {
          y -= allocation.height;
        }

        y -= this.spacing;

        if (
          allocation.height + allocation.y < 0 ||
          allocation.y > height ||
          allocation.height <= 0
        ) {
          child.unmap();
        } else {
          child.map();
          child.size_allocate(allocation, -1);

          if (child === this._child && isScrollable(child)) {
            // scroll the scrollable child after allocating
            child_adjustment.value = y_offset;
            child_adjustment.page_size = visible_height;
          }
        }
      }
    }

    child_adjustment.thaw_notify();

    this.adjustment[Gtk.Orientation.VERTICAL].thaw_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].thaw_notify();
  }

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
      const width =
        orientation === Gtk.Orientation.HORIZONTAL
          ? max_width - getTotal(orientation)
          : max_width;
      const height =
        orientation === Gtk.Orientation.VERTICAL
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
      totals = orientedPair(getTotal(Gtk.Orientation.HORIZONTAL), max_height);
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

      const opposite = get_opposite_orientation(orientation);

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

function isScrollable(
  widget: Gtk.Widget,
): widget is Gtk.Widget & Gtk.Scrollable {
  return "hadjustment" in widget && "vadjustment" in widget;
}
