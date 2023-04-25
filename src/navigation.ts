import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { match, MatchFunction, MatchResult } from "path-to-regexp";

import { Loading } from "./components/loading.js";

import { endpoints } from "./endpoints.js";

export type EndpointCtx = {
  match: MatchResult<Record<string, string>>;
  url: URL;
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

export class Navigator extends GObject.Object {
  private _stack: Gtk.Stack;
  private _header: Gtk.HeaderBar;

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

    this.add_loading_page();

    this.match_map = new Map();

    for (const endpoint of endpoints) {
      const fn = match(endpoint.uri, {});
      this.match_map.set(fn, endpoint);
    }
  }

  private add_loading_page() {
    const loading_page = new Loading();

    this._stack.add_named(loading_page, "loading");
  }

  set_title(title: string) {
    this._header.set_title_widget(Gtk.Label.new(title));
  }

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

    const response = endpoint.load(component, {
      match: match as MatchResult<Record<string, string>>,
      url: new URL("muzika:" + uri),
    });

    if (!response) return;

    this.loading = true;

    response.then((meta = {}) => {
      this.loading = false;
      this._header.set_title_widget(
        Gtk.Label.new(meta?.title ?? endpoint.title),
      );

      const got_component = this._stack.get_child_by_name(endpoint.uri);
      if (got_component) {
        this._stack.remove(got_component);
      }

      this._stack.add_named(component, endpoint.uri);
      this._stack.set_visible_child_name(endpoint.uri);
    });

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
