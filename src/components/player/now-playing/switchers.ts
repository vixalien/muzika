import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { list_model_to_array } from "src/util/list";
import { AddActionEntries } from "src/util/action";
import { SignalListeners } from "src/util/signal-listener";

export class MuzikaNPDetailsSwitcher extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "MuzikaNPDetailsSwitcher",
      Properties: {
        stack: GObject.param_spec_object(
          "stack",
          "View Stack",
          "The view stack to show switchers for",
          Adw.ViewStack.$gtype,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ),
      },
    }, this);
  }

  private stack!: Adw.ViewStack;
  private transient_dialog: Adw.Dialog | null = null;
  private transient_listeners = new SignalListeners();

  constructor(params?: Partial<Gtk.Box.ConstructorProperties>) {
    super({
      homogeneous: true,
      halign: Gtk.Align.CENTER,
      spacing: 3,
      ...params,
    });

    this.setup_actions();
    this.setup_stack();
  }

  private setup_actions() {
    const action_group = new Gio.SimpleActionGroup();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "show-details",
        parameter_type: "s",
        activate: (_source, parameter) => {
          const details = parameter?.get_string()[0];
          if (!details) return;

          this.show_details(details);
        },
      },
    ]);

    this.insert_action_group("details-switcher", action_group);
  }

  private clear_children() {
    let child: Gtk.Widget | null;
    while (child = this.get_first_child()) child.unparent();
  }

  private setup_stack() {
    this.clear_children();

    list_model_to_array(this.stack.pages)
      .forEach((page) => {
        this.append(this.create_switcher(page as Adw.ViewStackPage));
      });
  }

  private create_switcher(page: Adw.ViewStackPage) {
    const label = new Gtk.Label({
      label: page.title,
      css_classes: ["caption-heading"],
    });

    const icon = new Gtk.Image({
      icon_name: page.icon_name,
    });

    const container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      css_classes: ["switcher-button"],
    });

    container.append(icon);
    container.append(label);

    const button = new Gtk.Button({
      child: container,
      css_classes: ["flat"],
      action_name: "details-switcher.show-details",
      action_target: GLib.Variant.new_string(page.name),
    });

    page.bind_property(
      "visible",
      button,
      "visible",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
    );

    return button;
  }

  private get_dialog() {
    if (this.transient_dialog) return this.transient_dialog;

    const title = new Gtk.Label();
    // @ts-expect-error incorrect types
    this.transient_listeners.add_binding(this.stack.bind_property_full(
      "visible-child",
      title,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      () => {
        return [true, this.stack.get_page(this.stack.visible_child!).title];
      },
      null,
    ));

    const header = new Adw.HeaderBar({
      title_widget: title,
    });

    const toolbar_view = new Adw.ToolbarView();
    toolbar_view.add_top_bar(header);
    toolbar_view.set_content(this.stack);

    return this.transient_dialog = new Adw.Dialog({
      child: toolbar_view,
      presentation_mode: Adw.DialogPresentationMode.BOTTOM_SHEET,
      content_height: 800,
      content_width: 600,
    });
  }

  private show_details(name: string) {
    this.stack.visible_child_name = name;

    this.get_dialog().present(this);
  }

  private clear_transient_dialog() {
    this.transient_listeners.clear();

    if (!this.transient_dialog) return;

    this.transient_dialog.force_close();
    this.transient_dialog = null;
    // pray the dialog is GC'ed
  }

  vfunc_unmap() {
    super.vfunc_unmap();
    this.stack.unparent();
    this.clear_transient_dialog();
  }
}
