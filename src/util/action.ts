import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

export interface ActionEntry {
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
}

export type AddActionEntries = (entries: ActionEntry[]) => void;

export interface ActionDeclaration {
  name: string;
  parameter_type: GLib.VariantType | null;
  state?: GLib.Variant | null;
  activate?(action: Gio.SimpleAction, parameter: GLib.Variant): void;
  change_state?(action: Gio.SimpleAction, parameter: GLib.Variant): void;
  bind_state_full?: [
    object: GObject.Object,
    property: string,
    transform: (
      binding: GObject.Binding,
      from_value: unknown,
    ) => [boolean, GLib.Variant | null],
  ];
  bind_enabled?: [object: GObject.Object, property: string];
  bind_enabled_full?: BindingParams<boolean>;
}

export function build_action(decl: ActionDeclaration) {
  const action = new Gio.SimpleAction({
    name: decl.name,
    // @ts-expect-error incorrect TS types
    parameter_type: decl.parameter_type ?? null,
    // @ts-expect-error incorrect TS types
    state: decl.state ?? null,
  });

  if (decl.change_state) action.connect("change-state", decl.change_state);

  if (decl.activate) action.connect("activate", decl.activate);

  if (decl.bind_state_full) {
    const [object, property, transform] = decl.bind_state_full;

    // @ts-expect-error incorrect types
    object.bind_property_full(
      property,
      action,
      "state",
      GObject.BindingFlags.DEFAULT,
      transform,
      null,
    );
  }

  if (decl.bind_enabled) {
    const [object, property] = decl.bind_enabled;

    object.bind_property(
      property,
      action,
      "enabled",
      GObject.BindingFlags.SYNC_CREATE,
    );
  }

  if (decl.bind_enabled_full) {
    const [object, property, transform] = decl.bind_enabled_full;

    // @ts-expect-error incorrect types
    object.bind_property_full(
      property,
      action,
      "enabled",
      GObject.BindingFlags.SYNC_CREATE,
      (binding, param) => {
        return [true, transform(binding, param)];
      },
      null,
    );
  }

  return action;
}

export interface PropertyActionDeclaration {
  name: string;
  object: GObject.Object;
  signature: string;
  bind_enabled?: ActionDeclaration["bind_enabled"];
  bind_enabled_full?: BindingParams<boolean>;
}

// A convenience while https://gitlab.gnome.org/GNOME/glib/-/issues/3471
export function build_property_action({
  object: _object,
  name,
  signature,
  bind_enabled,
  bind_enabled_full,
}: PropertyActionDeclaration) {
  const object = _object as unknown as GObject.Object & Record<string, unknown>;

  return build_action({
    name,
    parameter_type: GLib.VariantType.new(signature),
    state: GLib.Variant.new(signature, object[name]),
    change_state: (_, param) => {
      object[name] = param.unpack() as boolean;
    },
    bind_enabled,
    bind_enabled_full,
    bind_state_full: [
      object,
      name,
      () => {
        return [true, GLib.Variant.new(signature, object[name])];
      },
    ],
  });
}

type BindingCallback<Result = unknown> = (
  binding: GObject.Binding,
  from_value: unknown,
) => Result;

type GBindingCallback = (
  binding: GObject.Binding,
  from_value: unknown,
) => [boolean, GLib.Variant | null];

function get_transform_to_fn(
  signature: string,
  fn: BindingCallback,
): GBindingCallback {
  return (...params) => {
    try {
      const result = fn(...params);
      console.log("result", result, signature);
      return [true, GLib.Variant.new(signature, result)] as const;
    } catch {
      return [false, null] as const;
    }
  };
}

type BindingParams<Result = unknown> = [
  object: GObject.Object,
  property: string,
  transform: BindingCallback<Result>,
];

type GBindingParams = [
  object: GObject.Object,
  property: string,
  transform: GBindingCallback,
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function get_binding_params(
  signature: string,
  [object, property, transform]: BindingParams,
): GBindingParams {
  return [object, property, get_transform_to_fn(signature, transform)];
}
