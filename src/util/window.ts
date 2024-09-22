import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { Application } from "src/application";

export function get_window() {
  // TODO: this will not always be defined
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return (Gtk.Application.get_default() as Application).window!;
}

export function add_toast(toast: string) {
  return get_window().add_toast(toast);
}

export function add_toast_full(toast: Adw.Toast) {
  return get_window().add_toast_full(toast);
}
