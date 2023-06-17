import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GObject from "gi://GObject";

import { Loading } from "../loading";

// register Loading
Loading;

export class Page extends Adw.NavigationPage {
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

  static new(child: Gtk.Widget, title: string) {
    const page = new this({ title });
    page.content = child;

    return page;
  }

  static new_with_tag(
    child: Gtk.Widget,
    title: string,
    tag: string,
  ): Adw.NavigationPage {
    const page = new this({ title, tag });
    page.content = child;

    return page;
  }
}
