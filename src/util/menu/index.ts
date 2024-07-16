import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";

export interface MenuItemPropsObject {
  label: string;
  detailed_action: string;
}

export type MenuItemPropsArray = [label: string, detailed_action: string];

function is_menu_item_props_array(
  item: MenuItemProps,
): item is MenuItemPropsArray {
  return Array.isArray(item);
}

interface MenuSubmenu {
  submenu: string | null;
  items: MenuItemProps[];
}

interface MenuSection {
  section: string | null;
  items: MenuItemProps[];
}

/**
 * MenuItemProps can either be an array of label and action or a full blown
 * object of properties
 */
export type MenuItemProps =
  | Gio.MenuItem
  | MenuItemPropsObject
  | MenuItemPropsArray
  | null;

export type MenuArraySection = MenuItemProps[];

export type MenuProp =
  | MenuItemProps
  | MenuArraySection
  | MenuSubmenu
  | MenuSection;

function is_gio_menu_item(item: unknown): item is Gio.MenuItem {
  return typeof item === "object" && item instanceof Gio.MenuItem;
}

function is_submenu(item: NonNullable<MenuProp>): item is MenuSubmenu {
  return typeof item === "object" && Object.hasOwn(item, "submenu");
}

function is_section(item: NonNullable<MenuProp>): item is MenuSection {
  return typeof item === "object" && Object.hasOwn(item, "section");
}

function is_array_section(
  item: NonNullable<MenuProp>,
): item is MenuArraySection {
  return Array.isArray(item) && item.length > 0 && typeof item[0] != "string";
}

function generate_menu_item(props: NonNullable<MenuItemProps>) {
  if (is_menu_item_props_array(props)) {
    return Gio.MenuItem.new(props[0], props[1]);
  } else {
    const item = new Gio.MenuItem();

    for (const [key, value] of Object.entries(props)) {
      let variant: GLib.Variant | null = null;

      switch (typeof value) {
        case "string":
          variant = GLib.Variant.new_string(value);
          break;
      }

      if (variant instanceof GLib.Variant) {
        item.set_attribute_value(key, variant);
      }
    }

    return item;
  }
}

function filter_null<T>(menu_props: T[]) {
  return menu_props.filter((prop) => prop !== null) as NonNullable<T>[];
}

type PopoverChildFn = (popover: Gtk.Popover) => Gtk.Widget;

type PopoverChildren = Record<string, PopoverChildFn>;

export type MenuItemWithChild = Gio.MenuItem & { __child: PopoverChildFn };

export type MenuWithChildren = Gio.Menu & { children: PopoverChildren };

export function generate_menu(props: MenuProp[]) {
  const menu = new Gio.Menu();

  const children: PopoverChildren = {};

  (menu as MenuWithChildren).children = children;

  filter_null(props).forEach((item) => {
    if (is_gio_menu_item(item)) {
      menu.append_item(item);

      if (item.get_attribute_value("custom", GLib.VariantType.new("s"))) {
        const child = item.get_attribute_value("custom", null)?.get_string()[0];
        if (!child) return;
        children[child] = (item as MenuItemWithChild)["__child"];
      }
    } else if (is_submenu(item)) {
      const submenu = new Gio.Menu();

      filter_null(item.items).forEach((item) => {
        submenu.append_item(generate_menu_item(item));
      });

      menu.append_submenu(item.submenu, submenu);
    } else if (is_section(item)) {
      const section = new Gio.Menu();

      filter_null(item.items).forEach((item) => {
        section.append_item(generate_menu_item(item));
      });

      menu.append_section(item.section, section);
    } else if (is_array_section(item)) {
      const section = new Gio.Menu();

      filter_null(item).forEach((item) => {
        section.append_item(generate_menu_item(item));
      });

      menu.append_section(null, section);
    } else if (Array.isArray(item) && item.length === 2) {
      menu.append_item(generate_menu_item(item));
    }
  });

  return menu;
}

export interface MenuHelperProps {
  widget: Gtk.Widget;
  setup_controllers?: boolean;
}

export class MenuHelper {
  widget: Gtk.Widget;

  constructor(props: MenuHelperProps) {
    this.widget = props.widget;

    if (props.setup_controllers !== false) {
      this.setup_controllers();
    }
  }

  static new(widget: Gtk.Widget, setup_controllers?: boolean) {
    return new this({
      widget,
      setup_controllers,
    });
  }

  private setup_controllers() {
    const click = new Gtk.GestureClick({
      button: 3,
    });

    click.connect("pressed", (click, _n, x, y) => {
      const props = this.get_props();
      if (!props) return;

      click.set_state(Gtk.EventSequenceState.CLAIMED);

      this.show_popover_menu(x, y, props);
    });

    this.widget.add_controller(click);

    const long_press = new Gtk.GestureLongPress({
      touch_only: true,
    });

    long_press.connect("pressed", (long_press, x, y) => {
      const props = this.get_props();
      if (!props) return;

      long_press.set_state(Gtk.EventSequenceState.CLAIMED);

      this.show_popover_menu(x, y, props);
    });

    this.widget.add_controller(long_press);
  }

  props: MenuProp[] | null = null;

  private get_props() {
    if (this._builder) {
      return this._builder();
    }

    return this.props;
  }

  popover_menu: Gtk.PopoverMenu | null = null;

  private show_popover_menu(x: number, y: number, props: MenuProp[]) {
    if (!props) return;

    if (this.popover_menu) {
      this.popover_menu.popdown();
      this.popover_menu.unparent();
      this.popover_menu = null;
    }

    const menu = generate_menu(props);

    this.popover_menu = new Gtk.PopoverMenu({
      has_arrow: false,
      valign: Gtk.Align.START,
      position: Gtk.PositionType.RIGHT,
      menu_model: menu,
    });

    // generate and set custom popover children
    const children = (menu as MenuWithChildren).children as PopoverChildren;
    if (children && Object.keys(children).length > 0) {
      for (const [name, child] of Object.entries(children)) {
        this.popover_menu.add_child(child(this.popover_menu), name);
      }
    }

    this.popover_menu.set_parent(this.widget);
    this.popover_menu.set_pointing_to(new Gdk.Rectangle({ x, y }));
    this.popover_menu.popup();
  }

  private _builder: PropsBuilder | null = null;

  set_builder(builder: PropsBuilder) {
    this._builder = builder;
  }
}

export type PropsBuilder = () => MenuProp[];
