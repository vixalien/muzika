import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { LyricsView } from "../lyrics";
import { QueueView } from "../queue";
import { RelatedView } from "../related";

// make sure to first register these
GObject.type_ensure(LyricsView.$gtype);
GObject.type_ensure(QueueView.$gtype);
GObject.type_ensure(RelatedView.$gtype);

export class PlayerNowPlayingDetails extends Adw.NavigationPage {
  static {
    GObject.registerClass({
      GTypeName: "PlayerNowPlayingDetails",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/now-playing/details.ui",
      Properties: {
        stack: GObject.param_spec_object(
          "stack",
          "Stack",
          "The View Stack",
          Adw.ViewStack.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        header_title: GObject.param_spec_object(
          "header-title",
          "Header Title Widget",
          "The widget to show as the header title",
          Gtk.Widget.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
      },
      InternalChildren: ["stack", "headerbar"],
    }, this);
  }

  private _stack!: Adw.ViewStack;
  private _headerbar!: Gtk.HeaderBar;

  get stack() {
    return this._stack;
  }

  get header_title() {
    return this._headerbar.title_widget;
  }

  set header_title(value: Gtk.Widget) {
    this._headerbar.title_widget = value;
  }

  constructor() {
    super();

    // @ts-expect-error
    this._stack.bind_property_full(
      "visible-child",
      this,
      "title",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      (_, __) => {
        const visible_child = this._stack.get_visible_child();

        if (!visible_child) return [false];

        return [true, this._stack.get_page(visible_child).title];
      },
      null,
    );
  }
}
