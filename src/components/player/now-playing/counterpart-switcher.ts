import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";
import { ObjectContainer } from "src/util/objectcontainer";
import { QueueTrack } from "libmuse";

export class MuzikaNPCounterpartSwitcher extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPCounterpartSwitcher",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/counterpart-switcher.ui",
        InternalChildren: ["toggle_group"],
      },
      this,
    );
  }

  /// @ts-expect-error outdated types
  private _toggle_group: Adw.ToggleGroup;
  private listeners = new SignalListeners();

  vfunc_map(): void {
    super.vfunc_map();

    this.listeners.clear();

    this.listeners.add_bindings(
      get_player().queue.bind_property_full(
        "current-is-video",
        this._toggle_group,
        "active-name",
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
        (_, current_is_video: boolean) => {
          return [true, current_is_video ? "video" : "song"];
        },
        (_, active_name: "song" | "video") => {
          return [true, active_name === "video" ? true : false];
        },
      ),
      // @ts-expect-error invalid types
      get_player().queue.bind_property_full(
        "current",
        this._toggle_group,
        "sensitive",
        GObject.BindingFlags.SYNC_CREATE,
        (_, current: ObjectContainer<QueueTrack>) => {
          return [true, current.object.counterpart != null];
        },
        null,
      ),
    );
  }

  vfunc_unmap(): void {
    super.vfunc_unmap();

    this.listeners.clear();
  }
}
