import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gst from "gi://Gst";

import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";

export class PlayerScale extends Gtk.Scale {
  static {
    GObject.registerClass(
      {
        GTypeName: "PlayerScale",
        Properties: {
          buffering: GObject.ParamSpec.boolean(
            "buffering",
            "Buffering",
            "Whether the player is buffering",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
        Signals: {
          // this signal is deprecated
          "user-changed-value": {
            param_types: [GObject.TYPE_DOUBLE],
          },
        },
      },
      this,
    );
  }

  constructor() {
    super({
      hexpand: true,
      valign: Gtk.Align.CENTER,
      draw_value: false,
      adjustment: Gtk.Adjustment.new(
        0,
        0,
        100 * Gst.SECOND,
        Gst.MSECOND,
        10 * Gst.MSECOND,
        2,
      ),
    });

    this.connect("change-value", (_, _scroll, value: number) => {
      get_player().seek(value);
    });

    this.connect("value-changed", () => {
      this.emit("user-changed-value", this.adjustment.value);
    });
  }

  private _buffering = false;

  get buffering() {
    return this._buffering;
  }

  set buffering(value: boolean) {
    if (value === this.buffering) return;

    this._buffering = value;
    this.notify("buffering");
    const already_buffering = this.has_css_class("buffering");

    if (value) {
      if (!already_buffering) this.add_css_class("buffering");
    } else if (already_buffering) {
      this.remove_css_class("buffering");
    }
  }

  private listeners = new SignalListeners();

  private setup_player() {
    const player = get_player();

    this.listeners.add_bindings(
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "duration",
        this.adjustment,
        "upper",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          // the `|| 10` is to prevent the scale being invisible when the upper
          // adjustment value is set to 0
          return [true, player.duration || 10];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "timestamp",
        this.adjustment,
        "value",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, timestamp) => {
          if ((this.get_state_flags() & Gtk.StateFlags.ACTIVE) != 0) {
            return [false];
          }
          return [true, player.initial_seek_to ?? timestamp];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "is-buffering",
        this,
        "buffering",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, player.is_buffering && player.playing];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "playing",
        this,
        "buffering",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, player.playing && player.is_buffering];
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
}
