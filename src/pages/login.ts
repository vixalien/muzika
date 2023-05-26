import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GdkPixbuf from "gi://GdkPixbuf";

/// @ts-expect-error
import QRCode from "@lemaik/qrcode-svg";

import { get_option } from "../muse.js";
import type { LoginCode } from "libmuse/types/auth.js";

export class LoginPage extends Adw.Window {
  static {
    GObject.registerClass({
      GTypeName: "LoginPage",
      Template: "resource:///com/vixalien/muzika/pages/login.ui",
      InternalChildren: [
        "stack",
        "spinner",
        "flow",
        "qr",
        "link",
        "code",
        "button",
        "toast_overlay",
      ],
    }, this);
  }

  _stack!: Gtk.Stack;
  _spinner!: Gtk.Spinner;
  _flow!: Gtk.FlowBox;
  _qr!: Gtk.Picture;
  _link!: Gtk.LinkButton;
  _code!: Gtk.Label;
  _button!: Gtk.Button;
  _toast_overlay!: Adw.ToastOverlay;

  button_handler: number | null = null;

  async show_code(code: LoginCode) {
    this._stack.visible_child = this._flow;
    this._spinner.stop();

    const loader = GdkPixbuf.PixbufLoader.new();

    const qr = new QRCode({
      content: code.verification_url,
      padding: 1,
    });

    loader.write(qr.svg());
    loader.close();

    this._qr.set_pixbuf(loader.get_pixbuf());

    this._link.uri = code.verification_url;
    this._link.label = code.verification_url;

    this._code.label = code.user_code;

    if (this.button_handler != null) {
      this._button.disconnect(this.button_handler);
    }

    this.button_handler = this._button.connect("clicked", () => {
      // @ts-expect-error value doesn't require a type
      const value = new GObject.Value();
      value.init(GObject.TYPE_STRING);
      value.set_string(code.user_code);

      this.get_clipboard().set(value);

      this._toast_overlay.add_toast(Adw.Toast.new("Copied to clipboard"));
    });
  }

  async auth_flow(signal?: AbortSignal) {
    this._stack.visible_child = this._spinner;
    this._spinner.start();

    const login_code = await get_option("auth").get_login_code();

    this.show_code(login_code);

    await get_option("auth").load_token_with_code(login_code, signal);
  }
}
