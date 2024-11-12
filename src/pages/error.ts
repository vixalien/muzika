import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { escape_label, indent_stack } from "src/util/text";

export function error_to_string(error: Error) {
  let message = `<b>${escape_label(error.name)}: </b>${escape_label(error.message)}\n`;

  if (error.cause) {
    message += `${error.cause}\n`;
  }

  message += `${indent_stack(error.stack ?? "")}`;

  return message;
}

export interface ErrorPageOptions {
  error?: unknown;
}

export class ErrorPage extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "ErrorPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/error.ui",
        InternalChildren: ["status", "more", "text_view"],
      },
      this,
    );
  }

  _status!: Adw.StatusPage;
  _more!: Gtk.Box;
  _text_view!: Gtk.TextView;

  buffer: Gtk.TextBuffer;

  constructor(options: ErrorPageOptions = {}) {
    super();

    this._text_view.buffer = this.buffer = new Gtk.TextBuffer();

    if (options.error) {
      this.set_error(options.error);
    }
  }

  set_message(message: string) {
    this._status.set_description(message);
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
    if (error instanceof GLib.Error) {
      if (
        error instanceof Gio.ResolverError &&
        !Gio.NetworkMonitor.get_default().network_available
      ) {
        this._status.title = _("Connect to the internet");
        this.set_message(
          _("You're offline. Check your connection and try again."),
        );
        this.set_more(!!error, error.toString());
      } else {
        this.set_message(error.message);
        this.set_more(!!error, error.toString());
      }
    } else if (error instanceof Error) {
      this.set_message(`${error.name}: ${error.message}`);
      this.set_more(!!error, error_to_string(error));
    } else {
      this.set_message(error ? _(`Error: ${error}`) : _("Unknown error"));
      this.set_more(false);
    }
  }
}
