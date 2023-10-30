import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { get_navigator } from "./navigation.js";
import { get_current_user, get_option } from "libmuse";
import { NavbarView } from "./components/navbar/index.js";

NavbarView;

export class WindowSidebar extends Adw.NavigationPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "WindowSidebar",
        Template: "resource:///com/vixalien/muzika/ui/sidebar.ui",
        InternalChildren: [
          "account",
          "login",
          "navbar",
        ],
        Properties: {},
        Signals: {
          "show-content": {},
        },
      },
      this,
    );
  }

  private _account!: Gtk.MenuButton;
  private _login!: Gtk.Button;
  private _navbar!: NavbarView;

  constructor() {
    super();

    this.token_changed();
  }

  private navbar_searched_cb() {
    this.emit("show-content");
  }

  private navbar_activated_cb(_: NavbarView, uri: string) {
    this.emit("show-content");
    get_navigator().switch_stack(uri);
  }

  async token_changed() {
    const has_token = get_option("auth").has_token();

    this._account.visible = has_token;
    this._login.visible = !has_token;

    if (!has_token) {
      return;
    }

    const account = await get_current_user();

    const menu = Gio.Menu.new();

    menu.append(
      account.name,
      `navigator.visit("muzika:channel:${account.channel_id}")`,
    );
    menu.append(
      _("Logout"),
      "win.logout",
    );

    this._account.menu_model = menu;
  }

  vfunc_realize(): void {
    super.vfunc_realize();

    get_navigator(this).connect("search-changed", (_, search: string) => {
      this._navbar.set_search(search);
    });
  }
}
