import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GObject from "gi://GObject";

import { Loading } from "../loading";
import { MuzikaPageMeta, MuzikaPageWidget } from "src/navigation";
import { ERROR_CODE, MuseError } from "src/muse";
import { AuthenticationErrorPage } from "src/pages/authentication-error";
import { ErrorPage } from "src/pages/error";
import { MatchResult } from "path-to-regexp";

export interface PageState<State> {
  state: State;
}

// register Loading
GObject.type_ensure(Loading.$gtype);

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

  page?: MuzikaPageWidget<Data, State>;
  meta: MuzikaPageMeta<Data, State>;

  private __state: PageState<State> | null = null;
  private __error: any;

  constructor(
    meta: MuzikaPageMeta<Data, State>,
  ) {
    super();

    this.uri = meta.uri;

    this.meta = meta;
    this.title = meta.title;

    this.loading = true;
  }

  vfunc_hidden(): void {
    if (this.__error) {
      this.page = this._content.child = null as any;
    } else if (this.page) {
      this.__state = {
        state: this.page.get_state(),
      };
      this.page = this._content.child = null as any;
    }
  }

  vfunc_showing(): void {
    if (this.__state) {
      const page = this.meta.build();
      page.restore_state(this.__state.state);
      this.page = page;
      this._content.child = page;
      this.__state = null;
    } else if (this.__error) {
      this.show_error(this.__error);
    } else {
      // page never got to load
      this.reload();
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

  async load(
    uri: string,
    match: MatchResult<Record<string, string>>,
    signal: AbortSignal,
  ) {
    this.loading = true;

    this.uri = uri;

    try {
      const result = await this.meta.load({
        match,
        set_title: this.set_title.bind(this),
        signal,
        url: new URL("muzika:" + uri),
      })?.catch((error) => {
        throw error;
      });

      this.loading = false;

      const page = this.meta.build();
      page.present(result!);

      this._content.child = this.page = page;
    } catch (error) {
      this._handle_error(error);
    }
  }

  private _handle_error(error: unknown) {
    if (error instanceof DOMException && error.name == "AbortError") {
      // do nothing
      // TODO: maybe
      // this._view.remove(page);
      return;
    }

    this.show_error(error);
  }

  reload() {}
}
