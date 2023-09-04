import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { PlaylistListItem } from "./listitem";
import { DynamicImageVisibleChild } from "../dynamic-image";
import { SignalListeners } from "src/util/signal-listener";
import { PlayableContainer } from "src/util/playablelist";

interface PlaylistListItemWithSignals extends PlaylistListItem {
  signals: SignalListeners;
}

export class PlaylistListView extends Gtk.ListView {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistListView",
      Properties: {
        "show-rank": GObject.param_spec_boolean(
          "show-rank",
          "Show Rank",
          "Whether to show chart rank and trend change",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        playlistId: GObject.param_spec_string(
          "playlist-id",
          "Playlist ID",
          "The playlist ID",
          null as any,
          GObject.ParamFlags.READWRITE,
        ),
        album: GObject.param_spec_boolean(
          "album",
          "Album",
          "Whether this is currently displaying an album",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        show_add: GObject.param_spec_boolean(
          "show-add",
          "Show Add",
          "Show the add to playlist button",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        selection_mode: GObject.param_spec_boolean(
          "selection-mode",
          "Selection Mode",
          "Whether the selection mode is toggled on",
          false,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "add": {
          param_types: [GObject.TYPE_INT],
        },
      },
    }, this);
  }

  album = false;
  selection_mode = false;
  playlistId?: string;

  constructor(
    { model, album, ...props }: Partial<Gtk.ListView.ConstructorProperties> =
      {},
  ) {
    super(props);

    if (album != null) this.album = album;

    if (model !== undefined) this.model = model!;

    this.add_css_class("playlist-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = new PlaylistListItem() as PlaylistListItemWithSignals;

    item.signals = new SignalListeners();

    // if (this.album) {
    //   item.dynamic_image.visible_child = DynamicImageVisibleChild.NUMBER;
    // }

    list_item.set_child(item);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    item.show_add = this.show_add;

    // TODO: selection mode
    // item.dynamic_image.selection_mode = this.selection_mode;
    // item.dynamic_image.selected = list_item.selected;

    item.set_item(playlist_item, this.playlistId);

    if (this.album) {
      item.dynamic_image.track_number = list_item.position + 1;
    }

    // item.signals.connect(
    //   item.dynamic_image,
    //   "selection-mode-toggled",
    //   (_dynamic_image, value) => {
    //     this.selection_mode_toggled(list_item.position, value);
    //   },
    // );

    item.signals.add(
      container,
      container.connect("notify::state", () => {
        item.dynamic_image.state = container.state;
      }),
    );

    // item.signals.add(
    //   container,
    //   container.connect("notify", () => {
    //     item.dynamic_image.selection_mode = this.selection_mode;
    //     item.show_add = this.show_add;
    //   }),
    // );

    item.signals.add(
      item,
      item.connect("add", (_) => {
        this.emit("add", list_item.position);
      }),
    );
  }

  unbind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;

    item.signals.clear();
    item.clear();
  }

  teardown_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    list_item.set_child(null);
  }

  private selection_mode_toggled(position: number, value: boolean) {
    if (value) {
      this.model.select_item(position, false);
    } else {
      this.model.unselect_item(position);
    }
  }

  show_add = false;
}
