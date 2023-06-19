import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GObject from "gi://GObject";

import { Loading } from "../loading";
import { Endpoint, MuzikaComponent } from "src/navigation";

export interface PageState<State> {
  state: State;
  title: string;
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

  get uri() {
    return this.page.uri;
  }

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
  __state: State | null = null;

  constructor(
    endpoint: Endpoint<MuzikaComponent<Data, State>>,
    page: MuzikaComponent<Data, State>,
  ) {
    super();

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
}
