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
import { get_window } from "./util/window.js";

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

export interface MuzikaPageMeta<Data = unknown, State = unknown> {
  title: string;
  uri: string;
  build(): MuzikaPageWidget<Data, State>;
  load(context: PageLoadContext): null | Promise<null | Data>;
}

export class Navigator extends GObject.Object {
  private _view: Adw.NavigationView;

  private match_map = new Map<
    MatchFunction<Partial<Record<string, string | string[]>>>,
    MuzikaPageMeta
  >();

  private stacks = new Map<string, Adw.NavigationPage[]>();

  loading = false;

  static {
    GObject.registerClass(
      {
        Signals: {
          navigate: {},
          "load-start": {},
          "load-end": {},
          "search-changed": {
            param_types: [GObject.TYPE_STRING],
          },
          "show-content": {},
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
      },
      this,
    );
  }

  private _visible_page_signal: number;

  constructor(stack: Adw.NavigationView) {
    super();

    this._view = stack;

    this.match_map = new Map();

    for (const page of pageMetas) {
      const fn = match(page.uri, {});
      this.match_map.set(fn, page);
    }

    // track when the current page changes
    this._visible_page_signal = this._view.connect(
      "notify::visible-page",
      this.visible_page_changed_cb.bind(this),
    );
  }

  private last_binding: GObject.Binding | null = null;

  private visible_page_changed_cb() {
    const current_page = this._view.visible_page;

    if (!current_page) return;

    if (this.last_binding) {
      this.last_binding.unbind();
      this.last_binding = null;
    }

    if (get_window()) {
      this.last_binding = current_page.bind_property(
        "title",
        get_window(),
        "title",
        GObject.BindingFlags.SYNC_CREATE,
      );
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
        name: "replace",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          const [url] = param.get_string();

          if (url) {
            if (url.startsWith("muzika:")) {
              this.replace(url.slice(7));
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
        name: "reload",
        activate: () => {
          this.reload();
        },
      },
    ]);

    return action_group;
  }

  private abort_controller: AbortController | null = null;

  private abort_current() {
    if (this.abort_controller) {
      this.abort_controller.abort();
    }

    return (this.abort_controller = new AbortController());
  }

  private reset_abort_controller() {
    this.abort_controller = null;
  }

  reload() {
    const page = this._view.get_last_child() as Page<unknown> | null;

    if (!page || page.loading || !(page instanceof Page)) return;

    const abort_controller = this.abort_current();

    return page
      .reload(abort_controller.signal)
      ?.catch((error) => {
        if (error instanceof DOMException && error.name == "AbortError") return;
        page.show_error(error);
      })
      .finally(() => {
        this.reset_abort_controller();
      });
  }

  private show_page(
    uri: string,
    match: MatchResult<Record<string, string>>,
    meta: MuzikaPageMeta,
  ) {
    const abort_controller = this.abort_current();

    const page = new Page(meta);
    this._view.push(page);
    page
      .load(uri, match, abort_controller.signal)
      .then(() => {
        this.reset_abort_controller();
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name == "AbortError") return;
        page.show_error(error);
      });
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
        decodeURIComponent(search_match.params.query?.toString() ?? ""),
      );
    }

    for (const [fn, meta] of this.match_map) {
      const match = fn(path);

      if (match) {
        return {
          match: match as MatchResult<Record<string, string>>,
          meta,
        };
      }
    }
  }

  navigate(uri: string) {
    const match = this.match_uri(uri);

    if (match) {
      this.show_page(uri, match.match, match.meta);
      this.emit("navigate");
    }
  }

  replace(uri: string) {
    const page = this._view.get_last_child() as Page<unknown> | null;

    if (!page || !(page instanceof Page)) return;

    const match = this.match_uri(uri);

    if (!match) {
      console.error(`Tried to replace a page with an invalid uri: ${uri}`);
      return;
    }

    if (match.meta !== page.meta) {
      console.error(
        `Tried to replace a page with a uri that renders a different page. Expected: ${page.meta.uri}, got: ${match.meta.uri}`,
      );
      return;
    }

    const abort_controller = this.abort_current();

    if (match) {
      return page
        .load(uri, match.match, abort_controller.signal)
        ?.then(() => {
          this.reset_abort_controller();
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name == "AbortError") {
            return;
          }
          page.show_error(error);
        });
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

  destroy() {
    this._view.disconnect(this._visible_page_signal);
  }
}

export function get_navigator(widget?: Gtk.Widget) {
  const window = (widget?.root || get_window()) as Window;

  return window.navigator;
}

export interface HistoryState {
  uri: string;
}
