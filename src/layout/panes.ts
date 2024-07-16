import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import { get_navigator } from "src/navigation";
import { SignalListeners } from "src/util/signal-listener";

export class MuzikaPanes extends Adw.BreakpointBin {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaPanes",
        Template: "resource:///com/vixalien/muzika/ui/layout/panes.ui",
        InternalChildren: ["sidebar_page", "content_page", "split_view"],
        Properties: {
          sidebar: GObject.param_spec_object(
            "sidebar",
            "Sidebar",
            "The widget to show as the sidebar",
            Gtk.Widget.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          content: GObject.param_spec_object(
            "content",
            "content",
            "The widget to show as the content",
            Gtk.Widget.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Implements: [Gtk.Buildable],
      },
      this,
    );
  }

  private _split_view!: Adw.NavigationSplitView;
  private _sidebar_page!: Adw.NavigationPage;
  private _content_page!: Adw.NavigationPage;

  private sidebar!: Gtk.Widget;
  private content!: Gtk.Widget;

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);

    this.bind_property(
      "sidebar",
      this._sidebar_page,
      "child",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "content",
      this._content_page,
      "child",
      GObject.BindingFlags.SYNC_CREATE,
    );
  }

  listeners = new SignalListeners();

  vfunc_map() {
    super.vfunc_map();

    this.listeners.connect(
      get_navigator(this),
      "show-content",
      () => (this._split_view.show_content = true),
    );
  }

  vfunc_unmap() {
    this.listeners.clear();

    super.vfunc_unmap();
  }
}
