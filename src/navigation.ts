import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { match, MatchFunction, MatchResult } from "path-to-regexp";

import { Loading } from "./components/loading.js";

import { endpoints } from "./endpoints.js";
import { ErrorPage } from "./pages/error.js";

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
}

export class Navigator extends GObject.Object {
  private _stack: Gtk.Stack;
  private _header: Gtk.HeaderBar;
  private _error_page: ErrorPage;

  private match_map: Map<MatchFunction, Endpoint<Gtk.Widget>> = new Map();

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
      },
    }, this);
  }

  constructor(stack: Gtk.Stack, header: Gtk.HeaderBar) {
    super();

    this._stack = stack;
    this._header = header;

    this.match_map = new Map();

    for (const endpoint of endpoints) {
      const fn = match(endpoint.uri, {});
      this.match_map.set(fn, endpoint);
    }

    this._error_page = new ErrorPage();

    this.add_loading_page();
    this.add_error_page();
  }

  private add_error_page() {
    this._stack.add_named(this._error_page, "error");
  }

  private add_loading_page() {
    const loading_page = new Loading();

    this._stack.add_named(loading_page, "loading");
  }

  set_title(title: string) {
    this._header.set_title_widget(Gtk.Label.new(title));
  }

  private show_error(error: any) {
    if (error instanceof DOMException && error.code == DOMException.ABORT_ERR) {
      return;
    }

    this.loading = false;
    this.last_controller = null;

    this._header.set_title_widget(Gtk.Label.new("Error"));
    this._error_page.set_error(error);
    this._stack.set_visible_child_name("error");
  }

  private show_page(meta: ShowPageOptions) {
    this._header.set_title_widget(
      Gtk.Label.new(meta.title),
    );

    const got_component = this._stack.get_child_by_name(meta.endpoint.uri);
    if (got_component) {
      this._stack.remove(got_component);
    }

    this._stack.add_named(meta.page, meta.endpoint.uri);
    this._stack.set_visible_child_name(meta.endpoint.uri);
  }

  last_controller: AbortController | null = null;

  private endpoint(
    uri: string,
    match: MatchResult,
    endpoint: Endpoint<Gtk.Widget>,
  ) {
    for (const [fn, endpoint] of this.match_map) {
      if (fn(uri) === match) {
        return endpoint;
      }
    }

    const component = endpoint.component();

    if (this.last_controller) {
      console.log("has a last controller");
      this.last_controller.abort();
    }

    this.last_controller = new AbortController();

    let response: ReturnType<Endpoint<Gtk.Widget>["load"]>;

    try {
      response = endpoint.load(component, {
        match: match as MatchResult<Record<string, string>>,
        url: new URL("muzika:" + uri),
        signal: this.last_controller.signal,
      });

      if (!response) return;

      // temporarily show an old page if it's available
      if (this._stack.get_child_by_name(uri)) {
        this._stack.set_visible_child_name(uri);
      }

      this.loading = true;

      response.then((meta = {}) => {
        this.loading = false;
        this.last_controller = null;

        this.show_page({
          title: meta?.title ?? endpoint.title,
          page: component,
          endpoint,
        });
      }).catch(this.show_error.bind(this));
    } catch (e) {
      this.show_error(e);
    }

    return null;
  }

  navigate(uri: string) {
    // muzika:home to
    // muzika/home
    // only when it's not escaped (i.e not prefixed with \)
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    for (const [fn, endpoint] of this.match_map) {
      const match = fn(path);

      if (match) {
        return this.endpoint(uri, match, endpoint);
      }
    }
  }
}
