import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { get_option } from "libmuse";

import { error_to_string, ErrorPageOptions } from "./error.js";

export class AuthenticationErrorPage extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "AuthenticationErrorPage",
        Template:
          "resource:///com/vixalien/muzika/ui/pages/authentication-error.ui",
        InternalChildren: ["status", "more", "text_view", "home_button"],
      },
      this,
    );
  }

  _status!: Adw.StatusPage;
  _more!: Gtk.Box;
  _text_view!: Gtk.TextView;
  _home_button!: Gtk.Button;

  buffer: Gtk.TextBuffer;

  constructor(options: ErrorPageOptions = {}) {
    super();

    this._text_view.buffer = this.buffer = new Gtk.TextBuffer();

    this._home_button.connect("clicked", () => {
      get_option("auth").token = null;

      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:home"),
      );

      if (options.error) {
        this.set_error(options.error);
      }
    });
  }

  set_more(show: boolean, label?: string) {
    this._more.visible = show;
    if (label) {
      this.buffer.text = "";
      this.buffer.insert_markup(
        this.buffer.get_start_iter(),
        `<tt>${label.replace(/\n$/, "")}</tt>`,
        -1,
      );
    }
  }

  set_error(error: unknown) {
    if (error instanceof Error) {
      this.set_more(!!error, error_to_string(error));
    } else {
      this.set_more(false);
    }

    if (get_option("auth").has_token()) {
      this._status.set_description(
        _(
          "Your authentication details have expired. Please log in again or go to home.",
        ),
      );
    } else {
      this._status.set_description(
        _("The page you were trying to access requires you to log in."),
      );
    }
  }
}
