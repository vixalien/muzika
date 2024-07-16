import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GObject from "gi://GObject";

import { ERROR_CODE, MuseError } from "libmuse";

import { Loading } from "../loading";
import { MuzikaPageMeta, MuzikaPageWidget } from "src/navigation";
import { AuthenticationErrorPage } from "src/pages/authentication-error";
import { ErrorPage } from "src/pages/error";
import { MatchResult } from "path-to-regexp";

export interface PageState<State> {
  state: State;
}

// register Loading
GObject.type_ensure(Loading.$gtype);

export class Page<Data, State = null> extends Adw.NavigationPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "Page",
        Template: "resource:///com/vixalien/muzika/ui/components/nav/page.ui",
        InternalChildren: ["stack", "loading", "content"],
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
      },
      this,
    );
  }

  private _stack!: Gtk.Stack;
  private _loading!: Loading;
  private _content!: Adw.Bin;

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

  uri: string;
  page?: MuzikaPageWidget<Data, State>;
  meta: MuzikaPageMeta<Data, State>;
  last_match?: MatchResult<Record<string, string>>;

  private __state: PageState<State> | null = null;
  private __error: unknown;

  constructor(meta: MuzikaPageMeta<Data, State>) {
    super();

    this.uri = meta.uri;

    this.meta = meta;
    this.title = meta.title;

    this.loading = true;
  }

  vfunc_hidden(): void {
    if (this.__error) {
      // @ts-expect-error cleaning up
      this.page = this._content.child = null;
    } else if (this.page) {
      this.__state = {
        state: this.page.get_state(),
      };
      // @ts-expect-error cleaning up
      this.page = this._content.child = null;
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
    } else if (this.last_match) {
      // page never got to load
      this.reload();
    }
  }

  show_error(error: unknown) {
    this.__error = error;

    let error_page: Gtk.Widget;

    if (error instanceof MuseError && error.code === ERROR_CODE.AUTH_REQUIRED) {
      error_page = new AuthenticationErrorPage({ error });
    } else {
      error_page = new ErrorPage({ error });
    }

    this.loading = false;
    this._content.child = error_page;
  }

  async load(
    uri: string,
    match: MatchResult<Record<string, string>>,
    signal: AbortSignal,
  ) {
    this.loading = true;
    this.uri = uri;
    this.last_match = match;

    try {
      const result = await this.meta
        .load({
          match,
          set_title: this.set_title.bind(this),
          signal,
          url: new URL("muzika:" + uri),
        })
        ?.catch((error) => {
          throw error;
        });

      this.loading = false;
      this.__error = null;

      if (!result) return;

      const page = this.meta.build();
      page.present(result);

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

  reload(_signal?: AbortSignal) {
    const signal = _signal ?? new AbortController().signal;

    if (!this.last_match) {
      console.error("trying to reload a page that never loaded");
      return;
    }

    return this.load(this.uri, this.last_match, signal);
  }
}
