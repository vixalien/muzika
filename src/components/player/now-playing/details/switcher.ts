import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { AddActionEntries } from "src/util/action";
import { SignalListeners } from "src/util/signal-listener";
import { list_model_to_array } from "src/util/list";

export class MuzikaNPDetailsSwitcher extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPDetailsSwitcher",
        Properties: {
          show_buttons: GObject.param_spec_boolean(
            "show-buttons",
            "Show Buttons",
            "Render buttons for the switcher instead of task switchers",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          details_stack: GObject.param_spec_object(
            "details-stack",
            "Detais View Stack",
            "The view stack to show details switchers for",
            Adw.ViewStack.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          show_details: GObject.param_spec_boolean(
            "show-details",
            "Show Details",
            "If the details should be shown",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  // private navigation_view!: Adw.NavigationView;
  private _details_stack!: Adw.ViewStack;
  private action_group: Gio.SimpleActionGroup;

  show_details = false;
  show_buttons = false;

  constructor(params?: Partial<Gtk.Box.ConstructorProperties>) {
    super({
      homogeneous: true,
      halign: Gtk.Align.CENTER,
      spacing: 3,
      ...params,
    });

    if (this.show_buttons) {
      this.spacing = 6;
    }

    // action groups
    this.action_group = this.get_action_group();
    this.insert_action_group("details-switcher", this.action_group);
  }

  private get_action_group() {
    const action_group = new Gio.SimpleActionGroup();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "select-page",
        parameter_type: "s",
        state: `"${this.get_details_id()}"`,
        activate: (source, parameter) => {
          const name = parameter?.get_string()[0];
          if (name === undefined) return;

          this.show_details =
            this.details_stack.visible_child_name === name
              ? !this.show_details
              : true;
          this.details_stack.visible_child_name = name;

          // chore: updating state
          source.set_state(GLib.Variant.new_string(this.get_details_id()));
        },
      },
    ]);

    return action_group;
  }

  private update_page_state() {
    this.action_group.action_state_changed(
      "select-page",
      GLib.Variant.new_string(this.get_details_id()),
    );
  }

  private get_details_id() {
    if (!this.show_details || !this.details_stack) return "none";
    return this.details_stack.visible_child_name;
  }

  private pages_listener = new SignalListeners();
  private switcher_listener = new SignalListeners();

  get details_stack() {
    return this._details_stack;
  }

  set details_stack(value: Adw.ViewStack) {
    if (value === this._details_stack) return;

    this._details_stack = value;
    this.init_switchers();
  }

  get pages() {
    return this._details_stack.pages as Adw.ViewStackPages<Adw.ViewStackPage>;
  }

  private recreate_switchers() {
    this.switcher_listener.clear();

    // remove all children
    let child: Gtk.Widget | null;
    while ((child = this.get_first_child())) child.unparent();

    // create already existing pages
    list_model_to_array(this.pages).forEach((page) => {
      const button = this.create_switcher_button(page);
      this.append(button);
    });
  }

  private init_switchers() {
    if (!this._details_stack) return;
    this.recreate_switchers();

    this.pages_listener.clear();

    this.pages_listener.connect(
      this.pages,
      "items-changed",
      this.pages_items_changed_cb.bind(this),
    );

    this.pages_listener.connect(this.pages, "selection-changed", () => {
      this.update_page_state();
    });

    this.pages_listener.connect(this, "notify::show-details", () => {
      this.update_page_state();
    });

    this.update_page_state();
  }

  private buttons = new Gio.ListStore<Gtk.Button>({
    item_type: Gtk.Button.$gtype,
  });

  private pages_items_changed_cb(
    _model: Gio.ListModel,
    position: number,
    removed: number,
    added: number,
  ) {
    // remove buttons for removed pages
    const removed_buttons = list_model_to_array(this.buttons).splice(
      position,
      position + removed,
      ...(new Array(added)
        .fill(null)
        .map((_, index) => {
          const page = this.pages.get_item(position + index);
          if (!page) return null;

          const button = this.create_switcher_button(page);
          this.append(button);
          return button;
        })
        .filter(Boolean) as Gtk.Button[]),
    );

    removed_buttons.forEach((button) => {
      button.unparent();
    });
  }

  private create_switcher_button(page: Adw.ViewStackPage) {
    if (this.show_buttons) {
      return this.create_detail_button(page);
    }

    return this.create_detail_switcher(page);
  }

  private create_detail_button(page: Adw.ViewStackPage) {
    const button = new Gtk.ToggleButton({
      icon_name: page.icon_name,
      tooltip_text: page.title,
      css_classes: ["flat"],
      action_name: "details-switcher.select-page",
      action_target: GLib.Variant.new_string(page.name),
    });

    // TODO: using `sensitive` instead of `visible` doesn't seem to work
    this.switcher_listener.add_binding(
      page.bind_property(
        "visible",
        button,
        "visible",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    return button;
  }

  private create_detail_switcher(page: Adw.ViewStackPage) {
    const label = new Gtk.Label({
      label: page.title,
      css_classes: ["caption-heading"],
    });

    const icon = new Gtk.Image({
      icon_name: page.icon_name,
    });

    const container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      css_classes: ["switcher-button"],
    });

    container.append(icon);
    container.append(label);

    const button = new Gtk.ToggleButton({
      child: container,
      css_classes: ["flat"],
      action_name: "details-switcher.select-page",
      action_target: GLib.Variant.new_string(page.name),
    });

    this.switcher_listener.add_binding(
      page.bind_property(
        "visible",
        button,
        "visible",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    return button;
  }

  vfunc_map(): void {
    super.vfunc_map();
    this.init_switchers();
  }

  vfunc_unmap() {
    this.pages_listener.clear();
    super.vfunc_unmap();
  }
}
