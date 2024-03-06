import Gtk from "gi://Gtk?version=4.0";
import { Application } from "src/application";
import { Window } from "src/window";

export function get_window() {
  return (Gtk.Application.get_default() as Application)
    .get_active_window() as Window;
}

export function add_toast(toast: string) {
  return get_window().add_toast(toast);
}
