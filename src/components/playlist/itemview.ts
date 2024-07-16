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
    GObject.registerClass(
      {
        GTypeName: "PlaylistItemView",
        Properties: {
          is_album: GObject.ParamSpec.boolean(
            "is-album",
            "Album",
            "Whether this view represents an album",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          is_editable: GObject.param_spec_boolean(
            "is-editable",
            "Is editable",
            "Whether the playlist items can be edited (or deleted)",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          header_factory: GObject.param_spec_object(
            "header_factory",
            "Header factory",
            "The header factory to use for the view",
            Gtk.SignalListItemFactory.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          model: GObject.ParamSpec.object(
            "model",
            "Model",
            "The list model this view is displaying",
            GObject.ParamFlags.READWRITE,
            Gio.ListModel.$gtype,
          ),
          playlist_id: GObject.param_spec_string(
            "playlist-id",
            "Playlist ID",
            "The playlist ID",
            null,
            GObject.ParamFlags.READWRITE,
          ),
          selection_mode: GObject.ParamSpec.boolean(
            "selection-mode",
            "Selection Mode",
            "Whether this view is in selection mode",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          show_add_button: GObject.param_spec_boolean(
            "show-add-button",
            "Show add button",
            "Show a button to trigger the 'Save to playlist' action",
            true,
            GObject.ParamFlags.READWRITE,
          ),
          show_artists: GObject.ParamSpec.boolean(
            "show-artists",
            "Show Artists",
            "Whether to show the artists of each track",
            GObject.ParamFlags.READWRITE,
            true,
          ),
          show_column_view: GObject.ParamSpec.boolean(
            "show-column-view",
            "Show column view",
            "Whether to show the column view instead of the list view",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          show_duration: GObject.ParamSpec.boolean(
            "show-duration",
            "Show duration",
            "Whether to show the duration of each track",
            GObject.ParamFlags.READWRITE,
            true,
          ),
          show_rank: GObject.ParamSpec.boolean(
            "show-rank",
            "Show Rank",
            "Whether to show the rank of the playlist item",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          // scrollable
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
          add: {
            param_types: [GObject.TYPE_OBJECT],
          },
        },
        Implements: [Gtk.Scrollable],
      },
      this,
    );
  }

  // scrollable interface

  // adjustments

  private adjustment = orientedPair(new Gtk.Adjustment(), new Gtk.Adjustment());
  private adjustment_listeners = orientedPair(
    new SignalListeners(),
    new SignalListeners(),
  );
  private child_adjustment = orientedPair(
    new Gtk.Adjustment(),
    new Gtk.Adjustment(),
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
        this.adjustment_changed_cb();
      }),
    );

    this.queue_allocate();
  }

  private adjustment_changed_cb() {
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
  set hadjustment(value: Gtk.Adjustment) {
    this.set_adjustment(Gtk.Orientation.HORIZONTAL, value);
  }

  get vadjustment(): Gtk.Adjustment {
    return this.adjustment[Gtk.Orientation.VERTICAL];
  }
  set vadjustment(value: Gtk.Adjustment) {
    this.set_adjustment(Gtk.Orientation.VERTICAL, value);
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
    return this.show_column_view ? this.columnview : this.listview;
  }

  private get hidden_child(): PlaylistListView | PlaylistColumnView {
    return this.show_column_view ? this.listview : this.columnview;
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

  is_album!: boolean;
  is_editable!: boolean;
  header_factory?: Gtk.SignalListItemFactory;
  playlist_id?: string;
  selection_mode!: boolean;
  show_add_button!: boolean;
  show_artists!: boolean;
  show_duration!: boolean;
  show_rank!: boolean;

  // property: show-column

  get show_column_view() {
    return this.columnview.visible;
  }

  set show_column_view(value: boolean) {
    if (this.show_column_view === value) return;

    this.columnview.visible = value;
    this.listview.visible = !value;

    // this can apparently be set on construct time
    if (!this.adjustment || !this.get_mapped()) return;

    this.notify("show-column-view");
    this.queue_resize();
  }

  constructor(options: Partial<PlaylistItemViewOptions> = {}) {
    super(options);

    // is-album

    this.bind_property(
      "is-album",
      this.listview,
      "is-album",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "is-album",
      this.columnview,
      "is-album",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // is-editable

    this.bind_property(
      "is-editable",
      this.listview,
      "is-editable",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "is-editable",
      this.columnview,
      "is-editable",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // header-factory

    this.bind_property(
      "header-factory",
      this.listview,
      "header-factory",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "header-factory",
      this.columnview,
      "header-factory",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // playlist-id

    this.bind_property(
      "playlist-id",
      this.listview,
      "playlist-id",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "playlist-id",
      this.columnview,
      "playlist-id",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // selection-mode

    this.bind_property(
      "selection-mode",
      this.listview,
      "selection-mode",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "selection-mode",
      this.columnview,
      "selection-mode",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.connect("notify::selection-mode", () => {
      if (this.selection_mode === false) {
        this.model?.unselect_all();
      }
    });

    // show-add-button

    this.bind_property(
      "show_add-button",
      this.listview,
      "show_add-button",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "show_add-button",
      this.columnview,
      "show_add-column",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-artists

    this.bind_property(
      "show-artists",
      this.columnview,
      "show-artists-column",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-duration

    this.bind_property(
      "show-duration",
      this.columnview,
      "show-duration-column",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-rank

    this.bind_property(
      "show-rank",
      this.columnview,
      "show-rank-column",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.listview.set_parent(this);
    this.listview.connect("add", (_list, index) => {
      this.add_cb(index);
    });

    this.columnview.set_parent(this);
    this.columnview.connect("add", (_list, index) => {
      this.add_cb(index);
    });

    this.listview.vadjustment = this.columnview.vadjustment =
      this.child_adjustment[Gtk.Orientation.VERTICAL];
    this.listview.hadjustment = this.columnview.hadjustment =
      this.child_adjustment[Gtk.Orientation.HORIZONTAL];
  }

  private get playable_list() {
    if (!this.model) return null;
    return this.model.model as PlayableList;
  }

  private add_cb(index: number) {
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

    if (this.selection_mode) return;

    this.select_track(
      now_playing
        ? (this.playable_list?.find_by_video_id(now_playing) ?? null)
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
    // if (!this.child.visible) return;

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

    this.adjustment[Gtk.Orientation.VERTICAL].freeze_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].freeze_notify();

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
      y = this.adjustment[Gtk.Orientation.VERTICAL].value;

    const visible_height = Math.min(widget_height, height);

    allocation.width = widget_width;
    allocation.height = visible_height;
    allocation.x = 0;
    allocation.y = 0;

    this.child.size_allocate(allocation, -1);

    child_adjustment.value = y;
    child_adjustment.page_size = visible_height;

    child_adjustment.thaw_notify();

    this.adjustment[Gtk.Orientation.VERTICAL].thaw_notify();
    this.adjustment[Gtk.Orientation.HORIZONTAL].thaw_notify();
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
  show_column_view: boolean;
}
