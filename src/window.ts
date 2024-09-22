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
import Gdk from "gi://Gdk?version=4.0";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { edit_song_library_status, get_option, rate_playlist } from "libmuse";
import type { LikeStatus } from "libmuse";

import { Navigator } from "./navigation.js";
import { get_player } from "./application.js";
import { Settings } from "./util/settings.js";
import { LoginDialog } from "./pages/login.js";
import { AddActionEntries } from "./util/action.js";
import { PlayerView } from "./components/player/view.js";
import { VideoPlayerView } from "./components/player/video/view.js";
import { SaveToPlaylistDialog } from "./components/playlist/save-to-playlist.js";
import { MuzikaShell } from "./layout/shell.js";
import { WindowSidebar } from "./layout/sidebar.js";
import { MuzikaBackgroundController } from "./util/controllers/background.js";
import { change_song_rating } from "./util/menu/like.js";

GObject.type_ensure(MuzikaShell.$gtype);
GObject.type_ensure(PlayerView.$gtype);
GObject.type_ensure(WindowSidebar.$gtype);
GObject.type_ensure(VideoPlayerView.$gtype);

Gio._promisify(Adw.AlertDialog.prototype, "choose", "choose_finish");

export class Window extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaWindow",
        Template: "resource:///com/vixalien/muzika/ui/window.ui",
        InternalChildren: [
          "navigation_view",
          "main_stack",
          "video_player_view",
        ],
        Children: ["toast_overlay"],
        Properties: {
          navigator: GObject.ParamSpec.object(
            "navigator",
            "Navigator",
            "The navigator",
            GObject.ParamFlags.READWRITE,
            Navigator.$gtype,
          ),
          bottom_bar_height: GObject.ParamSpec.uint(
            "bottom-bar-height",
            "Bottom Bar Height",
            "The height of the video player controls",
            GObject.ParamFlags.READWRITE,
            0,
            GLib.MAXUINT32,
            0,
          ),
        },
      },
      this,
    );
  }

  private _navigation_view!: Adw.NavigationView;
  private _main_stack!: Gtk.Stack;
  private toast_css_provider: Gtk.CssProvider;

  private background_controller = new MuzikaBackgroundController();

  navigator: Navigator;
  toast_overlay!: Adw.ToastOverlay;

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    this.toast_css_provider = new Gtk.CssProvider();

    const default_provider = Gdk.Display.get_default();
    if (default_provider) {
      Gtk.StyleContext.add_provider_for_display(
        default_provider,
        this.toast_css_provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
      );
    }

    Settings.bind(
      "width",
      this,
      "default-width",
      Gio.SettingsBindFlags.DEFAULT,
    );
    Settings.bind(
      "height",
      this,
      "default-height",
      Gio.SettingsBindFlags.DEFAULT,
    );
    Settings.bind(
      "is-maximized",
      this,
      "maximized",
      Gio.SettingsBindFlags.DEFAULT,
    );
    Settings.bind(
      "is-fullscreen",
      this,
      "fullscreened",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this.navigator = new Navigator(this._navigation_view);

    this.navigator.navigate("home");

    this.navigator.connect("navigate", () => {
      this.show_view("main");
    });

    const player = get_player();

    this.insert_action_group("navigator", this.navigator.get_action_group());
    this.insert_action_group("player", player.get_action_group());
    this.insert_action_group("queue", player.queue.action_group);

    this.add_actions();

    // Hide the window when we have an application hold
    player.hold_controller.bind_property(
      "active",
      this,
      "hide-on-close",
      GObject.BindingFlags.SYNC_CREATE,
    );
  }

  request_background() {
    this.background_controller.request(this);
    this.background_controller.set_status();
  }

  add_actions() {
    (this.add_action_entries as AddActionEntries)([
      {
        name: "add-toast",
        parameter_type: "s",
        activate: (_, parameter) => {
          if (!parameter) return;

          this.add_toast(parameter.get_string()[0]);
        },
      },
      {
        name: "copy-url",
        parameter_type: "s",
        activate: (__, parameter) => {
          if (!parameter) return;

          // @ts-expect-error value doesn't require a type
          const value = new GObject.Value();
          value.init(GObject.TYPE_STRING);
          value.set_string(parameter.get_string()[0]);

          this.get_clipboard().set(value);

          this.add_toast(_("Copied URL to clipboard"));
        },
      },
      {
        name: "fullscreen",
        activate: () => {
          this.toggle_fullscreen_video();
        },
      },
      {
        name: "add-to-playlist",
        parameter_type: "s",
        activate: (_, parameter) => {
          if (!parameter) return;

          SaveToPlaylistDialog.new_videos(parameter.get_string()[0].split(","));
        },
      },
      {
        name: "add-playlist-to-playlist",
        parameter_type: "s",
        activate: (_, parameter) => {
          if (!parameter) return;

          SaveToPlaylistDialog.new_playlist(
            parameter.get_string()[0].split(",")[0],
          );
        },
      },
      {
        name: "rate-song",
        parameter_type: "(sss)",
        activate: (_, parameter) => {
          if (!parameter) return;

          const [videoId, status, oldStatus] = parameter.deep_unpack() as [
            string,
            string,
            string,
          ];

          if (!videoId || !status) return;

          this.rate_song(
            videoId,
            status as LikeStatus,
            (oldStatus as LikeStatus) || undefined,
          );
        },
      },

      {
        name: "rate-playlist",
        parameter_type: "(ssb)",
        activate: (_, parameter) => {
          if (!parameter) return;

          const [videoId, status, album] = parameter.deep_unpack() as [
            string,
            string,
            boolean,
          ];

          if (!videoId || !status) return;

          this.rate_playlist(videoId, status as LikeStatus, album);
        },
      },
      {
        name: "login",
        activate: () => {
          return this.auth_flow();
        },
      },
      {
        name: "logout",
        activate: () => {
          return this.logout();
        },
      },
      {
        name: "visible-view",
        parameter_type: "s",
        state: '"main"',
        change_state: (action, param) => {
          const string = param?.get_string()[0];
          if (string && this.show_view(string)) {
            action.set_state(GLib.Variant.new_string(string));
          }
        },
      },
      {
        name: "now-playing",
        state: "false",
        change_state: (action, param) => {
          if (!param) return;
          if (param.get_boolean()) {
            this.show_view("now-playing");
          } else {
            this.show_view("main");
          }
          action.set_state(param);
        },
        activate(action) {
          const value = action.get_state()?.get_boolean() ?? false;
          action.set_state(GLib.Variant.new_boolean(value));
        },
      },
      {
        name: "now-playing-details",
        state: "false",
        change_state: (action, param) => {
          if (param) action.set_state(param);
        },
        activate(action) {
          const value = action.get_state()?.get_boolean() ?? false;
          action.set_state(GLib.Variant.new_boolean(value));
        },
      },
      {
        name: "edit-library",
        parameter_type: "(ss)",
        activate: (_, parameter) => {
          if (!parameter) return;

          const [action, token] = parameter.deep_unpack() as [
            "add" | "remove",
            string,
          ];

          this.edit_library(action, token);
        },
      },
    ]);

    get_option("auth").addEventListener("token-changed", () => {
      this.update_auth_actions();
      // this._sidebar.token_changed();
    });

    this.update_auth_actions();

    this._main_stack.connect("notify::visible-child", () => {
      const visible_child = this._main_stack.get_visible_child_name();

      if (
        visible_child &&
        visible_child != this.get_action_state("visible-child")?.get_string()[0]
      ) {
        this.change_action_state(
          "visible-view",
          GLib.Variant.new_string(visible_child),
        );
      }
    });
  }

  private update_auth_actions() {
    this.action_enabled_changed("login", !get_option("auth").has_token());
    this.action_enabled_changed("logout", get_option("auth").has_token());
  }

  async logout() {
    const dialog = Adw.AlertDialog.new(_("Logout"), _("Are you sure?"));
    dialog.add_response("cancel", _("Cancel"));
    dialog.add_response("logout", _("Logout"));
    dialog.default_response = "cancel";
    dialog.set_response_appearance(
      "logout",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );

    const response = await dialog.choose(this, null).catch(console.error);

    if (response === "logout") {
      get_option("auth").token = null;
      this.navigator.reload();
    }
  }

  add_toast(text: string) {
    this.toast_overlay.add_toast(Adw.Toast.new(text));
  }

  add_toast_full(toast: Adw.Toast) {
    this.toast_overlay.add_toast(toast);
  }

  login_dialog?: LoginDialog;

  auth_flow() {
    this.login_dialog ??= new LoginDialog();
    this.login_dialog.present(this);

    const controller = new AbortController();

    const listener = this.login_dialog.connect("closed", () => {
      controller.abort();
    });

    this.login_dialog
      .login(controller.signal)
      .then(() => {
        this.add_toast(_("Successfully logged in!"));
        this.navigator.reload();
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        this.add_toast(
          _("An error happened while logging you in. Please try again later."),
        );

        console.log("An error happened while logging in", error);
      })
      .finally(() => {
        // it seems you can't quickyl close a dialog after opening it
        GLib.timeout_add(100, GLib.PRIORITY_LOW, () => {
          this.login_dialog?.force_close();
          this.login_dialog?.disconnect(listener);

          return GLib.SOURCE_REMOVE;
        });
      });
  }

  private allowed_views = [
    "main",
    "now-playing",
    "video",
    "down",
    "fullscreen-video",
  ];

  private down_view = "main";

  private show_view(view: string): boolean {
    if (!this.allowed_views.includes(view)) return false;

    if (view === "fullscreen-video") {
      this.toggle_fullscreen_video();
      return true;
    }

    // now-playing shows the main view
    if (view === "now-playing") {
      view = "main";
    }

    // `down` pops down the view to show either the video or now_playing views
    // depending on what was used last
    if (view === "down") {
      view = this.down_view;
    } else if (view != "video" && view != this.down_view) {
      this.down_view = view;
    }

    this._main_stack.visible_child_name = view;

    if (view !== "video" && this.is_fullscreen()) {
      this.unfullscreen();
    }

    return true;
  }

  private get_view_name() {
    return this._main_stack.visible_child_name;
  }

  private toggle_show_video() {
    this.show_view(this.get_view_name() === "video" ? "down" : "video");
  }

  private toggle_fullscreen_video() {
    this.show_view("video");

    if (this.is_fullscreen()) {
      this.unfullscreen();
    } else {
      this.fullscreen();
    }
  }

  private rate_song(
    videoId: string,
    status: LikeStatus,
    oldStatus?: LikeStatus,
  ) {
    change_song_rating(videoId, status, oldStatus)
      .then((toast) => {
        this.add_toast_full(toast);
      })
      .catch((error) => {
        console.error("An error happened while rating song", error);

        this.add_toast(_("An error happened while rating song"));
      });
  }

  private rate_playlist(playlistId: string, status: LikeStatus, album = false) {
    rate_playlist(playlistId, status)
      .then(() => {
        let title;

        switch (status as LikeStatus) {
          case "LIKE":
            if (album) {
              title = _("Added album to library");
            } else {
              title = _("Added playlist to library");
            }
            break;
          default:
            if (album) {
              title = _("Removed album to library");
            } else {
              title = _("Removed playlist to library");
            }
            break;
        }

        this.add_toast(title);
      })
      .catch((error) => {
        this.add_toast(_("An error happened while editing library"));

        console.error("An error happened while editing library", error);
      });
  }

  private edit_library(action: "add" | "remove", token: string) {
    edit_song_library_status([token])
      .then(() => {
        this.add_toast(
          action === "add" ? _("Added to library") : _("Removed from library"),
        );
      })
      .catch((error) => {
        console.error("An error happened while rating song", action, error);

        this.add_toast(
          action === "add"
            ? _("Couldn't add to library")
            : _("Couldn't remove from library"),
        );
      });
  }

  private calculate_bottom_bar_height(
    _: this,
    page: "main" | "video",
    main_bottom_bar_height: number,
    video_bottom_bar_height: number,
  ) {
    return page === "main" ? main_bottom_bar_height : video_bottom_bar_height;
  }

  private _bottom_bar_height = 0;

  get bottom_bar_height() {
    return this._bottom_bar_height;
  }

  set bottom_bar_height(value: number) {
    if (value === this.bottom_bar_height) return;
    if (!this.toast_css_provider) return;

    this.toast_css_provider.load_from_string(
      `.main-toast-overlay { --toast-margin: ${value}px; }`,
    );
  }
}
