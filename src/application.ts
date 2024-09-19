import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import GLibUnix from "gi://GLibUnix";
import Gtk from "gi://Gtk?version=4.0";

import "src/muse.js";
import { get_option } from "libmuse";

import { Window } from "./window.js";
import { cache } from "./polyfills/fetch.js";
import { AddActionEntries } from "./util/action.js";
import { MuzikaPlayer } from "./player/index.js";
import { MPRIS } from "./mpris.js";
import { MuzikaPreferencesDialog } from "./pages/preferences.js";
import { get_language_string, set_muse_lang } from "./util/language.js";

export class Application extends Adw.Application {
  window?: Window;

  static {
    GObject.registerClass(
      {
        Properties: {
          player: GObject.param_spec_object(
            "player",
            "Player",
            "The Muzika player",
            MuzikaPlayer.$gtype,
            GObject.ParamFlags.READABLE,
          ),
        },
      },
      this,
    );
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
      {
        name: "about",
        activate: this.show_about_dialog_cb.bind(this),
      },
    ]);

    this.set_accels_for_action("app.quit", ["<primary>q"]);
    this.set_accels_for_action("app.preferences", ["<control>comma"]);
    this.set_accels_for_action("win.fullscreen", ["F11"]);
  }

  private preferences_dialog!: MuzikaPreferencesDialog;

  private show_preferences() {
    if (!this.preferences_dialog) {
      this.preferences_dialog = new MuzikaPreferencesDialog();
    }

    this.preferences_dialog.present(this.get_active_window());
  }

  argv: string[] = [];
  mpris: MPRIS;

  set_argv(argv: string[]) {
    this.argv = argv;
  }

  private _player = new MuzikaPlayer({ app: this });

  get player() {
    return this._player;
  }

  constructor(argv: string[]) {
    super({
      application_id: pkg.name,
      resource_base_path: "/com/vixalien/muzika/",
      flags: Gio.ApplicationFlags.FLAGS_NONE,
    });

    this.set_argv(argv);

    set_muse_lang();

    this.init_actions();

    GLibUnix.signal_add_full(
      GLib.PRIORITY_DEFAULT,
      // SIGINT
      2,
      () => {
        this.player.pause();
        this.release();

        return GLib.SOURCE_REMOVE;
      },
    );

    this.mpris = new MPRIS(this);
  }

  private get_debug_info() {
    return JSON.stringify(
      {
        argv: this.argv,
        version: pkg.version,
        uri: this.window?.navigator.current_uri,
        logged_in: get_option("auth").has_token(),
        language: get_language_string(get_option("language")),
      },
      null,
      2,
    );
  }

  private show_about_dialog_cb() {
    const aboutDialog = Adw.AboutDialog.new_from_appdata(
      `/com/vixalien/muzika/${pkg.name}.metainfo.xml`,
      // so that looking up versions with commit IDs doesn't fail
      pkg.version.split("-")[0],
    );

    aboutDialog.set_version(pkg.version);

    aboutDialog.set_developers([
      "Angelo Verlain <hey@vixalien.com>",
      "Christopher Davis <christopherdavis@gnome.org>",
      "Kian-Meng Ang <kianmeng@cpan.org>",
    ]);
    aboutDialog.set_debug_info(this.get_debug_info());

    aboutDialog.present(this.get_active_window());
  }

  public vfunc_shutdown(): void {
    cache.flush();
    cache.dump();

    this.player.save_state_settings();
    this.player.unprepare();

    super.vfunc_shutdown();
  }

  public vfunc_activate(): void {
    super.vfunc_activate();

    this.present_main_window();
  }

  private present_main_window() {
    if (!this.window) {
      this.window = new Window({ application: this });
      if (pkg.name.endsWith("Devel")) this.window.add_css_class("devel");
    }

    this.window.present();
    this.window.request_background();
  }
}

export function get_player() {
  return (Gtk.Application.get_default() as Application).player;
}
