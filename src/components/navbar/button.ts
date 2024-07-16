import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class NavbarButton extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarButton",
        Template:
          "resource:///com/vixalien/muzika/ui/components/navbar/button.ui",
        InternalChildren: ["image", "label"],
        Properties: {
          "icon-name": GObject.ParamSpec.string(
            "icon-name",
            "Icon name",
            "The icon name",
            GObject.ParamFlags.READWRITE,
            "",
          ),
          label: GObject.ParamSpec.string(
            "label",
            "Label",
            "The label",
            GObject.ParamFlags.READWRITE,
            "",
          ),
          link: GObject.ParamSpec.string(
            "link",
            "Link",
            "The link",
            GObject.ParamFlags.READWRITE,
            "",
          ),
          title: GObject.ParamSpec.string(
            "title",
            "Title",
            "Header title",
            GObject.ParamFlags.READWRITE,
            "",
          ),
          "requires-login": GObject.ParamSpec.boolean(
            "requires-login",
            "Requires login",
            "Whether this button is only shown when logged in",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
      },
      this,
    );
  }

  _image!: Gtk.Image;
  _label!: Gtk.Label;

  link: string | null = null;
  title: string | null = null;

  get icon_name(): string {
    return this._image.icon_name;
  }

  set icon_name(name: string) {
    this._image.icon_name = name;
  }

  get label(): string {
    return this._label.label;
  }

  set label(label: string) {
    this._label.label = label;

    this.has_tooltip = this._label.get_layout().is_ellipsized();
    this.tooltip_text = label;
  }

  show_button(button: NavbarButtonContructorProperties) {
    this.icon_name = button.icon_name;
    this.label = button.label;
  }
}

export interface NavbarButtonContructorProperties {
  icon_name: string;
  link: string;
  requires_login?: boolean;
  label: string;
  title?: string;
  pinned?: boolean;
}
