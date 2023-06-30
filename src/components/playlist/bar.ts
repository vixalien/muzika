import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { ngettext } from "gettext";

import { ObjectContainer } from "src/util/objectcontainer";
import { PlaylistItem } from "libmuse";

const vprintf = imports.format.vprintf;

export class PlaylistBar extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistBar",
      Template: "resource:///com/vixalien/muzika/ui/components/playlist/bar.ui",
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
    }, this);
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
  }

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

  private _model: Gtk.SelectionModel<ObjectContainer<PlaylistItem>> = Gtk
    .NoSelection.new(
      Gio.ListStore.new(Gtk.Widget.$gtype),
    );

  get model() {
    return this._model;
  }

  set model(value: Gtk.SelectionModel<ObjectContainer<PlaylistItem>>) {
    this._model = value;
    this._model.connect("selection-changed", () => {
      this.update_selection();
    });
  }

  private update_model() {
    const items = this.model.get_selection().get_size();

    const selected: (PlaylistItem | null)[] = [];

    const [has_selection, bitset, first] = Gtk.BitsetIter.init_first(
      this.model.get_selection(),
    );

    if (has_selection) {
      selected.push(this.model.get_item(first)?.item ?? null);

      while (bitset.next()[0]) {
        selected.push(
          this.model.get_item(bitset.get_value())?.item ?? null,
        );
      }
    }

    const selected_filtered = selected.filter((item) =>
      item !== null
    ) as PlaylistItem[];
    const ids = selected_filtered.map((item) => item.videoId).join(",");

    if (items > 0) {
      const model = Gio.Menu.new();

      model.append(_("Play next"), `queue.add-song("${ids}?next=true")`);
      model.append(_("Add to queue"), `queue.add-song("${ids}")`);
      this._more.set_menu_model(model);
    } else {
      this._more.set_menu_model(null);
    }
  }

  update_selection() {
    const items = this.model.get_selection().get_size();

    if (items > 1 || this.selection_mode) {
      this.revealed = true;

      this._label.label = items === 0 ? _("No song selected") : ngettext(
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
