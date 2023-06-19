import Gio from "gi://Gio";
import GObject from "gi://GObject";

/**
 * A helper to turn a `Gio.ListModel` into an array
 */
export function list_model_to_array<T extends GObject.Object>(
  list: Gio.ListModel<T>,
) {
  const items: T[] = [];

  for (let i = 0; i < list.get_n_items(); i++) {
    const item = list.get_item(i);
    if (!item) continue;
    items.push(item);
  }

  return items;
}
