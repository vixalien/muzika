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
    GObject.registerClass(
      {
        GTypeName: "PlaylistListView",
        Properties: {
          is_album: GObject.param_spec_boolean(
            "is-album",
            "Represents an album",
            "Whether this playlist represents an album",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          is_editable: GObject.param_spec_boolean(
            "is-editable",
            "Is editable",
            "Whether the playlist items can be edited (or deleted)",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          playlist_id: GObject.param_spec_string(
            "playlist-id",
            "Playlist ID",
            "The playlist ID",
            null,
            GObject.ParamFlags.READWRITE,
          ),
          selection_mode: GObject.param_spec_boolean(
            "selection-mode",
            "Selection Mode",
            "Whether the selection mode is toggled on",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          show_add_button: GObject.param_spec_boolean(
            "show-add-button",
            "Show the add button",
            "Show a button to trigger the 'Save to playlist' action",
            false,
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          ),
        },
        Signals: {
          add: {
            param_types: [GObject.TYPE_INT],
          },
        },
      },
      this,
    );
  }

  is_album!: boolean;
  is_editable!: boolean;
  playlist_id?: string;
  selection_mode!: boolean;
  show_add_button!: boolean;

  constructor(props: Partial<PlaylistListViewConstructorProperties> = {}) {
    super(props);

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
      GObject.BindingFlags.DEFAULT |
        GObject.BindingFlags.INVERT_BOOLEAN |
        GObject.BindingFlags.SYNC_CREATE,
    );

    this.connect("activate", (_, position) => {
      const container = this.model.get_item(
        position,
      ) as ObjectContainer<PlaylistItem>;

      if (this.playlist_id) {
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${this.playlist_id}?video=${container.object.videoId}`,
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
    const item = new PlaylistListItem({
      show_add_button: this.show_add_button,
    }) as PlaylistListItemWithSignals;

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

    if (this.is_album) {
      item.dynamic_image.track_number = list_item.position + 1;
    }

    item.set_item(
      list_item.position,
      playlist_item,
      this.playlist_id,
      this.is_editable,
    );

    const listeners = new SignalListeners();

    listeners.add(
      item,
      item.connect("add", () => {
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
}

interface PlaylistListViewConstructorProperties
  extends Gtk.ListView.ConstructorProperties {
  is_album: boolean;
  is_editable: boolean;
  playlist_id: string;
  selection_mode: boolean;
  show_add_column: boolean;
  show_rank_column: boolean;
}
