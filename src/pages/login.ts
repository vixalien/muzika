import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

/// @ts-expect-error this package has no types
import QRCode from "@lemaik/qrcode-svg";

import { get_option } from "libmuse";
import type { LoginCode, Token } from "libmuse";

export class LoginDialog extends Adw.Dialog {
  static {
    GObject.registerClass(
      {
        GTypeName: "LoginDialog",
        Template: "resource:///com/vixalien/muzika/ui/pages/login.ui",
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
      },
      this,
    );
  }

  _stack!: Gtk.Stack;
  /// @ts-expect-error outdated types
  _spinner!: Adw.Spinner;
  _flow!: Gtk.FlowBox;
  _qr!: Gtk.Picture;
  _link!: Gtk.LinkButton;
  _code!: Gtk.Label;
  _button!: Gtk.Button;
  _toast_overlay!: Adw.ToastOverlay;

  button_handler: number | null = null;

  async show_code(code: LoginCode) {
    this._stack.visible_child = this._flow;

    const qr = new QRCode({
      content: code.verification_url,
      padding: 1,
    });

    const encoder = new TextEncoder();

    const texture = Gdk.Texture.new_from_bytes(encoder.encode(qr.svg()));

    this._qr.set_paintable(texture);

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

      this._toast_overlay.add_toast(Adw.Toast.new(_("Copied to clipboard")));
    });
  }

  private code?: LoginCode;
  private onLogin?: (token: Token) => void;
  private onError?: (error: Error) => void;

  private waiting_controller?: AbortController;

  private async generate_code() {
    this._stack.visible_child = this._spinner;

    const code = await get_option("auth").get_login_code();
    this.code = code;
    this.show_code(code);
  }

  login(signal?: AbortSignal) {
    return new Promise<Token>((resolve, reject) => {
      this.onLogin = resolve;
      this.onError = reject;
      return this.reload_token(signal);
    });
  }

  private async start_waiting_for_token(signal?: AbortSignal) {
    if (!this.code) return;

    const abort_controller = new AbortController();
    signal?.addEventListener("abort", () => {
      abort_controller?.abort();
    });
    this.waiting_controller = abort_controller;

    const token = await get_option("auth")
      .load_token_with_code(this.code, this.waiting_controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }

        this.onError?.(error);
      });

    if (!token) {
      return;
    }

    this.onLogin?.(token);
  }

  private stop_waiting_for_token() {
    this.waiting_controller?.abort();
  }

  private master_signal?: AbortSignal;

  private async reload_token(signal?: AbortSignal) {
    this.stop_waiting_for_token();
    await this.generate_code().catch(this.onError);
    return this.start_waiting_for_token(signal);
  }

  private async refresh_cb() {
    this.reload_token(this.master_signal).catch(this.onError);
  }
}
