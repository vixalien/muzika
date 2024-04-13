import Gtk from "gi://Gtk?version=4.0";

import { get_window } from "./window";

import { Settings } from "src/util/settings.js";

let HAS_HOLD = false;

/**
 * Get whether something has a hold on the application
 */
export function has_application_hold() {
  return HAS_HOLD;
}

/**
 * Add or remove the application hold, if there isn't already one
 */
export function set_holding(value: boolean, bypass = false) {
  if (HAS_HOLD === value) return;

  HAS_HOLD = value;

  if (bypass || Settings.get_boolean("background-play")) {
    _set_background_play(value);
  }
}

/**
 * A certain task has been started. Don't close the application.
 *
 * This is usually when we start playback
 */
export function hold_application() {
  set_holding(true);
}

/**
 * The previous task has finished. The application can be closed safely.
 */
export function release_application() {
  set_holding(false);
}

/**
 * enable/disable background hold
 */
function _set_background_play(value: boolean) {
  Gtk.Application.get_default()?.[value ? "hold" : "release"]();
  const window = get_window();

  if (window) window.hide_on_close = value;
}

/**
 * track changes in the `background-play` key, and enable/disable background
 * playback respectively based on if there's an ongoing task
 */
Settings.connect("changed::background-play", () => {
  const new_value = Settings.get_boolean("background-play");

  if (!HAS_HOLD) return;

  // if there is a hold, this means we need to enable background playback now
  // or disable it accordingly
  _set_background_play(new_value);
});
