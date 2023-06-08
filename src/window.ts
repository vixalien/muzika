/* MIT License
 *
 * Copyright (c) 2023 Chris Davis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { Navigator } from "./navigation.js";
import { PlayerView } from "./components/player/view.js";
import { Application } from "./application.js";
import {
  PlayerSidebar,
  PlayerSidebarView,
} from "./components/player/sidebar.js";
import { MPRIS } from "./mpris.js";
import { LoginPage } from "./pages/login.js";
import { AddActionEntries } from "./util/action.js";
import { NavbarView } from "./navbar/index.js";

export class Window extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/muzika/window.ui",
        InternalChildren: [
          "stack",
          "header_bar",
          "progress",
          "back_button",
          "box",
          "sidebar",
          "flap",
          "toast_overlay",
          "navbar",
        ],
        Properties: {
          navigator: GObject.ParamSpec.object(
            "navigator",
            "Navigator",
            "The navigator",
            GObject.ParamFlags.READWRITE,
            Navigator.$gtype,
          ),
        },
      },
      this,
    );
  }

  private _stack!: Gtk.Stack;
  private _header_bar!: Gtk.HeaderBar;
  private _progress!: Gtk.ProgressBar;
  private _back_button!: Gtk.Button;
  private _box!: Gtk.Box;
  private _sidebar!: Gtk.Box;
  private _flap!: Adw.Flap;
  private _toast_overlay!: Adw.ToastOverlay;
  private _navbar!: Gtk.Box;

  navigator: Navigator;
  player_view: PlayerView;
  sidebar: PlayerSidebar;

  interval: number | null = null;

  mpris: MPRIS;

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    this.navigator = new Navigator(this._stack, this._header_bar);

    this.navigator.navigate(
      "home",
    );

    this.navigator.connect("notify::loading", () => {
      if (this.interval) clearInterval(this.interval);

      if (this.navigator.loading) {
        this._progress.pulse();

        this.interval = setInterval(() => {
          this._progress.pulse();
        }, 1000);
      } else {
        this._progress.fraction = 0;
      }
    });

    const application = this.application as Application;

    this.mpris = new MPRIS(application);

    this.insert_action_group("navigator", this.navigator.get_action_group());
    this.insert_action_group("player", application.player.get_action_group());
    this.insert_action_group(
      "queue",
      application.player.queue.get_action_group(),
    );

    this.player_view = new PlayerView({
      player: application.player,
    });

    this._box.append(this.player_view);

    this.sidebar = new PlayerSidebar({
      player: application.player,
    });

    this.player_view.connect("sidebar-button-clicked", (_, view) => {
      this._flap.reveal_flap = view !== PlayerSidebarView.NONE;
      if (view !== PlayerSidebarView.NONE) {
        this.sidebar.show_view(view);
      }
    });

    this._sidebar.append(this.sidebar);

    const navbar = new NavbarView(this);
    this._navbar.append(navbar);

    this.add_actions();
  }

  add_actions() {
    (this.add_action_entries as AddActionEntries)([
      {
        name: "login",
        activate: () => {
          this.auth_flow();
        },
      },
      {
        name: "add-toast",
        parameter_type: "s",
        activate: (_, parameter) => {
          if (!parameter) return;

          this.add_toast(parameter.get_string()[0]);
        },
      },
    ]);
  }

  add_toast(text: string) {
    this._toast_overlay.add_toast(Adw.Toast.new(text));
  }

  auth_flow() {
    const page = new LoginPage();

    page.set_modal(true);
    page.set_transient_for(this);
    page.present();

    const controller = new AbortController();

    page.connect("close-request", () => {
      controller.abort();
    });

    page.auth_flow(controller.signal)
      .then(() => {
        this.add_toast("Successfully logged in!");
        this.navigator.reload();
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        this.add_toast("An error happened while logging in!");

        console.log("an error happened while auth", error);
      })
      .finally(() => {
        page.destroy();
      });
  }
}
