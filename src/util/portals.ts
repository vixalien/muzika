import Gio from "gi://Gio";
// @ts-expect-error unknown types
import Xdp from "gi://Xdp";
// @ts-expect-error unknown types
import XdpGtk4 from "gi://XdpGtk4";

import { get_window } from "./window";

Gio._promisify(
  Xdp.Portal.prototype,
  "request_background",
  "request_background_finish",
);

Gio._promisify(
  Xdp.Portal.prototype,
  "set_background_status",
  "set_background_status_finish",
);

const portal = new Xdp.Portal();

export function request_background() {
  const window = get_window();
  const parent = window ? XdpGtk4.parent_new_gtk(window) : null;

  return portal.request_background(
    parent,
    _("Muzika needs to run in the background to play music"),
    [pkg.name],
    Xdp.BackgroundFlags.NONE,
    null,
  ).catch(() => {
    console.error("Permission to run in the background not granted");
  });
}

export function set_background_status() {
  portal.set_background_status(_("Playing in the background"), null);
}
