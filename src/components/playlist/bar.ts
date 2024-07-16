import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { ngettext } from "gettext";

import type { PlaylistItem } from "libmuse";

import { ObjectContainer } from "src/util/objectcontainer";
import { get_selected } from "src/util/list";

const vprintf = imports.format.vprintf;

export class PlaylistBar extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "PlaylistBar",
        Template:
          "resource:///com/vixalien/muzika/ui/components/playlist/bar.ui",
        InternalChildren: ["select_all", "label", "more", "delete", "revealer"],
        Properties: {
          "selection-mode": GObject.param_spec_boolean(
            "selection-mode",
            "Selection Mode",
            "Whether this bar is in selection mode",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          editable: GObject.param_spec_boolean(
            "editable",
            "Editable",
            "Whether the playlist is editable",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          model: GObject.param_spec_object(
            "model",
            "Model",
            "The list model this bar is displaying",
            Gtk.SelectionModel.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          revealed: GObject.param_spec_boolean(
            "revealed",
            "Revealed",
            "Whether this bar is revealed",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  private _select_all!: Gtk.ToggleButton;
  private _label!: Gtk.Label;
  private _more!: Gtk.MenuButton;
  private _delete!: Gtk.Button;
  private _revealer!: Gtk.Revealer;

  constructor() {
    super();

    this._select_all.connect("toggled", () => {
      if (this._select_all.active) {
        this._model.select_all();
      } else {
        this._model.unselect_all();
      }
    });

    // this._delete.connect("clicked", () => {
    //   this.delete_selected();
    // });
  }

  playlistId: string | null = null;

  // property: revealed

  get revealed() {
    return this._revealer.reveal_child;
  }

  set revealed(value: boolean) {
    this._revealer.reveal_child = value;
  }

  // property: selection-mode

  private _selection_mode = false;

  get selection_mode() {
    return this._selection_mode;
  }

  set selection_mode(value: boolean) {
    this._selection_mode = value;
    this._select_all.active = false;
    this.update_selection();
  }

  // property: editable

  private _editable = false;

  get editable() {
    return this._editable;
  }

  set editable(value: boolean) {
    this._editable = value;
    this._delete.visible = value;
  }

  // property: model

  private _model: Gtk.SelectionModel<ObjectContainer<PlaylistItem>> =
    Gtk.NoSelection.new(
      Gio.ListStore.new(Gtk.Widget.$gtype),
    ) as Gtk.NoSelection<ObjectContainer<PlaylistItem>>;

  get model() {
    return this._model;
  }

  set model(value: Gtk.SelectionModel<ObjectContainer<PlaylistItem>>) {
    this._model = value;

    this._model.connect("items-changed", () => {
      this.update_selection();
    });

    this._model.connect("selection-changed", () => {
      this.update_selection();
    });
  }

  private update_model() {
    const positions = get_selected(this.model);

    const items = positions
      .map((position) => this.model.get_item(position)?.object)
      .filter((item) => item != null) as PlaylistItem[];

    const ids = items.map((item) => item.videoId).join(",");

    if (items.length > 0) {
      this._delete.sensitive = this.editable;
      const variant = GLib.Variant.new_array(
        GLib.VariantType.new("i"),
        positions.map((pos) => GLib.Variant.new_int32(pos)),
      );
      this._delete.action_target = variant;
      this._delete.action_name = `playlist.remove-tracks`;

      const model = Gio.Menu.new();

      model.append(_("Play next"), `queue.add-song("${ids}?next=true")`);
      model.append(_("Add to queue"), `queue.add-song("${ids}")`);
      model.append(_("Save to playlist"), `win.add-to-playlist("${ids}")`);

      this._more.set_menu_model(model);
    } else {
      this._delete.sensitive = false;
      this._more.set_menu_model(null);
    }
  }

  update_selection() {
    const items = this.model.get_selection().get_size();

    if (items > 1 || this.selection_mode) {
      this.revealed = true;

      this._label.label =
        items === 0
          ? _("No song selected")
          : ngettext(
              vprintf(_("%d song selected"), [items]),
              vprintf(_("%d songs selected"), [items]),
              items,
            );

      this.update_model();
    } else {
      this.revealed = false;
    }
  }
}
