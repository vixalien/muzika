import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";
// @ts-expect-error unknown types
import Xdp from "gi://Xdp";
// @ts-expect-error unknown types
import XdpGtk4 from "gi://XdpGtk4";

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

export class MuzikaBackgroundController {
  private portal = new Xdp.Portal();

  request(window: Gtk.Window) {
    const parent = window ? XdpGtk4.parent_new_gtk(window) : null;

    return this.portal
      .request_background(
        parent,
        _("Muzika needs to run in the background to play music"),
        [pkg.name],
        Xdp.BackgroundFlags.NONE,
        null,
      )
      .catch(() => {
        console.error("Permission to run in the background not granted");
      });
  }

  set_status() {
    this.portal.set_background_status(_("Playing in the background"), null);
  }
}
