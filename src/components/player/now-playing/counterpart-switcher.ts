import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class MuzikaNPCounterpartSwitcher extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPCounterpartSwitcher",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/counterpart-switcher.ui",
      },
      this,
    );
  }
}
