import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GObject from "gi://GObject";

import { Loading } from "../loading";
import { Endpoint, MuzikaComponent } from "src/navigation";
import { ERROR_CODE, MuseError } from "src/muse";
import { AuthenticationErrorPage } from "src/pages/authentication-error";
import { ErrorPage } from "src/pages/error";

export interface PageState<State> {
  state: State;
}

// register Loading
Loading;

export class Page<Data extends unknown, State extends unknown = null>
  extends Adw.NavigationPage {
  static {
    GObject.registerClass({
      GTypeName: "Page",
      Template: "resource:///com/vixalien/muzika/ui/components/nav/page.ui",
      InternalChildren: [
        "stack",
        "loading",
        "content",
      ],
      Properties: {
        content: GObject.ParamSpec.object(
          "content",
          "Content",
          "The content to show on this page",
          GObject.ParamFlags.READWRITE,
          Gtk.Widget.$gtype,
        ),
        "is-loading": GObject.ParamSpec.boolean(
          "is-loading",
          "Is Loading",
          "Whether the page is loading",
          GObject.ParamFlags.READWRITE,
          true,
        ),
      },
    }, this);
  }

  private _stack!: Gtk.Stack;
  private _loading!: Loading;
  private _content!: Adw.Bin;

  uri: string;

  get loading() {
    return this._stack.visible_child === this._loading;
  }

  set loading(loading: boolean) {
    this._stack.visible_child = loading ? this._loading : this._content;
  }

  get content() {
    return this._content.child;
  }

  set content(content: Gtk.Widget | null) {
    if (content) {
      this._content.child = content;
      this.loading = false;
    } else {
      this.loading = true;
    }
  }

  page: MuzikaComponent<Data, State>;
  endpoint: Endpoint<MuzikaComponent<Data, State>>;

  private __state: PageState<State> | null = null;
  private __error: any;

  constructor(
    uri: string,
    endpoint: Endpoint<MuzikaComponent<Data, State>>,
    page: MuzikaComponent<Data, State>,
  ) {
    super();

    this.uri = uri;

    this.endpoint = endpoint;
    this.page = page;
    this.title = endpoint.title;

    this.loading = true;
  }

  loaded(data: Data) {
    const page = this.endpoint.component();

    page.present(data);

    this.loading = false;

    this.page = page;
    this._content.child = page;
  }

  vfunc_hidden(): void {
    if (this.__error) {
      this.page = this._content.child = null as any;
    } else {
      this.__state = {
        state: this.page.get_state(),
      };
      this.page = this._content.child = null as any;
    }
  }

  vfunc_showing(): void {
    if (this.__state) {
      const page = this.endpoint.component();
      page.restore_state(this.__state.state);
      this.page = page;
      this._content.child = page;
      this.__state = null;
    } else if (this.__error) {
      this.show_error(this.__error);
    }
  }

  show_error(error: any) {
    this.__error = error;

    let error_widget: Gtk.Widget;

    if (error instanceof MuseError && error.code === ERROR_CODE.AUTH_REQUIRED) {
      error_widget = new AuthenticationErrorPage({ error });
      this.title = _("Authentication Required");
    } else {
      error_widget = new ErrorPage({ error });
      this.title = _("Error");
    }

    const toolbar_view = new Adw.ToolbarView();
    toolbar_view.add_top_bar(Adw.HeaderBar.new());
    toolbar_view.content = error_widget;

    this.loading = false;
    this._content.child = toolbar_view;
  }
}
