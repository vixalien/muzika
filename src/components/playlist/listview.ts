import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import type { PlaylistItem } from "libmuse";

import { PlaylistListItem } from "./listitem";
import { SignalListeners } from "src/util/signal-listener";
import { PlayableContainer } from "src/util/playablelist";
import { ObjectContainer } from "src/util/objectcontainer";

interface PlaylistListItemWithSignals extends PlaylistListItem {
  setup_signals?: SignalListeners;
  bind_signals?: SignalListeners;
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
          "Show the Save to playlist button",
          false,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT |
            GObject.ParamFlags.CONSTRUCT_ONLY,
        ),
        selection_mode: GObject.param_spec_boolean(
          "selection-mode",
          "Selection Mode",
          "Whether the selection mode is toggled on",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        editable: GObject.param_spec_boolean(
          "editable",
          "Editable",
          "Whether the playlist items can be edited",
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
  editable = false;

  constructor(
    { model, album, selection_mode, show_add, editable, ...props }: Partial<
      Gtk.ListView.ConstructorProperties
    > = {},
  ) {
    super(props);

    if (album != null) this.album = album;

    if (model !== undefined) this.model = model!;

    if (show_add != null) this.show_add = show_add;

    if (editable != null) this.editable = editable;

    this.add_css_class("playlist-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    this.factory = factory;

    this.bind_property(
      "selection-mode",
      this,
      "single-click-activate",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.INVERT_BOOLEAN |
        GObject.BindingFlags.SYNC_CREATE,
    );

    this.connect("activate", (_, position) => {
      const container = this.model.get_item(position) as ObjectContainer<
        PlaylistItem
      >;

      if (this.playlistId) {
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${this.playlistId}?video=${container.object.videoId}`,
          ),
        );
      } else {
        this.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(container.object.videoId),
        );
      }
    });
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = new PlaylistListItem() as PlaylistListItemWithSignals;

    item.show_add = this.show_add;

    // change the item's selection mode based on the model's selection mode

    const listeners = new SignalListeners();
    listeners.add_binding(
      this.bind_property(
        "selection-mode",
        item.dynamic_image,
        "selection-mode",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    item.setup_signals = listeners;

    list_item.set_child(item);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    item.dynamic_image.selected = list_item.selected;

    item.set_item(
      list_item.position,
      playlist_item,
      this.playlistId,
      this.editable,
    );

    const listeners = new SignalListeners();

    listeners.add(
      item,
      item.connect("add", (_) => {
        this.emit("add", list_item.position);
      }),
    );

    // select the item when the user toggles the selection check button

    listeners.add(
      item.dynamic_image,
      item.dynamic_image.connect("notify::selected", () => {
        if (item.dynamic_image.selected) {
          this.model.select_item(list_item.position, false);
        } else {
          this.model.unselect_item(list_item.position);
        }
      }),
    );

    // bind the dynamic image's state (playing, paused, etc..)

    listeners.add_binding(
      container.bind_property(
        "state",
        item.dynamic_image,
        "state",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    item.bind_signals = listeners;
  }

  unbind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;

    item.bind_signals?.clear();
    item.bind_signals = undefined;
    item.clear();
  }

  teardown_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;

    item.bind_signals?.clear();
    item.bind_signals = undefined;
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
