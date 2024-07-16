import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";

import { MuzikaNPQueue } from "src/components/player/now-playing/details/queue";
import { MuzikaNPRelated } from "src/components/player/now-playing/details/related";
import { MuzikaNPLyrics } from "src/components/player/now-playing/details/lyrics";
import { MuzikaNPSheet } from "src/components/player/now-playing/sheet";
import { MuzikaPanes } from "./panes";

GObject.type_ensure(MuzikaNPSheet.$gtype);
GObject.type_ensure(MuzikaPanes.$gtype);

GObject.type_ensure(MuzikaNPQueue.$gtype);
GObject.type_ensure(MuzikaNPLyrics.$gtype);
GObject.type_ensure(MuzikaNPRelated.$gtype);

export class MuzikaShell extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaShell",
        Template: "resource:///com/vixalien/muzika/ui/layout/shell.ui",
        InternalChildren: ["multi_layout_view", "lyrics_page", "related_page"],
        Properties: {
          "show-mini": GObject.ParamSpec.boolean(
            "show-mini",
            "Show Mini",
            "Show the minimal video player",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          bottom_bar_height: GObject.ParamSpec.uint(
            "bottom-bar-height",
            "Bottom Bar Height",
            "The height of the video player controls",
            GObject.ParamFlags.READWRITE,
            0,
            GLib.MAXUINT32,
            0,
          ),
        },
        Implements: [Gtk.Buildable],
      },
      this,
    );
  }

  private _multi_layout_view!: Adw.MultiLayoutView;
  private _lyrics_page!: MuzikaNPLyrics;
  private _related_page!: MuzikaNPRelated;

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }

  private listeners = new SignalListeners();

  setup_player() {
    const player = get_player();

    this.listeners.add_bindings(
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._lyrics_page,
        "visible",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, player.now_playing?.object?.meta.lyrics != null];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._related_page,
        "visible",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, player.now_playing?.object?.meta.related != null];
        },
        null,
      ),
    );
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
    // this._multi_layout_view is only set after initializing
    if (this._multi_layout_view && child instanceof Gtk.Widget) {
      return this._multi_layout_view.set_child("content", child);
    }

    super.vfunc_add_child(builder, child, type);
  }

  private calculate_bottom_bar_height(
    _: this,
    layout: "mobile" | "desktop",
    mobile_bottom_bar_height: number,
    desktop_bottom_bar_height: number,
  ) {
    return layout === "mobile"
      ? mobile_bottom_bar_height
      : desktop_bottom_bar_height;
  }
}
