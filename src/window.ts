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

// make sure to first register PlayerSidebar
PlayerSidebar;

export class Window extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/muzika/window.ui",
        InternalChildren: [
          "navigation_view",
          "toolbar_view",
          "overlay_split_view",
          "toast_overlay",
          "navbar_window",
          "split_view",
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

  private _navigation_view!: Adw.NavigationView;
  private _toolbar_view!: Adw.ToolbarView;
  private _overlay_split_view!: Adw.OverlaySplitView;
  private _toast_overlay!: Adw.ToastOverlay;
  private _navbar_window!: Gtk.ScrolledWindow;
  private _split_view!: Adw.NavigationSplitView;

  navigator: Navigator;
  player_view: PlayerView;
  sidebar: PlayerSidebar;

  mpris: MPRIS;

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    this.navigator = new Navigator(this._navigation_view);

    this._navigation_view.connect("popped", () => {
      this.navigator.back(false);
    });

    this.navigator.navigate(
      "home",
    );

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

    // TODO: fix this
    this._toolbar_view.add_bottom_bar(this.player_view);

    this.sidebar = new PlayerSidebar({
      player: application.player,
    });

    this.player_view.connect("sidebar-button-clicked", (_, view) => {
      this._overlay_split_view.show_sidebar = view !== PlayerSidebarView.NONE;
      if (view !== PlayerSidebarView.NONE) {
        this.sidebar.show_view(view);
      }
    });

    this._overlay_split_view.sidebar = this.sidebar;

    const navbar = new NavbarView(this);
    navbar.connect("activated", () => {
      this._split_view.show_content = true;
    });
    this._navbar_window.set_child(navbar);

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
