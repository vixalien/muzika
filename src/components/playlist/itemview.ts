import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Gdk from "gi://Gdk?version=4.0";
import GLib from "gi://GLib";

import { PlaylistColumnView } from "./columnview";
import { PlaylistListView } from "./listview";
import { PlayableContainer, PlayableList } from "src/util/playablelist";
import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";
import { get_opposite_orientation, orientedPair } from "src/util/orientation";

export class PlaylistItemView extends Gtk.Widget {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItemView",
      Properties: {
        model: GObject.ParamSpec.object(
          "model",
          "Model",
          "The list model this view is displaying",
          GObject.ParamFlags.READWRITE,
          Gio.ListModel.$gtype,
        ),
        "show-rank": GObject.ParamSpec.boolean(
          "show-rank",
          "Show Rank",
          "Whether to show the rank of the playlist item",
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          false,
        ),
        "show-artists": GObject.ParamSpec.boolean(
          "show-artists",
          "Show Artists",
          "Whether to show the artists of each track",
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          true,
        ),
        "show-time": GObject.ParamSpec.boolean(
          "show-time",
          "Show Time",
          "Whether to show the duration of each track",
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          true,
        ),
        "show-column": GObject.ParamSpec.boolean(
          "show-column",
          "Show Column",
          "Whether to show the column view",
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          false,
        ),
        album: GObject.ParamSpec.boolean(
          "album",
          "Album",
          "Whether this view is displaying an album",
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          false,
        ),
        "selection-mode": GObject.ParamSpec.boolean(
          "selection-mode",
          "Selection Mode",
          "Whether this view is in selection mode",
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
          false,
        ),
        "show-add": GObject.param_spec_boolean(
          "show-add",
          "Show Add",
          "Show Add button",
          true,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
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
      Signals: {
        "add": {
          param_types: [GObject.TYPE_OBJECT],
        },
      },
      Implements: [
        Gtk.Scrollable,
      ],
    }, this);
  }

  // adjustments

  private adjustment = orientedPair(new Gtk.Adjustment(), new Gtk.Adjustment());
  private child_adjustment = orientedPair(
    new Gtk.Adjustment(),
    new Gtk.Adjustment(),
  );

  // hadjustment
  get hadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.HORIZONTAL];
  }
  set hadjustment(value: Gtk.Adjustment) {
    if (!value) return;
    this.adjustment[Gtk.Orientation.HORIZONTAL] = value;
    value.connect("value-changed", () => this.queue_allocate());
    this.queue_allocate();
    this.notify("hadjustment");
  }

  get vadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.VERTICAL];
  }
  set vadjustment(value: Gtk.Adjustment) {
    if (!value) return;
    this.adjustment[Gtk.Orientation.VERTICAL] = value;
    value.connect("value-changed", () => this.queue_allocate());
    this.notify("vadjustment");
    this.queue_allocate();
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

  public get child(): PlaylistListView | PlaylistColumnView {
    return this.show_column ? this.columnview : this.listview;
  }

  private get hidden_child(): PlaylistListView | PlaylistColumnView {
    return this.show_column ? this.listview : this.columnview;
  }

  private listview = new PlaylistListView({ visible: true });
  private columnview = new PlaylistColumnView({ visible: false });

  // private get_current_child() {
  //   return this.child as CurrentChild;
  // }

  // private get_current_property<Key extends keyof CurrentChild>(property: Key) {
  //   return this.get_current_child()[property];
  // }

  // private set_current_property<Key extends keyof CurrentChild>(
  //   property: Key,
  //   value: CurrentChild[Key],
  // ) {
  //   return this.get_current_child()[property] = value;
  // }

  // property: selection-mode
  get selection_mode() {
    return this.listview.selection_mode;
  }

  set selection_mode(value: boolean) {
    if (this.selection_mode === value) return;

    this.listview.selection_mode = this.columnview.selection_mode = value;

    if (value == false) {
      this.model?.unselect_all();
    }

    this.notify("selection-mode");
  }

  // property: playlistId

  get playlistId() {
    return this.listview.playlistId;
  }

  set playlistId(value: string | undefined) {
    if (this.playlistId === value) return;

    this.listview.playlistId = this.columnview.playlistId = value;
  }

  // property: album
  get album() {
    return this.listview.album;
  }

  set album(value: boolean) {
    if (this.album === value) return;

    this.listview.album = this.columnview.album = value;
  }

  // property: model

  get model() {
    return this.listview.model as Gtk.MultiSelection | null;
  }

  set model(value: Gtk.MultiSelection | null) {
    if (!value || this.model === value) return;

    this.clear_listeners();

    this.listview.model = this.columnview.model = value;

    this.notify("model");

    this.setup_listeners();
  }

  get playable_list() {
    if (!this.model) return null;
    return this.model.model as PlayableList;
  }

  // property: show-rank
  get show_rank() {
    return this.columnview.show_rank;
  }

  set show_rank(value: boolean) {
    if (value === this.show_rank) return;

    this.columnview.show_rank = value;

    this.notify("show-rank");
  }

  // property: show-artists
  get show_artists() {
    return this.columnview.show_artists;
  }

  set show_artists(value: boolean) {
    if (value === this.show_artists) return;

    this.columnview.show_artists = value;

    this.notify("show-artists");
  }

  // property: show-time
  get show_time() {
    return this.columnview.show_time;
  }
  set show_time(value: boolean) {
    if (value === this.show_time) return;

    this.columnview.show_time = value;

    this.notify("show-time");
  }

  // property: show-column

  private _show_column = false;
  get show_column() {
    return this._show_column;
  }
  set show_column(value: boolean) {
    if (this.show_column === value) return;

    this._show_column = value;

    this.child.visible = true;
    this.hidden_child.visible = false;

    // this can apparently be set on construct time
    if (!this.adjustment || !this.get_mapped()) return;

    this.notify("show-column");
    this.queue_resize();
  }

  // property: editable
  get editable() {
    return this.listview.editable;
  }
  set editable(value: boolean) {
    if (this.editable === value) return;

    this.listview.editable = this.columnview.editable = value;

    this.notify("editable");
  }

  // property: show-add
  get show_add() {
    return this.listview.show_add;
  }
  set show_add(value: boolean) {
    if (this.show_add === value) return;

    this.listview.show_add = this.columnview.show_add = value;

    this.notify("show-add");
  }

  // property: header-factory
  get header_factory() {
    return this.listview.header_factory;
  }
  set header_factory(value: Gtk.ListItemFactory | null) {
    if (this.header_factory === value) return;

    this.listview.header_factory = this.columnview.header_factory = value!;

    // TODO: this should be a property
    // this.notify("header-factory");
  }

  constructor(options: Partial<PlaylistItemViewOptions> = {}) {
    super();

    if (options.model) this.model = options.model;

    this.listview.set_parent(this);
    this.listview.connect("add", (_list, index) => {
      this.add_cb(index);
    });

    this.columnview.set_parent(this);
    this.columnview.connect("add", (_list, index) => {
      this.add_cb(index);
    });

    this.listview.vadjustment = this.columnview.vadjustment = this
      .child_adjustment[Gtk.Orientation.VERTICAL];
    this.listview.hadjustment = this.columnview.hadjustment = this
      .child_adjustment[Gtk.Orientation.HORIZONTAL];
  }

  add_cb(index: number) {
    const item = this.model?.get_item(index);

    if (!item || !this.model || !this.playable_list) return;

    this.playable_list.remove(index);

    this.emit("add", item);
  }

  select_track(index: number | null) {
    if (index == null) {
      return;
    }

    if (index < 0) {
      this.model?.unselect_all();
      return;
    }

    const container = this.model?.get_item(index);

    if (!container || !this.model) return;

    if (this.selection_mode || this.model.get_selection().get_size() > 1) {
      return;
    }

    this.model.select_item(index, true);
  }

  /**
   * Select the currently playing track, if it's in this list and there are no
   * tracks already selected
   */
  private update_current_playing() {
    const player = get_player();

    const now_playing = player.queue.current?.object.videoId;

    this.select_track(
      now_playing
        ? this.playable_list?.find_by_video_id(now_playing) ?? null
        : null,
    );
  }

  private signals = new SignalListeners();

  private setup_listeners() {
    this.clear_listeners();

    const model = this.model?.model;

    if (!(model instanceof PlayableList)) return;

    model.setup_listeners();

    const player = get_player();

    this.signals.add(
      player.queue,
      player.queue.connect("notify::current", () => {
        this.update_current_playing();
      }),
    );

    this.update_current_playing();
  }

  private clear_listeners() {
    this.playable_list?.clear_listeners();
    this.signals.clear();
  }

  vfunc_map(): void {
    this.setup_listeners();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.clear_listeners();
    super.vfunc_unmap();
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
    // if (!this.child.visible) return;

    this.adjustment[Gtk.Orientation.VERTICAL].freeze_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].freeze_notify();

    const child_adjustment = this.child_adjustment[Gtk.Orientation.VERTICAL];

    child_adjustment.freeze_notify();

    const orientation =
      this.get_request_mode() === Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH
        ? Gtk.Orientation.HORIZONTAL
        : Gtk.Orientation.VERTICAL;
    const opposite = get_opposite_orientation(orientation);

    const child_size = orientedPair(width, height);

    let min, nat;

    [min, nat] = this.child.measure(orientation, -1);

    if (this.scroll_policy[orientation] === Gtk.ScrollablePolicy.MINIMUM) {
      child_size[orientation] = Math.max(child_size[orientation], min);
    } else {
      child_size[orientation] = Math.max(child_size[orientation], nat);
    }

    [min, nat] = this.child.measure(opposite, child_size[orientation]);

    if (this.scroll_policy[opposite] === Gtk.ScrollablePolicy.MINIMUM) {
      child_size[opposite] = Math.max(child_size[opposite], min);
    } else {
      child_size[opposite] = Math.max(child_size[opposite], nat);
    }

    // update the adjustment to reflect the total widget's sizes
    this.set_adjustment_values(
      Gtk.Orientation.HORIZONTAL,
      width,
      child_size[Gtk.Orientation.HORIZONTAL],
    );
    this.set_adjustment_values(
      Gtk.Orientation.VERTICAL,
      height,
      child_size[Gtk.Orientation.VERTICAL],
    );

    const allocation = new Gdk.Rectangle();

    const widget_height = child_size[Gtk.Orientation.VERTICAL],
      widget_width = child_size[Gtk.Orientation.HORIZONTAL],
      x = this.adjustment[Gtk.Orientation.HORIZONTAL].value,
      y = this.adjustment[Gtk.Orientation.VERTICAL].value;

    const visible_height = Math.min(
      widget_height,
      height,
    );

    child_adjustment.value = y;
    child_adjustment.page_size = visible_height;

    allocation.width = widget_width;
    allocation.height = visible_height;
    allocation.x = -x;
    allocation.y = 0;

    this.child.size_allocate(allocation, -1);

    child_adjustment.thaw_notify();

    this.adjustment[Gtk.Orientation.VERTICAL].thaw_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].thaw_notify();

    // setTimeout(() => {
    // this.child.visible = true;
    // this.hidden_child.visible = false;
    // }, 1000);
  }

  vfunc_snapshot(snapshot: Gtk.Snapshot): void {
    this.snapshot_child(this.child, snapshot);
  }

  vfunc_get_request_mode(): Gtk.SizeRequestMode {
    return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
  }

  vfunc_measure(
    orientation: Gtk.Orientation,
    for_size: number,
  ): [number, number, number, number] {
    return this.child.measure(orientation, for_size);
  }
}

export interface PlaylistItemViewOptions {
  model: Gtk.MultiSelection<PlayableContainer>;
  show_column: boolean;
}
