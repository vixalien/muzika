import Gtk from "gi://Gtk?version=4.0";

export type OrientedPair<T> = Record<Gtk.Orientation, T>;

export function orientedPair<T>(
  initial_value: T,
  initial_value2?: T,
): OrientedPair<T> {
  return {
    "0": initial_value,
    "1": initial_value2 || initial_value,
  };
}

export function get_opposite_orientation(orientation: Gtk.Orientation) {
  return orientation === Gtk.Orientation.HORIZONTAL
    ? Gtk.Orientation.VERTICAL
    : Gtk.Orientation.HORIZONTAL;
}
