import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

/**
 * Allows Muzika to request the session to not suspend
 */
export class MuzikaInhibitController extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaInhibitController",
        Properties: {
          active: GObject.param_spec_boolean(
            "active",
            "Active",
            "Whether the app has inhibitted suspend",
            false,
            GObject.ParamFlags.READABLE,
          ),
        },
      },
      this,
    );
  }

  private cookie: number | null = null;

  get active() {
    return this.cookie !== null;
  }

  set active(value) {
    if (this.active === value) return;

    if (value) {
      this.inhibit();
    } else {
      this.uninhibit();
    }
  }

  private last_was_video = false;

  inhibit(video = false) {
    if (this.active === true) {
      // only re-inhibit if we are now inhibiting video
      if (this.last_was_video !== video) this.uninhibit();
      else return;
    }

    const app = Gtk.Application.get_default() as Gtk.Application;
    if (!app) return;

    let reason: string, flags: Gtk.ApplicationInhibitFlags;

    if (video) {
      reason = _("Muzika is playing video");
      flags =
        Gtk.ApplicationInhibitFlags.SUSPEND | Gtk.ApplicationInhibitFlags.IDLE;
    } else {
      reason = _("Muzika is playing music");
      flags = Gtk.ApplicationInhibitFlags.SUSPEND;
    }

    this.cookie = app.inhibit(app.get_active_window(), flags, reason);

    this.last_was_video = video;
    this.notify("active");
  }

  uninhibit() {
    const app = Gtk.Application.get_default() as Gtk.Application;

    if (!this.cookie || !app) return;

    app.uninhibit(this.cookie);
    this.cookie = null;

    this.notify("active");
  }
}
