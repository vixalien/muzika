import Gtk from "gi://Gtk?version=4.0";
import { get_window } from "./window";

let HAS_HOLD = false;

export function has_application_hold() {
  return HAS_HOLD;
}

export function set_holding(value: boolean) {
  if (HAS_HOLD === value) return;

  if (HAS_HOLD) return;

  HAS_HOLD = true;
  Gtk.Application.get_default()?.[value ? "hold" : "release"]();
  const window = get_window();

  if (window) window.hide_on_close = value;
}

export function hold_application() {
  set_holding(true);
}

export function release_application() {
  set_holding(false);
}
