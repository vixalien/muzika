import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { match, MatchFunction, MatchResult } from "path-to-regexp";

import { ERROR_CODE, MuseError } from "./muse.js";

import { endpoints } from "./endpoints.js";
import { ErrorPage } from "./pages/error.js";
import { AddActionEntries } from "./util/action.js";
import { AuthenticationErrorPage } from "./pages/authentication-error.js";
import { Page } from "./components/nav/page.js";

export type EndpointCtx = {
  match: MatchResult<Record<string, string>>;
  url: URL;
  signal: AbortSignal;
};

export type EndpointResponse = {
  title?: string;
};

export interface ShowPageOptions {
  title: string;
  page: Gtk.Widget;
  endpoint: Endpoint<any>;
  uri: string;
}

export interface MuzikaPage<
  Data extends any,
  State extends any = null,
> {
  uri: string;
  present(data: Data, state: State): void;
  get_state(): State;
  clear(): void;
  load(context: EndpointContext): void | Promise<void | Data>;
}

export interface EndpointContext {
  match: MatchResult<Record<string, string>>;
  url: URL;
  signal: AbortSignal;
}

export type Endpoint<Page extends MuzikaPage<Record<string, unknown>>> =
  Page extends MuzikaPage<infer Data, infer State> ? {
      uri: string;
      page(): MuzikaPage<Data, State> & Adw.NavigationPage;
    }
    : never;

export class Navigator extends GObject.Object {
  private _view: Adw.NavigationView;

  private match_map: Map<MatchFunction, Endpoint<MuzikaPage<any>>> = new Map();

  loading = false;

  static {
    GObject.registerClass({
      Signals: {
        navigate: {},
        "load-start": {},
        "load-end": {},
      },
      Properties: {
        loading: GObject.ParamSpec.boolean(
          "loading",
          "Loading",
          "Whether something is loading currently",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        current_uri: GObject.ParamSpec.string(
          "current-uri",
          "Current URI",
          "The current URI",
          GObject.ParamFlags.READABLE,
          "",
        ),
      },
    }, this);
  }

  constructor(stack: Adw.NavigationView) {
    super();

    this._view = stack;

    this.match_map = new Map();

    for (const endpoint of endpoints) {
      const fn = match(endpoint.uri, {});
      this.match_map.set(fn, endpoint);
    }
  }

  get_action_group() {
    const action_group = new Gio.SimpleActionGroup();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "visit",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          const [url] = param.get_string();

          if (url) {
            if (url.startsWith("muzika:")) {
              this.navigate(url.slice(7));
            }
          }
        },
      },
    ]);

    return action_group;
  }

  private prepare_error_page(error: any) {
    if (error instanceof DOMException && error.name == "AbortError") {
      return;
    }

    this.loading = false;
    this.last_controller = null;

    if (error instanceof MuseError && error.code === ERROR_CODE.AUTH_REQUIRED) {
      const error_page = new AuthenticationErrorPage({ error });
      return {
        page: error_page,
        title: "Authentication Required",
      };
    } else {
      const error_page = new ErrorPage({ error });
      return {
        page: error_page,
        title: "Error",
      };
    }
  }

  last_controller: AbortController | null = null;

  private show_page(
    uri: string,
    match: MatchResult<Record<string, string>>,
    endpoint: Endpoint<MuzikaPage<any>>,
  ) {
    const url = new URL("muzika:" + uri);
    const page = endpoint.page();

    if (this.last_controller) {
      this.last_controller.abort();
    }

    this.last_controller = new AbortController();

    const response = page.load({
      match,
      url,
      signal: this.last_controller.signal,
    });

    this.loading = true;

    this._view.push(page);

    const handle_error = (error: any) => {
      // TODO: handle this better
      console.log("Got error", error);

      // const error_page = new Page();
      // const error_content = this.prepare_error_page(error);

      // if (error_content) {
      //   error_page.content = error_content.page;
      //   error_page.title = error_content.title;
      // }

      // this._view.pop_to_page(error_page);
      // this._view.push;
    };

    Promise.resolve(response).then(
      (data) => {
        this.loading = false;
        this.last_controller = null;

        if (data != null) {
          page.present(data, null);
        }
      },
    ).catch(handle_error);
  }

  get current_uri(): string | null {
    const stack = this._view.navigation_stack;
    const page = stack.get_item(stack.get_n_items() - 1) as
      | MuzikaPage<any>
      | null;

    if (!page) return null;

    return page.uri;
  }

  go(n: number) {
    if (n >= 0) {
      return;
    } else {
      const page = this._view.navigation_stack.get_item(
        this._view.navigation_stack.get_n_items() + n,
      );

      if (page) {
        this._view.pop_to_page(page as Adw.NavigationPage);
      }
    }
  }

  back() {
    this.go(-1);
  }

  // reload(navigate?: boolean) {
  //   this.go(0, navigate);
  // }
  reload() {
  }

  private match_uri(uri: string) {
    // muzika:home to
    // muzika/home
    // only when it's not escaped (i.e not prefixed with \)
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    for (const [fn, endpoint] of this.match_map) {
      const match = fn(path);

      if (match) {
        return {
          match: match as MatchResult<Record<string, string>>,
          endpoint,
        };
      }
    }
  }

  navigate(uri: string) {
    const match = this.match_uri(uri);

    if (match) {
      this.show_page(uri, match.match, match.endpoint);
    }
  }
}

export interface HistoryState {
  uri: string;
}
