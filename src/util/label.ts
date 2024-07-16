import Gtk from "gi://Gtk?version=4.0";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { SignalListeners } from "./signal-listener";

export function setup_link_label(
  label: Gtk.Label,
  listeners?: SignalListeners,
) {
  function connect<Signal extends string, Obj extends GObject.Object>(
    widget: Obj,
    signal: Signal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => unknown,
  ) {
    if (listeners) {
      return listeners.connect(widget, signal, fn);
    }

    return widget.connect(signal, fn);
  }

  connect(label, "activate-link", (_: Gtk.Label, uri: string) => {
    if (uri && uri.startsWith("muzika:")) {
      label.activate_action("navigator.visit", GLib.Variant.new_string(uri));

      return true;
    }
  });
}
