import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { Window } from "./window.js";
import { cache } from "./polyfills/fetch.js";
import { Player } from "./player/index.js";

export const Settings = new Gio.Settings({ schema: pkg.name });

export class Application extends Adw.Application {
  private window?: Window;

  static {
    GObject.registerClass(this);
  }

  init_actions() {
    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", () => {
      this.quit();
    });
    this.add_action(quit_action);
    this.set_accels_for_action("app.quit", ["<primary>q"]);
  }

  init_nav_actions() {
    const navigator = this.window?.navigator;

    if (!navigator) {
      return console.error("No navigator, cannot init nav actions");
    }

    const navigate_action = Gio.SimpleAction.new(
      "navigate",
      GLib.VariantType.new("s"),
    );
    navigate_action.connect("activate", (action, param) => {
      if (!param || !window) return;

      const [url] = param.get_string();
      if (url) {
        if (url.startsWith("muzika:")) {
          this.window?.navigator.navigate(url.slice(7));
        }
      }
    });
    this.add_action(navigate_action);

    const back_action = new Gio.SimpleAction({ name: "back", enabled: false });
    back_action.connect("activate", () => {
      this.window?.navigator.back();
    });
    this.add_action(back_action);

    navigator.connect("notify::can-go-back", () => {
      back_action.enabled = navigator.can_go_back;
    });

    const push_state_action = new Gio.SimpleAction({
      name: "push-state",
      parameter_type: GLib.VariantType.new("s"),
    });
    push_state_action.connect("activate", (_, parameter) => {
      if (!parameter) return;

      navigator.pushState({ uri: parameter.get_string()[0] });
    });

    const replace_state_action = new Gio.SimpleAction({
      name: "replace-state",
      parameter_type: GLib.VariantType.new("s"),
    });
    replace_state_action.connect("activate", (_, parameter) => {
      if (!parameter) return;

      navigator.replaceState({ uri: parameter.get_string()[0] });
    });
  }

  argv: string[] = [];
  player: Player;

  set_argv(argv: string[]) {
    this.argv = argv;
  }

  constructor(argv: string[]) {
    super({
      application_id: "com.vixalien.muzika",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    this.set_argv(argv);

    this.init_actions();

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => {
      let aboutParams = {
        transient_for: this.active_window,
        application_name: "Muzika",
        application_icon: "com.vixalien.muzika",
        developer_name: "Angelo Verlain",
        version: "0.1.0",
        developers: [
          "Angelo Verlain <hey@vixalien.com>",
          "Christopher Davis <christopherdavis@gnome.org>",
        ],
        copyright: "© 2023 Angelo Verlain",
      };
      const aboutWindow = new Adw.AboutWindow(aboutParams);
      aboutWindow.present();
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

    this.player = new Player();

    this.player.queue
      .add_songs(["GJnWa0QWUpM", "DPbj1iKH5Yk", "-2yJiningjk"])
      .then(() => {
        console.log("added tracks to queue!");

        this.player.next();
      });
  }

  public vfunc_shutdown(): void {
    cache.flush();
    cache.dump();

    super.vfunc_shutdown();
  }

  public vfunc_activate(): void {
    if (!this.window) {
      this.window = new Window({ application: this });

      this.init_nav_actions();
    }

    this.window.present();
  }
}
