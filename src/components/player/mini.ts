import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { MuzikaPlayer } from "src/player";
import { SignalListeners } from "src/util/signal-listener.js";
import { get_player } from "src/application.js";
import { bind_play_icon } from "src/player/helpers.js";
import { PlayerProgressBar } from "./progress";
import { pretty_subtitles } from "src/util/text";

GObject.type_ensure(PlayerProgressBar.$gtype);

export class MiniPlayerView extends Gtk.Overlay {
  static {
    GObject.registerClass(
      {
        GTypeName: "MiniPlayerView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/mini.ui",
        InternalChildren: ["title", "subtitle", "play_button"],
      },
      this,
    );
  }

  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _play_button!: Gtk.Button;

  player: MuzikaPlayer;

  constructor() {
    super();

    this.player = get_player();

    // we can't put this in `setup_player` because that method is only ever
    // called on map, and invisible widgets can't be mapped
    // @ts-expect-error incorrect types
    this.player.queue.bind_property_full(
      "current",
      this,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
      (_, from) => {
        return [true, !!from];
      },
      null,
    );
  }

  private listeners = new SignalListeners();

  setup_player() {
    const player = get_player();

    this.listeners.add_bindings(
      bind_play_icon(this._play_button),
      // @ts-expect-error incorrect types
      player.queue.bind_property_full(
        "current",
        this._title,
        "label",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          const track = player.queue.current?.object;
          if (!track) return [false, null];

          return [true, track.title];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.queue.bind_property_full(
        "current",
        this._subtitle,
        "label",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          const track = player.queue.current?.object;
          if (!track) return [false, null];

          return [true, pretty_subtitles(track.artists).plain];
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
