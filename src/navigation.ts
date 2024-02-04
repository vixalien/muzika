import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { match, MatchFunction, MatchResult } from "path-to-regexp";

import { Window } from "./window.js";
import { pageMetas } from "./pages.js";
import { AddActionEntries } from "./util/action.js";
import { Page } from "./components/nav/page.js";
import { list_model_to_array } from "./util/list.js";

export interface MuzikaPageWidget<Data = unknown, State = unknown>
  extends Gtk.Widget {
  __page_state?: State;
  present(data: Data): void;
  get_state(): State;
  restore_state(state: State): void;
}

export interface PageLoadContext {
  match: MatchResult<Record<string, string>>;
  url: URL;
  signal: AbortSignal;
  set_title(title: string): void;
}

export type MuzikaPageMeta<Data = unknown, State = unknown> = {
  title: string;
  uri: string;
  build(): MuzikaPageWidget<Data, State>;
  load(context: PageLoadContext): void | Promise<void | Data>;
};

export class Navigator extends GObject.Object {
  private _view: Adw.NavigationView;

  private match_map: Map<MatchFunction, MuzikaPageMeta> = new Map();

  private stacks: Map<string, Adw.NavigationPage[]> = new Map();

  loading = false;

  static {
    GObject.registerClass({
      Signals: {
        navigate: {},
        "load-start": {},
        "load-end": {},
        "search-changed": {
          param_types: [GObject.TYPE_STRING],
        },
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

    for (const page of pageMetas) {
      const fn = match(page.uri, {});
      this.match_map.set(fn, page);
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
        activate: (_) => {
          this.back();
        },
      },
    ]);

    return action_group;
  }

  last_controller: AbortController | null = null;

  private reload() {
    const page = this._view.get_last_child() as Page<unknown> | null;

    if (!page || !page.loading) return;
  }

  private show_page(
    uri: string,
    match: MatchResult<Record<string, string>>,
    meta: MuzikaPageMeta,
  ) {
    if (this.last_controller) {
      this.last_controller.abort();
    }

    this.last_controller = new AbortController();

    const page = new Page(meta);
    this._view.push(page);
    page.load(uri, match, this.last_controller.signal);
  }

  get current_uri(): string | null {
    const page = this._view.get_visible_page() as Page<unknown> | null;

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
    this._view.pop();
  }

  private match_uri(uri: string) {
    // muzika:home to
    // muzika/home
    // only when it's not escaped (i.e not prefixed with \)
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    const search_match = match("search/:query")(path);

    if (search_match) {
      this.emit(
        "search-changed",
        decodeURIComponent((search_match.params as any).query),
      );
    }

    for (const [fn, page] of this.match_map) {
      const match = fn(path);

      if (match) {
        return {
          match: match as MatchResult<Record<string, string>>,
          page,
        };
      }
    }
  }

  navigate(uri: string) {
    const match = this.match_uri(uri);

    if (match) {
      this.show_page(uri, match.match, match.page);
      this.emit("navigate");
    }
  }

  switch_stack(uri: string) {
    const stack = this._view.navigation_stack as Gio.ListModel<
      Page<unknown, unknown>
    >;

    const first = stack.get_item(0);

    if (!first) return;

    if (first.uri === uri) {
      // go to the first page
      this._view.pop_to_page(first);
      return;
    }

    this.stacks.set(first.uri, list_model_to_array(stack));

    const new_stack = this.stacks.get(uri);

    if (new_stack) {
      this._view.replace(new_stack);
    } else {
      this._view.replace([]);
      this.navigate(uri);
    }
  }
}

export function get_navigator(widget?: Gtk.Widget) {
  const window = ((widget?.root) ||
    (Gtk.Application.get_default() as Gtk.Application)
      .active_window) as Window;

  return window.navigator;
}

export interface HistoryState {
  uri: string;
}
