import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { PlaylistColumnView } from "./columnview";
import { PlaylistListView } from "./listview";
import { PlayableContainer, PlayableList } from "src/util/playablelist";
import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";

export class PlaylistItemView extends Adw.Bin {
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
        "show-artists": GObject.ParamSpec.boolean(
          "show-artists",
          "Show Artists",
          "Whether to show the artists of each track",
          GObject.ParamFlags.READWRITE,
          true,
        ),
        "show-time": GObject.ParamSpec.boolean(
          "show-time",
          "Show Time",
          "Whether to show the duration of each track",
          GObject.ParamFlags.READWRITE,
          true,
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
        "show-add": GObject.param_spec_boolean(
          "show-add",
          "Show Add",
          "Show Add button",
          true,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "add": {
          param_types: [GObject.TYPE_OBJECT],
        },
      },
    }, this);
  }

  private get_current_child() {
    return this.child as CurrentChild;
  }

  private get_current_property<Key extends keyof CurrentChild>(property: Key) {
    return this.get_current_child()[property];
  }

  private set_current_property<Key extends keyof CurrentChild>(
    property: Key,
    value: CurrentChild[Key],
  ) {
    return this.get_current_child()[property] = value;
  }

  // property: selection-mode

  private _selection_mode = false;

  get selection_mode() {
    return this._selection_mode;
  }

  set selection_mode(value: boolean) {
    this._selection_mode = value;
    this.set_current_property("selection_mode", value);

    if (value == false) {
      this.multi_selection_model?.unselect_all();
    }
  }

  // property: playlistId

  private _playlistId?: string;

  get playlistId() {
    return this._playlistId;
  }

  set playlistId(playlistId: string | undefined) {
    this._playlistId = playlistId;

    this.set_current_property("playlistId", playlistId);
  }

  // property: album

  private _album = false;

  get album() {
    return this._album;
  }

  set album(album: boolean) {
    this._album = album;

    this.set_current_property("album", album);
  }

  // property: model

  private _model: Gio.ListModel | null = null;

  get model() {
    return this._model as PlayableList;
  }

  multi_selection_model: Gtk.MultiSelection<PlayableContainer> | null = null;

  set model(model: PlayableList | null) {
    this.clear_listeners();

    this._model = model;

    this.multi_selection_model = new Gtk.MultiSelection({
      model: model as any,
    });

    this.set_current_property("model", this.multi_selection_model!);

    this.setup_listeners();
  }

  // property: show-rank

  private _show_rank = false;

  get show_rank() {
    return this._show_rank;
  }

  set show_rank(show: boolean) {
    this._show_rank = show;

    const child = this.child as CurrentChild;

    if (child instanceof PlaylistColumnView) {
      child.show_rank = show;
    }
  }

  // property: show-artists

  private _show_artists = true;

  get show_artists() {
    return this._show_artists;
  }

  set show_artists(show: boolean) {
    this._show_artists = show;

    const child = this.child as CurrentChild;

    if (child instanceof PlaylistColumnView) {
      child.show_artists = show;
    }
  }

  // property: show-time

  private _show_time = true;

  get show_time() {
    return this._show_time;
  }

  set show_time(show: boolean) {
    this._show_time = show;

    const child = this.child as CurrentChild;

    if (child instanceof PlaylistColumnView) {
      child.show_time = show;
    }
  }

  // property: show-column

  get show_column() {
    return this.child instanceof PlaylistColumnView;
  }

  set show_column(column: boolean) {
    if (this.child != null && this.show_column === column) {
      return;
    }

    const props = {
      header_factory: this.header_factory ?? null as any,
      model: this.multi_selection_model!,
      selection_mode: this.selection_mode,
      album: this.album,
      show_add: this.show_add,
      playlistId: this.playlistId ?? null as any,
    };

    if (column) {
      this.child = new PlaylistColumnView({
        ...props,
        show_rank: this.show_rank,
        show_artists: this.show_artists,
      });
    } else {
      this.child = new PlaylistListView(
        props,
      );
    }

    this;
  }

  // property: editable

  editable = false;

  // property: show-add

  private _show_add = false;

  get show_add() {
    return this._show_add;
  }

  set show_add(show: boolean) {
    this._show_add = show;

    this.set_current_property("show_add", show);
  }

  // property: header-factory

  private _header_factory: Gtk.ListItemFactory | null = null;

  get header_factory() {
    return this._header_factory;
  }

  set header_factory(factory: Gtk.ListItemFactory | null) {
    this._header_factory = factory;

    this.set_current_property("header_factory", factory!);
  }

  constructor(options: Partial<PlaylistItemViewOptions> = {}) {
    super({
      // vhomogeneous: false,
      // hhomogeneous: false,
    });

    // this._list_view.connect("add", (_list, index) => {
    //   this.add_cb(index);
    // });

    // this._column_view.connect("add", (_list, index) => {
    //   this.add_cb(index);
    // });

    this.show_column = options.show_column ?? false;

    if (options.model) this.model = options.model;
  }

  update() {
    if (!this._model) return;

    for (let i = 0; i < this._model.get_n_items(); i++) {
      const item = this._model.get_item(i);
      if (item) item.notify("item");
    }
  }

  add_cb(index: number) {
    const item = this.model?.get_item(index);

    if (!item || !this.model) return;

    this.model.remove(index);

    this.emit("add", item);
  }

  select_track(index: number | null) {
    if (index == null) {
      return;
    }

    if (index < 0) {
      this.multi_selection_model?.unselect_all();
      return;
    }

    const container = this.model?.get_item(index);

    if (!container || !this.multi_selection_model) return;

    if (
      this.selection_mode ||
      this.multi_selection_model.get_selection().get_size() > 1
    ) {
      return;
    }

    this.multi_selection_model.select_item(index, true);
  }

  /**
   * Select the currently playing track, if it's in this list and there are no
   * tracks already selected
   */
  private update_current_playing() {
    const player = get_player();

    const now_playing = player.queue.current?.object.videoId;

    this.select_track(
      now_playing ? this.model?.find_by_video_id(now_playing) ?? null : null,
    );
  }

  private signals = new SignalListeners();

  private setup_listeners() {
    this.clear_listeners();

    this.model?.setup_listeners();

    const player = get_player();

    this.signals.add(
      player.queue,
      player.queue.connect("notify::current", () => {
        this.update_current_playing();
      }),
    );

    this.update_current_playing();
  }

  private clear_listeners() {
    this.model?.clear_listeners();
    this.signals.clear();
  }

  vfunc_map(): void {
    this.setup_listeners();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.clear_listeners();
    super.vfunc_unmap();
  }
}

export interface PlaylistItemViewOptions {
  model: PlayableList;
  show_column: boolean;
}

type CurrentChild = PlaylistColumnView | PlaylistListView;
