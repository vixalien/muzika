import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

export type ActionEntry = {
  name: string;
  parameter_type?: string;
  state?: string;
  activate?: (
    _source: Gio.SimpleAction,
    parameter: GLib.Variant | null,
  ) => void;
  change_state?: (
    _source: Gio.SimpleAction,
    value: GLib.Variant | null,
  ) => void;
};

export type AddActionEntries = (entries: ActionEntry[]) => void;

export interface ActionDeclaration {
  name: string;
  parameter_type: GLib.VariantType<any> | null;
  state?: GLib.Variant<any> | null;
  activate?(action: Gio.SimpleAction, parameter: GLib.Variant<any>): void;
  bind_state_full?: [
    object: GObject.Object,
    property: string,
    transform: (
      binding: GObject.Binding,
      from_value: any,
    ) => [boolean, GLib.Variant],
  ];
}

export function build_action(decl: ActionDeclaration) {
  const action = new Gio.SimpleAction({
    name: decl.name,
    parameter_type: decl.parameter_type ?? null as any,
    state: decl.state ?? undefined,
  });

  if (decl.activate) action.connect("activate", decl.activate);

  if (decl.bind_state_full) {
    const [object, property, transform] = decl.bind_state_full;

    // @ts-expect-error incorrect types
    object.bind_property_full(
      property,
      action,
      "state",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.DEFAULT,
      transform,
      null,
    );
  }

  return action;
}
