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
import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { Navigator } from "./navigation.js";
import { get_player } from "./application.js";
import { Settings } from "./util/settings.js";
import {
  PlayerNowPlayingDetails,
} from "./components/player/now-playing/details.js";
import { LoginDialog } from "./pages/login.js";
import { AddActionEntries } from "./util/action.js";
import { get_option, LikeStatus, rate_song } from "libmuse";
import { PlayerView } from "./components/player/view.js";
import { VideoPlayerView } from "./components/player/video/view.js";
import { SaveToPlaylistDialog } from "./components/playlist/save-to-playlist.js";
import { PlayerNowPlayingView } from "./components/player/now-playing/view.js";
import { WindowSidebar } from "./sidebar.js";
import { set_background_status } from "./util/portals.js";

// make sure to first register PlayerSidebar
GObject.type_ensure(PlayerNowPlayingDetails.$gtype);
GObject.type_ensure(PlayerNowPlayingView.$gtype);
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
          "toolbar_view",
          "now_playing_split_view",
          "split_view",
          "main_stack",
          "video_player_view",
          "now_playing_details",
          "now_playing_view",
          "sidebar",
        ],
        Children: [
          "toast_overlay",
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
  private _now_playing_split_view!: Adw.NavigationSplitView;
  private _split_view!: Adw.NavigationSplitView;
  private _main_stack!: Gtk.Stack;
  private _video_player_view!: VideoPlayerView;
  private _now_playing_details!: PlayerNowPlayingDetails;
  private _now_playing_view!: PlayerNowPlayingView;
  private _sidebar!: WindowSidebar;

  navigator: Navigator;
  toast_overlay!: Adw.ToastOverlay;

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

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

    this._sidebar.connect("show-content", () => {
      this._split_view.show_content = true;
    });

    const player = get_player();

    player.queue.connect(
      "notify::current",
      this.update_show_player_controls.bind(this),
    );

    this.insert_action_group("navigator", this.navigator.get_action_group());
    this.insert_action_group("player", player.get_action_group());
    this.insert_action_group(
      "queue",
      player.queue.get_action_group(),
    );

    this.add_actions();

    this._now_playing_view.connect("bottom-bar-clicked", () => {
      this._now_playing_split_view.show_content = true;
    });

    this.connect("notify::visible", () => {
      if (!this.visible) {
        set_background_status();
      }
    });
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
        name: "show-main-view",
        activate: (_) => {
          this.show_view("main");
        },
      },
      {
        name: "toggle-show-video",
        activate: (_) => {
          this.toggle_show_video();
        },
      },
      {
        name: "fullscreen",
        activate: (_) => {
          this.fullscreen_video();
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
            oldStatus as LikeStatus || undefined,
          );
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
        activate: (action, param) => {
          const string = param?.get_string()[0];
          if (string && this.show_view(string)) {
            action.set_state(GLib.Variant.new_string(string));
          }
        },
      },
    ]);

    get_option("auth").addEventListener("token-changed", () => {
      this.update_auth_actions();
      this._sidebar.token_changed();
    });

    this.update_auth_actions();

    this._main_stack.connect("notify::visible-child", () => {
      const visible_child = this._main_stack.get_visible_child_name();

      if (
        visible_child &&
        visible_child != this.get_action_state("visible-child")?.get_string()[0]
      ) {
        this.change_action_state("visible-view", GLib.Variant.new_string(visible_child))
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

    const response = await dialog.choose(this, null)
      .catch(console.error);

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

  auth_flow() {
    const loginDialog = new LoginDialog();

    loginDialog.present(this);

    const controller = new AbortController();

    loginDialog.connect("closed", () => {
      controller.abort();
    });

    loginDialog.auth_flow(controller.signal)
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
        loginDialog.close();
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
      this.fullscreen_video();
      return true;
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

    this.update_show_player_controls();

    return true;
  }

  private get_view_name() {
    return this._main_stack.visible_child_name;
  }

  private update_show_player_controls() {
    let show_bottom_bars = true;

    if (this.get_view_name() !== "main") {
      // hide the player bar when the view is not the main view
      show_bottom_bars = false;
    } else if (this.get_view_name() === "now-playing" && this.large_viewport) {
      // hide the bottom bar when showing the now playing screen on mobile
      show_bottom_bars = false;
    } else if (get_player().queue.current?.object == null) {
      // also hide the player bar when there is no current track playing
      show_bottom_bars = false;
    }

    this._toolbar_view.reveal_bottom_bars = show_bottom_bars;
  }

  private toggle_show_video() {
    this.show_view(this.get_view_name() === "video" ? "down" : "video");
  }

  private fullscreen_video() {
    if (!get_player().queue.current_is_video) return;

    this.show_view("video");

    if (this.is_fullscreen()) {
      this.unfullscreen();
    } else {
      this.fullscreen();
    }
  }

  private large_viewport = false;

  private on_breakpoint_apply() {
    this.large_viewport = true;
    this.update_show_player_controls();
  }

  private on_breakpoint_unapply() {
    this.large_viewport = false;
    this.update_show_player_controls();
  }

  private rate_song(
    videoId: string,
    status: LikeStatus,
    oldStatus?: LikeStatus,
  ) {
    rate_song(videoId, status as LikeStatus)
      .then(() => {
        const toast = new Adw.Toast();

        switch (status as LikeStatus) {
          case "DISLIKE":
            toast.title = _("Added to disliked songs");
            break;
          case "LIKE":
            toast.title = _("Added to liked songs");
            toast.button_label = _("Liked songs");
            toast.action_name = "navigator.visit";
            toast.action_target = GLib.Variant.new_string("muzika:playlist:LM");
            break;
          case "INDIFFERENT":
            if (oldStatus === "LIKE") {
              toast.title = _("Removed from liked songs");
            } else {
              toast.title = _("Removed from disliked songs");
            }
            break;
        }

        this.add_toast_full(toast);
      })
      .catch((error) => {
        this.add_toast(_("An error happened while rating song"));

        console.log("An error happened while rating song", error);
      });
  }
}
