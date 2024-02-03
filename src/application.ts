import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { Window } from "./window.js";
import { cache } from "./polyfills/fetch.js";
import { AddActionEntries } from "./util/action.js";
import { MuzikaPlayer } from "./player/index.js";
import { MPRIS } from "./mpris.js";
import { get_option } from "src/muse";
import { MuzikaPreferencesWindow } from "./pages/preferences.js";

export const Settings = new Gio.Settings({ schema: pkg.name });

export class Application extends Adw.Application {
  private window?: Window;

  static {
    GObject.registerClass(this);
  }

  private init_actions() {
    (this.add_action_entries as AddActionEntries)([
      {
        name: "quit",
        activate: () => {
          this.quit();
        },
      },
      {
        name: "preferences",
        activate: this.show_preferences.bind(this),
      },
    ]);

    this.set_accels_for_action("app.quit", ["<primary>q"]);
    this.set_accels_for_action("app.preferences", ["<control>comma"]);
    this.set_accels_for_action("win.fullscreen", ["F11"]);
  }

  private preferences_window!: MuzikaPreferencesWindow;

  private show_preferences() {
    if (!this.preferences_window) {
      this.preferences_window = new MuzikaPreferencesWindow();
      this.preferences_window.set_transient_for(this.get_active_window());
    }

    this.preferences_window.present();
  }

  argv: string[] = [];
  player: MuzikaPlayer;
  mpris: MPRIS;

  set_argv(argv: string[]) {
    this.argv = argv;
  }

  constructor(argv: string[]) {
    super({
      application_id: "com.vixalien.muzika",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS |
        Gio.ApplicationFlags.NON_UNIQUE,
    });

    this.set_argv(argv);

    this.init_actions();

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => {
      const aboutDialog = Adw.AboutDialog.new_from_appdata(
        "/com/vixalien/muzika/com.vixalien.muzika.appdata.xml",
        "0.1.0",
      );

      aboutDialog.set_developers([
        "Angelo Verlain <hey@vixalien.com>",
        "Christopher Davis <christopherdavis@gnome.org>",
        "Kian-Meng Ang <kianmeng@cpan.org>",
      ]);
      aboutDialog.set_debug_info(this.get_debug_info());

      aboutDialog.present(this.get_active_window());
    });
    this.add_action(show_about_action);

    GLib.unix_signal_add(
      GLib.PRIORITY_DEFAULT,
      // SIGINT
      2,
      () => {
        this.player.pause();
        this.release();

        return GLib.SOURCE_REMOVE;
      },
    );

    this.player = new MuzikaPlayer({ app: this });

    this.mpris = new MPRIS(this);
  }

  private get_debug_info() {
    return JSON.stringify(
      {
        argv: this.argv,
        version: pkg.version,
        uri: this.window?.navigator.current_uri,
        logged_in: get_option("auth").has_token(),
      },
      null,
      2,
    );
  }

  public vfunc_shutdown(): void {
    cache.flush();
    cache.dump();

    this.player.save_state();
    this.player.unprepare();

    super.vfunc_shutdown();
  }

  public vfunc_activate(): void {
    if (!this.window) {
      this.window = new Window({ application: this });
    }

    this.window.present();
  }
}

export function get_player() {
  return (Gtk.Application.get_default() as Application).player;
}
