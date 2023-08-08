import Gtk from "gi://Gtk?version=4.0";
import GLib from "gi://GLib";

export function set_scrolled_window_initial_vscroll(
  scrolled_window: Gtk.ScrolledWindow,
  vscroll: number,
) {
  if (vscroll === 0) {
    return;
  }

  let signal_id: number | null = scrolled_window.vadjustment.connect(
    "notify::upper",
    () => {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        scrolled_window.vadjustment.value = vscroll;

        if (signal_id !== null) {
          scrolled_window.vadjustment.disconnect(signal_id);
          signal_id = null;
        }

        return GLib.SOURCE_REMOVE;
      });
    },
  );
}

export interface VScrollState {
  vscroll: number;
}
