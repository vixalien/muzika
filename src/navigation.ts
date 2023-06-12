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

export type Endpoint<C extends Gtk.Widget> = {
  uri: string;
  title: string;
  component: () => C;
  load: <D extends C>(
    component: D,
    ctx: EndpointCtx,
  ) => void | Promise<void | EndpointResponse>;
};

export interface ShowPageOptions {
  title: string;
  page: Gtk.Widget;
  endpoint: Endpoint<Gtk.Widget>;
  uri: string;
}

export class Navigator extends GObject.Object {
  private _view: Adw.NavigationView;

  private match_map: Map<MatchFunction, Endpoint<Gtk.Widget>> = new Map();

  loading = false;

  private static can_go_back_spec = GObject.ParamSpec.boolean(
    "can-go-back",
    "Can go back",
    "Whether the navigator can go back",
    GObject.ParamFlags.READWRITE,
    false,
  );

  private static can_go_forward_spec = GObject.ParamSpec.boolean(
    "can-go-forward",
    "Can go forward",
    "Whether the navigator can go forward",
    GObject.ParamFlags.EXPLICIT_NOTIFY | GObject.ParamFlags.READABLE,
    false,
  );

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
        can_go_back: this.can_go_back_spec,
        can_go_forward: this.can_go_forward_spec,
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
      {
        name: "back",
        activate: () => {
          this.back();
        },
      },
      {
        name: "push-state",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          this.pushState({ uri: param.get_string()[0] });
        },
      },
      {
        name: "replace-state",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          this.replaceState({ uri: param.get_string()[0] });
        },
      },
    ]);

    action_group.action_enabled_changed("back", this.can_go_back);

    this.connect("notify::can-go-back", () => {
      action_group.action_enabled_changed("back", this.can_go_back);
    });

    return action_group;
  }

  private prepare_error_page(error: any) {
    if (error instanceof DOMException && error.code == DOMException.ABORT_ERR) {
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

  private endpoint(
    uri: string,
    match: MatchResult,
    endpoint: Endpoint<Gtk.Widget>,
    history: boolean,
  ) {
    const url = new URL("muzika:" + uri);
    const component = endpoint.component();

    if (this.last_controller) {
      this.last_controller.abort();
    }

    this.last_controller = new AbortController();

    const response = endpoint.load(component, {
      match: match as MatchResult<Record<string, string>>,
      url,
      signal: this.last_controller.signal,
    });

    if (!response) return null;

    this.loading = true;

    const page = new Page();
    page.title = endpoint.title;

    if (url.searchParams.has("replace")) {
      this._view.animate_transitions = false;
      this._view.pop();
      this._view.push(page);
    } else {
      this._view.animate_transitions = true;
      this._view.push(page);
    }

    let handle_error = (error: any) => {
      const error_page = this.prepare_error_page(error);

      if (error_page) {
        page.content = error_page.page;
        page.title = error_page.title;
      }
    };

    try {
      response.then((meta = {}) => {
        this.loading = false;
        this.last_controller = null;

        page.title = meta?.title ?? endpoint.title;
        page.content = component;
        // page.tag = uri;

        if (history) {
          if (url.searchParams.has("replace")) {
            this.replaceState({ uri });
          } else {
            this.pushState({ uri });
          }
        }
      }).catch((e) => {
        this.pushState({ uri });
        handle_error(e);
      });
    } catch (e) {
      this.pushState({ uri });
      handle_error(e);
    }

    return null;
  }

  get current_uri(): string | undefined {
    return this.history[this.history.length - 1]?.uri;
  }

  private history: HistoryState[] = [];
  private future: HistoryState[] = [];

  get can_go_back() {
    return this.history.length > 1;
  }

  get can_go_forward() {
    return this.future.length > 0;
  }

  pushState(state: HistoryState) {
    this.history.push(state);

    this.notify("can-go-back");
    this.notify("current-uri");
  }

  replaceState(state: HistoryState) {
    this.history[this.history.length - 1] = state;

    this.notify("current-uri");
  }

  go(n: number, navigate = true) {
    if (n > 0) {
      this.history.push(...this.future.splice(-n));
    } else if (n < 0) {
      this.future.push(...this.history.splice(n));
    }

    this.notify("can-go-back");
    this.notify("can-go-forward");
    this.notify("current-uri");

    const state = this.history[this.history.length - 1];

    if (!state) {
      return;
    }

    if (navigate) {
      this.navigate(state.uri, false);
    }
  }

  back(navigate?: boolean) {
    this.go(-1, navigate);
  }

  forward(navigate?: boolean) {
    this.go(1, navigate);
  }

  reload(navigate?: boolean) {
    this.go(0, navigate);
  }

  navigate(uri: string, history = true) {
    this._view.animate_transitions = history;

    // muzika:home to
    // muzika/home
    // only when it's not escaped (i.e not prefixed with \)
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    for (const [fn, endpoint] of this.match_map) {
      const match = fn(path);

      if (match) {
        console.log("navigating to", uri);
        return this.endpoint(uri, match, endpoint, history);
      }
    }
  }
}

export interface HistoryState {
  uri: string;
}
