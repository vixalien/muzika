import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { MuzikaNPCover } from "./cover";
import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";
import { MuzikaNPDetailsSwitcher } from "./switcher";
import { MuzikaNPQueue } from "./details/queue";
import { MuzikaNPRelated } from "./details/related";
import { MuzikaNPLyrics } from "./details/lyrics";
import { MuzikaMaxHeight } from "src/components/maxheight";

GObject.type_ensure(MuzikaNPCover.$gtype);
GObject.type_ensure(MuzikaNPDetailsSwitcher.$gtype);
GObject.type_ensure(MuzikaMaxHeight.$gtype);

GObject.type_ensure(MuzikaNPQueue.$gtype);
GObject.type_ensure(MuzikaNPLyrics.$gtype);
GObject.type_ensure(MuzikaNPRelated.$gtype);

export class MuzikaNPView extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "MuzikaNPView",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/now-playing/view.ui",
      InternalChildren: [
        "multi_layout_view",
        "headerbar",
        "video_counterpart",
        "music_counterpart",
        "lyrics_page",
        "related_page",
        "details_tracker",
        "stack",
      ],
      Properties: {
        "show-mini": GObject.ParamSpec.boolean(
          "show-mini",
          "Show Mini",
          "Show the minimal video player",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
      Implements: [Gtk.Buildable],
    }, this);
  }

  private _multi_layout_view!: Adw.MultiLayoutView;
  private _video_counterpart!: Gtk.ToggleButton;
  private _music_counterpart!: Gtk.ToggleButton;
  private _headerbar!: Adw.HeaderBar;
  private _lyrics_page!: MuzikaNPLyrics;
  private _related_page!: MuzikaNPRelated;
  private _details_tracker!: Adw.Bin;
  private _stack!: Gtk.Stack;

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);

    // @ts-expect-error incorrect types
    this._details_tracker.bind_property_full(
      "active",
      this._stack,
      "visible-child-name",
      GObject.BindingFlags.SYNC_CREATE,
      (_, from) => {
        return [true, from ? "details" : "cover"];
      },
      null,
    );
  }

  get show_mini(): boolean {
    return this._multi_layout_view.layout_name === "mini";
  }

  set show_mini(show: boolean) {
    this._multi_layout_view.layout_name = show ? "mini" : "full";
    this._headerbar.show_end_title_buttons =
      this._headerbar
        .show_start_title_buttons =
        show;
  }

  private listeners = new SignalListeners();

  setup_player() {
    const player = get_player();

    this.listeners.add_bindings(
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._music_counterpart,
        "sensitive",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, !!player.now_playing?.object.track.counterpart];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._video_counterpart,
        "sensitive",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, !!player.now_playing?.object.track.counterpart];
        },
        null,
      ),
      player.queue.bind_property(
        "current-is-video",
        this._music_counterpart,
        "active",
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.INVERT_BOOLEAN,
      ),
      player.queue.bind_property(
        "current-is-video",
        this._video_counterpart,
        "active",
        GObject.BindingFlags.SYNC_CREATE,
      ),
      // @ts-expect-error
      player.bind_property_full(
        "now-playing",
        this._lyrics_page,
        "visible",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [true, player.now_playing?.object?.meta.lyrics != null];
        },
        null,
      ),
      // @ts-expect-error
      player.bind_property_full(
        "now-playing",
        this._related_page,
        "visible",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [true, player.now_playing?.object?.meta.related != null];
        },
        null,
      ),
    );
  }

  private switch_counterpart() {
    get_player().queue.switch_counterpart();
  }

  vfunc_map(): void {
    this.listeners.clear();
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }

  vfunc_add_child(
    builder: Gtk.Builder,
    child: GObject.Object,
    type?: string | null | undefined,
  ): void {
    if (child instanceof Gtk.Widget) {
      return this._multi_layout_view.set_child("child", child);
    }

    // super.vfunc_add_child(builder, child, type);
  }
}
