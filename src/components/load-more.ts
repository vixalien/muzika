import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

export class LoadMore extends Gtk.Revealer {
  static {
    GObject.registerClass({
      GTypeName: "LoadMore",
      Template:
        "resource:///org/example/TypescriptTemplate/components/load-more.ui",
      InternalChildren: [
        "stack",
        "button",
        "spinner",
      ],
      Signals: {
        "activate": {},
      },
      Properties: {
        "loading": GObject.ParamSpec.boolean(
          "loading",
          "Loading",
          "Whether the button is loading",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
    }, this);
  }

  _stack!: Gtk.Stack;
  _button!: Gtk.Button;
  _spinner!: Gtk.Spinner;

  private _loading = false;

  get loading() {
    return this._loading;
  }

  set loading(value: boolean) {
    this._loading = value;

    if (value) {
      this._stack.visible_child = this._spinner;
      this._spinner.start();
    } else {
      this._stack.visible_child = this._button;
      this._spinner.stop();
    }
  }

  constructor() {
    super();

    this._button.connect("clicked", () => {
      this.emit("activate");
    });
  }
}
