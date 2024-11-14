import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { get_current_user, get_option } from "libmuse";

import { get_navigator } from "../navigation";
import { NavbarView } from "../components/navbar/index";

GObject.type_ensure(NavbarView.$gtype);

export class WindowSidebar extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "WindowSidebar",
        Template: "resource:///com/vixalien/muzika/ui/layout/sidebar.ui",
        InternalChildren: ["account", "login", "navbar"],
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
    get_navigator().emit("show-content");
  }

  private navbar_activated_cb(_: NavbarView, uri: string) {
    const navigator = get_navigator();

    navigator.emit("show-content");
    navigator.switch_stack(uri);
  }

  async token_changed() {
    const has_token = get_option("auth").has_token();

    this._account.visible = has_token;
    this._login.visible = !has_token;

    if (!has_token) {
      return;
    }

    const account = await get_current_user().catch(() => {
      console.error("Couldn't get logged in user");
    });

    const menu = Gio.Menu.new();

    if (account) {
      menu.append(
        account.name,
        `navigator.visit("muzika:channel:${account.channel_id}")`,
      );
    }

    menu.append(_("Logout"), "win.logout");

    this._account.menu_model = menu;
  }

  private _search_changed_signal?: number;

  vfunc_realize(): void {
    super.vfunc_realize();

    this._search_changed_signal = get_navigator(this).connect(
      "search-changed",
      (_, search: string) => {
        this._navbar.set_search(search);
      },
    );
  }

  vfunc_unrealize(): void {
    if (this._search_changed_signal) {
      get_navigator(this).disconnect(this._search_changed_signal);
    }

    super.vfunc_unrealize();
  }
}
