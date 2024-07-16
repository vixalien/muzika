import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

interface AddColumnButton extends Gtk.Button {
  listener?: number;
}

export class AddColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass(
      {
        GTypeName: "AddColumn",
        Signals: {
          add: { param_types: [GObject.TYPE_INT] },
        },
      },
      this,
    );
  }

  constructor() {
    super({
      visible: false,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const button = new Gtk.Button({
      icon_name: "list-add-symbolic",
    });

    button.add_css_class("flat");

    list_item.set_child(button);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const button = list_item.child as AddColumnButton;

    button.listener = button.connect("clicked", () => {
      this.emit("add", list_item.position);
    });
  }

  unbind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const button = list_item.child as AddColumnButton;

    if (button.listener) {
      button.disconnect(button.listener);
    }
  }
}
