import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

export enum DynamicActionState {
  DEFAULT,
  LOADING,
  PLAYING,
  PAUSED,
}

export interface DynamicActionConstructorProperties
  extends Adw.Bin.ConstructorProperties {
  size: number;
  state: DynamicActionState;
  fill: boolean;
  persistent_play_button: boolean;
  hovering: boolean;
}

export function get_state_pspec() {
  return GObject.ParamSpec.uint(
    "state",
    "State",
    "The current playback state",
    GObject.ParamFlags.READWRITE,
    DynamicActionState.DEFAULT,
    DynamicActionState.PAUSED,
    DynamicActionState.DEFAULT,
  );
}

export class DynamicAction extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "DynamicAction",
        Template:
          "resource:///com/vixalien/muzika/ui/components/dynamic-action.ui",
        InternalChildren: [
          "stack",
          "play",
          "pause",
          "persistent_play",
          "loading",
          "pause_image",
          "play_image",
          "persistent_play_image",
          "wave",
          "spinner",
        ],
        Properties: {
          size: GObject.ParamSpec.int(
            "size",
            "Size",
            "The size of the dynamic action. This will only have effect if `fill` is set to `true`",
            GObject.ParamFlags.READWRITE,
            -1,
            1000000,
            48,
          ),
          state: get_state_pspec(),
          fill: GObject.ParamSpec.boolean(
            "fill",
            "Fill",
            "If this dynamic action should fill the container or just display at the bottom right edge",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          locked: GObject.ParamSpec.boolean(
            "locked",
            "Static",
            "If this dynamic action should stop updating it's state",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          hovering: GObject.ParamSpec.boolean(
            "hovering",
            "Hovering",
            "Whether the mouse is hovering over this dynamic action",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          "persistent-play-button": GObject.ParamSpec.boolean(
            "persistent-play-button",
            "Persistent Play Button",
            "Whether to show the play button even when the song is not paused",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
        Signals: {
          play: {},
          pause: {},
        },
      },
      this,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(props?: Partial<DynamicActionConstructorProperties>) {
    super(props);
  }

  private _stack!: Gtk.Stack;
  private _play!: Gtk.Button;
  private _persistent_play!: Gtk.Button;
  private _pause!: Gtk.Button;
  private _loading!: Adw.Bin;
  private _pause_image!: Gtk.Image;
  private _play_image!: Gtk.Image;
  private _persistent_play_image!: Gtk.Image;
  private _wave!: Gtk.Image;
  /// @ts-expect-error outdated types
  private _spinner!: Adw.Spinner;

  private images = [
    this._play_image,
    this._pause_image,
    this._persistent_play_image,
    this._wave,
  ];

  // property: hovering

  private _hovering = false;

  get hovering() {
    return this._hovering;
  }

  set hovering(hovering: boolean) {
    if (hovering == this._hovering) return;

    this._hovering = hovering;
    this.update_stack();
  }

  // property: fill

  private _fill = false;

  get fill() {
    return this._fill;
  }

  set fill(fill: boolean) {
    if (fill == this._fill) return;

    this._fill = fill;

    const top_widgets = [
      this._play,
      this._pause,
      this._persistent_play,
      this._loading,
      this._wave,
    ];

    set_properties(
      this._stack,
      ["halign", "valign"],
      fill ? Gtk.Align.FILL : Gtk.Align.END,
    );
    set_properties(this._stack, ["margin_bottom", "margin_end"], fill ? 0 : 6);

    this._spinner.halign = fill ? Gtk.Align.CENTER : Gtk.Align.FILL;

    if (fill) {
      top_widgets.forEach((widget) => {
        widget.remove_css_class("floating-button");
      });
    } else {
      top_widgets.forEach((widget) => {
        widget.add_css_class("floating-button");
      });
    }

    this.update_sizing();
  }

  // property: size

  private _size = 48;

  get size() {
    return this._size;
  }

  set size(size: number) {
    if (size == this._size) return;

    this._size = size;
    this.update_sizing();
  }

  // property: state

  private _state: DynamicActionState = DynamicActionState.DEFAULT;

  get state() {
    return this._state;
  }

  set state(state: DynamicActionState) {
    if (state == this._state) return;

    this._state = state;
    this.update_stack();
    this.update_sizing();
  }

  private update_stack(force = false) {
    if (this.locked && !force) return;

    let visible = true;

    switch (this.state) {
      case DynamicActionState.DEFAULT:
        if (this.hovering) {
          this._stack.visible_child = this._play;
        } else {
          if (this.persistent_play_button) {
            this._stack.visible_child = this._persistent_play;
          } else {
            visible = false;
          }
        }
        break;
      case DynamicActionState.LOADING:
        this._stack.visible_child = this._loading;
        break;
      case DynamicActionState.PLAYING:
        if (this.hovering) {
          this._stack.visible_child = this._pause;
        } else {
          this._stack.visible_child = this._wave;
        }
        break;
      case DynamicActionState.PAUSED:
        this._stack.visible_child = this._play;
        break;
    }

    this._stack.visible = visible;
  }

  // property: persistent-play-button

  private _persistent_play_button = false;

  get persistent_play_button() {
    return this._persistent_play_button;
  }

  set persistent_play_button(persistent_play_button: boolean) {
    if (persistent_play_button == this._persistent_play_button) return;

    this._persistent_play_button = persistent_play_button;

    this.update_stack();
    this.update_sizing();
  }

  update_sizing() {
    const size = this._fill ? this._size : 16;

    set_properties(this.images, "pixel_size", size);
    set_properties(this._spinner, ["width_request", "height_request"], size);
  }

  // property: locked

  private _locked = false;

  get locked() {
    return this._locked;
  }

  set locked(is_locked: boolean) {
    if (is_locked == this._locked) return;

    this._locked = is_locked;

    if (is_locked) {
      this.state = DynamicActionState.DEFAULT;
    }

    this.update_stack(true);
  }

  private play_cb() {
    this.emit("play");
  }

  private pause_cb() {
    this.emit("pause");
  }
}

function set_properties<
  T extends GObject.Object,
  Prop extends keyof T,
  Value extends T[Prop],
>(object: T | T[], key: Prop | Prop[], value: Value) {
  ([object].flat() as T[]).forEach((object) => {
    ([key].flat() as Prop[]).forEach((key) => {
      object[key] = value;
    });
  });
}
