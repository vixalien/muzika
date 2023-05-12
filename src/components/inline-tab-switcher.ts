import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

export class Tab extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: "Tab",
        Properties: {
          id: GObject.ParamSpec.string(
            "id",
            "ID",
            "The unique ID of the tab",
            GObject.ParamFlags.READWRITE,
            null as any,
          ),
          title: GObject.ParamSpec.string(
            "title",
            "Title",
            "Title of the tab",
            GObject.ParamFlags.READWRITE,
            null as any,
          ),
          icon: GObject.ParamSpec.string(
            "icon",
            "Icon",
            "Icon that represents the tab",
            GObject.ParamFlags.READWRITE,
            null as any,
          ),
          navigate: GObject.ParamSpec.string(
            "action-target",
            "Action Target",
            "The target string of the action to be executed when the tab is activated",
            GObject.ParamFlags.READWRITE,
            null as any,
          ),
        },
      },
      this,
    );
  }

  id: string;
  title: string | null = null;
  icon: string | null = null;

  navigate: string | null = null;

  constructor(id: string, title?: string, icon?: string) {
    super();
    this.id = id;
    this.title = title || null;
    this.icon = icon || null;
  }
}

export class InlineTabSwitcher extends Gtk.Widget {
  private TIMEOUT_EXPAND = 500;
  private buttons = new Map<Tab, Gtk.ToggleButton>();

  model = new Gio.ListStore<Tab>();

  private tabs = new Gtk.SingleSelection<Tab>();

  static {
    GObject.registerClass(
      {
        GTypeName: "InlineTabSwitcher",
        Signals: {
          "changed": {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this,
    );

    this.set_css_name("inline-tab-switcher");
    this.set_accessible_role(Gtk.AccessibleRole.TAB_LIST);
    this.set_layout_manager_type(Gtk.BoxLayout.$gtype);
  }

  constructor(
    properties?: Partial<Gtk.Widget.ConstructorProperties> | undefined,
  ) {
    super(properties);

    this.tabs.set_model(this.model);

    this.tabs.connect("items-changed", this.items_changed_cb.bind(this));
    this.tabs.connect(
      "selection-changed",
      (_, position, items) => {
        this.emit("changed", this.tabs.get_item(this.tabs.selected)!.id);
        this.selection_changed_cb(position, items);
      },
    );

    this.populate_switcher();
  }

  add_tab_full(tab: Tab) {
    this.model.append(tab);
  }

  add_tab(id: string, title?: string, icon?: string) {
    this.add_tab_full(new Tab(id, title, icon));
  }

  private find_tab(id: string) {
    let current: null | number = null;

    for (let i = 0; i < this.tabs.get_n_items(); i++) {
      const tab = this.tabs.get_item(i)!;

      if (tab.id === id) {
        current = i;
        break;
      }
    }

    return current;
  }

  select(id: string) {
    const current = this.find_tab(id);

    if (current != null) {
      this.tabs.select_item(current, true);
    }
  }

  remove_tab(id: string) {
    const current = this.find_tab(id);

    if (current != null) {
      this.model.remove(current);
    }
  }

  private populate_switcher() {
    for (let i = 0; i < this.tabs.get_n_items(); i++) {
      this.add_child(i);
    }
  }

  private clear_switcher() {
    this.buttons.forEach((button, tab) => {
      const separator = (button as any).separator as Gtk.Widget;
      button.unparent();
      separator.unparent();
      tab.connect("notify", this.tab_updated_cb.bind(this));
    });

    this.buttons.clear();
  }

  private items_changed_cb() {
    this.clear_switcher();
    this.populate_switcher();
  }

  private selection_changed_cb(position: number, items: number) {
    for (let i = position; i < position + items; i++) {
      const tab = this.tabs.get_item(i);
      const button = this.buttons.get(tab!);

      if (button != null) {
        const selected = this.tabs.is_selected(i);
        // @ts-expect-error doesn't need a copy
        const value = new GObject.Value();
        value.init(GObject.TYPE_INT);
        value.set_int(selected ? 1 : 0);

        button.active = selected;
        button.update_state([Gtk.AccessibleState.SELECTED], [value]);
      }
    }
  }

  private add_child(index: number) {
    if (index < 0 || index > this.tabs.get_n_items()) {
      throw new Error("Invalid index");
    }

    const button = new Gtk.ToggleButton({
      accessible_role: Gtk.AccessibleRole.TAB,
      hexpand: true,
      vexpand: true,
      focus_on_click: false,
    });

    button.add_css_class("flat");

    const controller = new Gtk.DropControllerMotion();

    controller.connect("enter", () => {
      if (button.active) return;

      const switch_timer = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        this.TIMEOUT_EXPAND,
        () => {
          button.steal_data("switch-timer");
          button.active = true;

          return GLib.SOURCE_REMOVE;
        },
      );

      button.set_data("switch-timer", switch_timer);
    });

    controller.connect("leave", () => {
      const switch_timer = button.steal_data("switch-timer") as number;

      if (switch_timer > 0) {
        GLib.source_remove(switch_timer);
      }
    });

    button.add_controller(controller);

    const tab = this.tabs.get_item(index)!;
    this.update_button(tab, button);

    button.set_parent(this);

    const selected = this.tabs.is_selected(index);

    // @ts-expect-error doesn't need a copy
    const selected_value = new GObject.Value();
    selected_value.init(GObject.TYPE_INT);
    selected_value.set_int(selected ? 1 : 0);

    // TODO: see https://gitlab.gnome.org/GNOME/gjs/-/merge_requests/668
    // // @ts-expect-error doesn't need a copy
    // const tab_value = new GObject.Value();
    // tab_value.init(GObject.TYPE_OBJECT);
    // tab_value.set_object(page);
    // // tab_value.set_pointer()
    // button.update_relation([Gtk.AccessibleRelation.CONTROLS], [tab_value]);

    button.active = selected;
    button.update_state([Gtk.AccessibleState.SELECTED], [selected_value]);

    button.connect("notify::active", () => {
      if (button.active) {
        this.tabs.select_item(index, true);
      } else {
        button.active = this.tabs.is_selected(index);
      }
    });

    tab.connect("notify", this.tab_updated_cb.bind(this));

    this.buttons.set(tab, button);

    const separator = Gtk.Separator.new(Gtk.Orientation.VERTICAL);
    separator.set_parent(this);

    (button as any).separator = separator;

    const separator_changed = () => {
      const prev_separator = button.get_prev_sibling();
      const next_separator = button.get_next_sibling();

      if (prev_separator != null) {
        this.update_separator(prev_separator);
      }

      if (next_separator != null) {
        this.update_separator(next_separator);
      }
    };

    button.connect("state-flags-changed", separator_changed.bind(this));

    separator_changed();
  }

  private tab_updated_cb(tab: Tab, pspec: GObject.ParamSpec) {
    const button = this.buttons.get(tab)!;

    this.update_button(tab, button);
  }

  private update_button(tab: Tab, button: Gtk.Button) {
    if (tab.icon != null) {
      button.icon_name = tab.icon;
      button.set_tooltip_text(tab.title);
    } else if (tab.title != null) {
      button.label = tab.title;
      button.set_tooltip_text(null);
    }

    if (tab.navigate != null) {
      button.action_name = "app.navigate";
      button.action_target = GLib.Variant.new_string(tab.navigate);
    }

    // @ts-expect-error doesn't need a copy
    const title_value = new GObject.Value();
    title_value.init(GObject.TYPE_STRING);
    title_value.set_string(tab.title);

    button.update_property([Gtk.AccessibleProperty.LABEL], [title_value]);

    button.visible = tab.title != null || tab.icon != null;
  }

  private should_hide_separators(widget?: Gtk.Widget) {
    if (widget == null) {
      return true;
    }

    const flags = widget.get_state_flags();

    if (
      (flags &
        (Gtk.StateFlags.PRELIGHT | Gtk.StateFlags.SELECTED |
          Gtk.StateFlags.CHECKED)) != 0
    ) {
      return true;
    }

    if (
      (flags & Gtk.StateFlags.FOCUSED) != 0 &&
      (flags & Gtk.StateFlags.FOCUS_VISIBLE) != 0
    ) {
      return true;
    }

    return false;
  }

  private update_separator(separator: Gtk.Widget) {
    const prev_button = separator.get_prev_sibling() as Gtk.Button;
    const next_button = separator.get_next_sibling() as Gtk.Button;

    separator.visible = (prev_button != null) && (next_button != null);

    if (
      this.should_hide_separators(prev_button) ||
      this.should_hide_separators(next_button)
    ) {
      separator.add_css_class("hidden");
    } else {
      separator.remove_css_class("hidden");
    }
  }
}
