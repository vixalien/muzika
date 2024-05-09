import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

export class Loading extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "Loading",
        Template: "resource:///com/vixalien/muzika/ui/components/loading.ui",
        Properties: {
          loading: GObject.ParamSpec.boolean(
            "loading",
            "Loading",
            "Whether the loading spinner is visible",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
      },
      this,
    );
  }

  private _loading = false;

  get loading() {
    return this._loading;
  }

  set loading(val: boolean) {
    this._loading = val;
    this.set_visible(val);
  }
}
