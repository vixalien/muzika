import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";

import { PlaylistColumnView } from "./columnview";
import { PlaylistListView } from "./listview";
import { ObjectContainer } from "src/util/objectcontainer";
import { PlaylistItem } from "src/muse";

export class PlaylistItemView extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItemView",
      Properties: {
        model: GObject.ParamSpec.object(
          "model",
          "Model",
          "The list model this view is displaying",
          GObject.ParamFlags.READWRITE,
          Gio.ListModel.$gtype,
        ),
        "show-rank": GObject.ParamSpec.boolean(
          "show-rank",
          "Show Rank",
          "Whether to show the rank of the playlist item",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        "show-column": GObject.ParamSpec.boolean(
          "show-column",
          "Show Column",
          "Whether to show the column view",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        album: GObject.ParamSpec.boolean(
          "album",
          "Album",
          "Whether this view is displaying an album",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        "selection-mode": GObject.ParamSpec.boolean(
          "selection-mode",
          "Selection Mode",
          "Whether this view is in selection mode",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
    }, this);
  }

  // property: selection-mode

  get selection_mode() {
    return this._column_view.selection_mode;
  }

  set selection_mode(value: boolean) {
    this._column_view.selection_mode = value;
    this._list_view.selection_mode = value;

    if (this.selection_mode == false) {
      this.multi_selection_model?.unselect_all();
    }
  }

  // property: playlistId

  private _playlistId?: string;

  get playlistId() {
    return this._playlistId;
  }

  set playlistId(playlistId: string | undefined) {
    if (!playlistId) return;

    this._playlistId = playlistId;

    this._column_view.playlistId = playlistId;
    this._list_view.playlistId = playlistId;

    this.update();
  }

  private _album = false;

  get album() {
    return this._album;
  }

  set album(album: boolean) {
    this._album = album;

    this._column_view.album = album;
    this._list_view.album = album;

    this.update();
  }

  private _model: Gio.ListModel | null = null;

  get model() {
    return this._model;
  }

  multi_selection_model:
    | Gtk.MultiSelection<ObjectContainer<PlaylistItem>>
    | null = null;

  set model(model: Gio.ListModel | null) {
    this._model = model;

    this.multi_selection_model = new Gtk.MultiSelection({
      model: model as any,
    });

    this._list_view.model = this.multi_selection_model;
    this._column_view.model = this.multi_selection_model;
  }

  private _list_view: PlaylistListView;
  private _column_view: PlaylistColumnView;

  get show_rank() {
    return this._column_view.show_rank;
  }

  set show_rank(show: boolean) {
    this._column_view.show_rank = show;
  }

  constructor(options: PlaylistItemViewOptions = {}) {
    super({
      vhomogeneous: false,
      hhomogeneous: false,
    });

    this._list_view = new PlaylistListView();
    this._column_view = new PlaylistColumnView();

    this.add_named(this._list_view, "list");
    this.add_named(this._column_view, "column");

    if (options.model) this.model = options.model;
  }

  get show_column() {
    return this.get_visible_child_name() === "column";
  }

  set show_column(column: boolean) {
    this.set_visible_child_name(column ? "column" : "list");
  }

  editable = false;

  update() {
    if (!this._model) return;

    for (let i = 0; i < this._model.get_n_items(); i++) {
      const item = this._model.get_item(i);
      if (item) item.notify("item");
    }
  }
}

export interface PlaylistItemViewOptions {
  model?: Gio.ListModel;
}
