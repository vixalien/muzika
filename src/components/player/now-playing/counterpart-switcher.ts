import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";

export class MuzikaNPCounterpartSwitcher extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPCounterpartSwitcher",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/counterpart-switcher.ui",
        InternalChildren: ["music_counterpart", "video_counterpart"],
      },
      this,
    );
  }

  private _video_counterpart!: Gtk.ToggleButton;
  private _music_counterpart!: Gtk.ToggleButton;

  private switch_counterpart_cb() {
    get_player().queue.switch_counterpart();
  }

  private listeners = new SignalListeners();

  vfunc_map() {
    super.vfunc_map();
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
    );
  }

  vfunc_unmap() {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
