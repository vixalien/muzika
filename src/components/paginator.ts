import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

export class Paginator extends Gtk.Revealer {
  static {
    GObject.registerClass(
      {
        GTypeName: "Paginator",
        Template: "resource:///com/vixalien/muzika/ui/components/paginator.ui",
        InternalChildren: ["stack", "button", "spinner"],
        Signals: {
          activate: {},
        },
        Properties: {
          loading: GObject.ParamSpec.boolean(
            "loading",
            "Loading",
            "Whether the button is loading",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          "can-paginate": GObject.ParamSpec.boolean(
            "can-paginate",
            "Can Paginate",
            "Whether the content can be paginated and the paginator is visible",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
      },
      this,
    );
  }

  _stack!: Gtk.Stack;
  _button!: Gtk.Button;
  /// @ts-expect-error outdated types
  _spinner!: Adw.Spinner;

  private _loading = false;

  get loading() {
    return this._loading;
  }

  set loading(value: boolean) {
    this._loading = value;

    if (value) {
      this._stack.visible_child = this._spinner;
    } else {
      this._stack.visible_child = this._button;
    }
  }

  get can_paginate() {
    return this.reveal_child;
  }

  set can_paginate(value: boolean) {
    this.reveal_child = value;
  }

  constructor() {
    super({
      reveal_child: false,
    });
  }

  private on_button_clicked() {
    this.loading = true;
    this.emit("activate");
  }
}
