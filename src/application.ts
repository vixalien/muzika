import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { Window } from "./window.js";
import { cache } from "./polyfills/fetch.js";
import { Player } from "./player/index.js";
import { AddActionEntries } from "./util/action.js";

export const Settings = new Gio.Settings({ schema: pkg.name });

export class Application extends Adw.Application {
  private window?: Window;

  static {
    GObject.registerClass(this);
  }

  init_actions() {
    (this.add_action_entries as AddActionEntries)([
      {
        name: "quit",
        activate: () => {
          this.quit();
        },
      },
    ]);

    this.set_accels_for_action("app.quit", ["<primary>q"]);
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
      .add_songs([
        "DPbj1iKH5Yk",
        "GJnWa0QWUpM",
        "-2yJiningjk",
        "OeY0I9baRvM",
        "9lvYKJYmHsY",
        "t4IEaUhIuCs",
      ])
      .then(() => {
        console.log("added tracks to queue!");

        // this.player.next();
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
    }

    this.window.present();
  }
}
