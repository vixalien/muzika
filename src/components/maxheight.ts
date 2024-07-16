import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

export class MuzikaMaxHeight extends Gtk.Widget {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaMaxHeight",
        Properties: {
          child: GObject.param_spec_object(
            "child",
            "Child",
            "The displayed child",
            Gtk.Widget.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Implements: [Gtk.Buildable],
      },
      this,
    );
  }

  private _child?: Gtk.Widget;

  get child() {
    return this._child;
  }

  set child(value: Gtk.Widget | undefined) {
    if (this.child) this.child.unparent();

    if (!value) return;

    this._child = value;
    value.set_parent(this);
    this.queue_resize();
  }

  vfunc_size_allocate(width: number, height: number, baseline: number): void {
    if (!this.child) return;

    this.child.allocate(width, height, baseline, null);
  }

  vfunc_measure(
    orientation: Gtk.Orientation,
    for_size: number,
  ): [number, number, number, number] {
    if (!this.child) return super.vfunc_measure(orientation, for_size);

    const measured = this.child.vfunc_measure(orientation, for_size);

    if (orientation === Gtk.Orientation.VERTICAL) {
      measured[1] = 9999;
    }

    return [measured[0], measured[1], -1, -1];
  }

  vfunc_snapshot(snapshot: Gtk.Snapshot): void {
    if (!this.child) return;

    this.snapshot_child(this.child, snapshot);
  }

  vfunc_add_child(
    builder: Gtk.Builder,
    child: GObject.Object,
    type?: string | null | undefined,
  ): void {
    if (child instanceof Gtk.Widget) {
      this.child = child;
      return;
    }

    super.vfunc_add_child(builder, child, type);
  }

  vfunc_get_request_mode() {
    return Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT;
  }
}
