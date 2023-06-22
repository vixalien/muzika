import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";

import { PlaylistColumnView } from "./columnview";
import { PlaylistListView } from "./listview";

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
      },
    }, this);
  }

  private _playlistId?: string;

  get playlistId() {
    return this._playlistId;
  }

  set playlistId(playlistId: string | undefined) {
    if (!playlistId) return;

    this._playlistId = playlistId;
    this._column_view.playlistId = playlistId;
    this.regenerate_list_view();
  }

  private _album = false;

  get album() {
    return this._album;
  }

  set album(album: boolean) {
    this._album = album;
    this._column_view.album = album;
    this.regenerate_list_view();
  }

  private _model: Gio.ListModel | null = null;

  get model() {
    return this._model;
  }

  set model(model: Gio.ListModel | null) {
    this._model = model;

    const selection_model = new Gtk.SingleSelection({
      model: model as any,
      autoselect: false,
    });

    this._list_view.model = selection_model;
    this._column_view.model = selection_model;
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

  private regenerate_list_view() {
    const list_view = new PlaylistListView();
    list_view.model = this._list_view.model;
    list_view.album = this.album;
    list_view.playlistId = this.playlistId;

    this.remove(this._list_view);

    this._list_view = list_view;
    this.add_named(list_view, "list");
  }
}

export interface PlaylistItemViewOptions {
  model?: Gio.ListModel;
}
