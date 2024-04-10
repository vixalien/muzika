import Gtk from "gi://Gtk?version=4.0";

import { Application } from "src/application";

export function get_window() {
  // TODO: this will not always be defined
  return (Gtk.Application.get_default() as Application)
    .window!;
}

export function add_toast(toast: string) {
  return get_window().add_toast(toast);
}
