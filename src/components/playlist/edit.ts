import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";

import { edit_playlist } from "libmuse";
import type { Playlist } from "libmuse";

import { ObjectContainer } from "src/util/objectcontainer";
import { add_toast } from "src/util/window";

export class PrivacyStatus extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: "PrivacyStatus",
        Properties: {
          id: GObject.ParamSpec.string(
            "id",
            "ID",
            "The unique ID of the privacy status",
            GObject.ParamFlags.READWRITE,
            "",
          ),
          name: GObject.ParamSpec.string(
            "name",
            "Name",
            "Translated name of the privacy status",
            GObject.ParamFlags.READWRITE,
            "",
          ),
          description: GObject.ParamSpec.string(
            "description",
            "description",
            "Translated description of the privacy status",
            GObject.ParamFlags.READWRITE,
            "",
          ),
        },
      },
      this,
    );
  }

  constructor(
    public id: string,
    public name: string,
    public description: string,
  ) {
    super();
  }
}

export interface IPrivacyStatus {
  id: string;
  name: string;
  description: string;
}

export interface EditedValues {
  title: string;
  description: string;
  privacy: PrivacyStatus;
}

const privacy_model = new Gio.ListStore<PrivacyStatus>();

privacy_model.append(
  new PrivacyStatus("PUBLIC", _("Public"), _("Anyone can search for and view")),
);

privacy_model.append(
  new PrivacyStatus(
    "UNLISTED",
    _("Unlisted"),
    _("Anyone with the link can view"),
  ),
);

privacy_model.append(
  new PrivacyStatus("PRIVATE", _("Private"), _("Only you can view")),
);

export class EditPlaylistDialog extends Adw.PreferencesDialog {
  static {
    GObject.registerClass(
      {
        GTypeName: "EditPlaylistDialog",
        Template:
          "resource:///com/vixalien/muzika/ui/components/playlist/edit.ui",
        InternalChildren: ["title", "description", "privacy", "save"],
        Signals: {
          saved: {
            param_types: [GObject.TYPE_OBJECT],
          },
        },
      },
      this,
    );
  }

  private _title!: Adw.EntryRow;
  private _description!: Adw.EntryRow;
  private _privacy!: Adw.ComboRow;
  private _save!: Gtk.Button;

  constructor(private playlist: Playlist) {
    super();

    this._title.text = playlist.title;
    this._description.text = playlist.description ?? "";

    this.setup_privacy();
  }

  private setup_privacy() {
    this._privacy.model = privacy_model;

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.factory_setup_cb.bind(this));
    factory.connect("bind", this.factory_bind_cb.bind(this));

    this._privacy.factory = factory;

    const list_factory = Gtk.SignalListItemFactory.new();
    list_factory.connect("setup", this.list_factory_setup_cb.bind(this));
    list_factory.connect("bind", this.list_factory_bind_cb.bind(this));

    this._privacy.list_factory = list_factory;
  }

  // factory

  private factory_setup_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const label = new Gtk.Label({ xalign: 0 });

    list_item.child = label;
  }

  private factory_bind_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const container = list_item.item as PrivacyStatus;
    const label = list_item.child as Gtk.Label;

    label.label = container.name;
  }

  // list factory

  private list_factory_setup_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const box = new PrivacyBox();

    list_item.child = box;
  }

  private list_factory_bind_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const container = list_item.item as PrivacyStatus;
    const box = list_item.child as PrivacyBox;

    box.title.label = container.name;
    box.description.label = container.description;
  }

  private get_values(): EditedValues {
    const selected_item = this._privacy.selectedItem as PrivacyStatus;

    return {
      title: this._title.text,
      description: this._description.text,
      privacy: selected_item,
    };
  }

  private async save_cb() {
    const values = this.get_values();

    await edit_playlist(this.playlist.id, {
      title: values.title,
      description: values.description,
      privacy_status: values.privacy.id as Playlist["privacy"],
    });

    add_toast(_("Playlist saved"));

    this.emit("saved", new ObjectContainer(values));
    this.close();
  }
}

class PrivacyBox extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "PrivacyBox",
      },
      this,
    );
  }

  title!: Gtk.Label;
  description!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.title = new Gtk.Label({ xalign: 0 });

    this.description = new Gtk.Label({ xalign: 0 });
    this.description.add_css_class("caption");
    this.description.add_css_class("dim-label");

    this.append(this.title);
    this.append(this.description);
  }
}
