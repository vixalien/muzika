import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

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

export function get_selected<T extends GObject.Object>(
  model: Gtk.SelectionModel<T>,
) {
  const items = model.get_selection().get_size();

  if (items <= 0) {
    return [];
  }

  const selected: number[] = [];

  const [, bitset] = Gtk.BitsetIter.init_first(model.get_selection());

  while (bitset.is_valid()) {
    selected.push(bitset.get_value());

    bitset.next();
  }

  return selected;
}
