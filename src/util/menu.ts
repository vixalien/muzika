import Gio from "gi://Gio";
import GLib from "gi://GLib";

export interface MenuItemPropsObject {
  label: string;
  detailed_action: string;
}

export type MenuItemPropsArray = [label: string, detailed_action: string];

/**
 * MenuItemProps can either be an array of label and action or a full blown
 * object of properties
 */
export type MenuItemProps = MenuItemPropsObject | MenuItemPropsArray | null;

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

export type MenuProp = MenuItemProps | MenuSubmenu | MenuSection;

function is_submenu(
  item: NonNullable<MenuProp>,
): item is MenuSubmenu {
  return typeof item === "object" && Object.hasOwn(item, "submenu");
}

function is_section(
  item: NonNullable<MenuProp>,
): item is MenuSection {
  return typeof item === "object" && Object.hasOwn(item, "section");
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

function filter_null<T extends any>(menu_props: T[]) {
  return menu_props.filter((prop) => prop !== null) as NonNullable<T>[];
}

export function generate_menu(props: MenuProp[]) {
  const menu = new Gio.Menu();

  filter_null(props).forEach((item) => {
    if (is_submenu(item)) {
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
    } else {
      menu.append_item(generate_menu_item(item));
    }
  });

  return menu;
}
