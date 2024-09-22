import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_player } from "src/application";

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
  private _binding: GObject.Binding | null = null;

  vfunc_map(): void {
    super.vfunc_map();

    this._binding?.unbind();

    this._binding = get_player().queue.bind_property_full(
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
    );
  }

  vfunc_unmap(): void {
    super.vfunc_unmap();

    this._binding?.unbind();
    this._binding = null;
  }
}
