import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import {
  DynamicImage,
  DynamicImageStorageType,
} from "src/components/dynamic-image";
import { PlayableContainer } from "src/util/playablelist";
import { SignalListeners } from "src/util/signal-listener";

interface DynamicImageWithListeners extends DynamicImage {
  setup_signals?: SignalListeners;
  bind_signals?: SignalListeners;
}

export class CoverArtColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass(
      {
        GTypeName: "ImageColumn",
        Properties: {
          is_album: GObject.param_spec_boolean(
            "is-album",
            "Represents an album",
            "Show the track number instead of the cover art",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          "selection-mode": GObject.param_spec_boolean(
            "selection-mode",
            "Selection Mode",
            "Whether the user can currently select the tracks",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  is_album = false;
  selection_mode = false;

  constructor(public playlistId?: string) {
    super();

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = new DynamicImage({
      size: 36,
      action_size: 16,
      storage_type: this.is_album
        ? DynamicImageStorageType.TRACK_NUMBER
        : DynamicImageStorageType.COVER_THUMBNAIL,
      persistent_play_button: false,
    }) as DynamicImageWithListeners;

    const listeners = new SignalListeners();
    listeners.add_binding(
      this.bind_property(
        "selection-mode",
        dynamic_image,
        "selection-mode",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    dynamic_image.setup_signals = listeners;

    // dynamic_image.add_css_class("br-6");

    list_item.set_child(dynamic_image);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = list_item.child as DynamicImageWithListeners;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    // populate the dynamic image

    if (this.is_album) {
      dynamic_image.track_number = list_item.position + 1;
    } else {
      dynamic_image.cover_thumbnails = playlist_item.thumbnails;
    }

    dynamic_image.selected = list_item.selected;

    dynamic_image.setup_video(playlist_item.videoId, this.playlistId);

    const listeners = new SignalListeners();

    // select the item when the user toggles the selection check button

    const model = this.get_column_view()?.model;
    if (model) {
      listeners.add(
        dynamic_image,
        dynamic_image.connect("notify::selected", () => {
          if (dynamic_image.selected) {
            model.select_item(list_item.position, false);
          } else {
            model.unselect_item(list_item.position);
          }
        }),
      );
    }

    // bind the dynamic image's state (playing, paused, etc..)

    listeners.add_binding(
      container.bind_property(
        "state",
        dynamic_image,
        "state",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    dynamic_image.bind_signals = listeners;
  }

  unbind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = list_item.child as DynamicImageWithListeners;

    dynamic_image.bind_signals?.clear();
    dynamic_image.bind_signals = undefined;
  }

  teardown_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = list_item.child as DynamicImageWithListeners;

    dynamic_image.setup_signals?.clear();
    dynamic_image.setup_signals = undefined;
  }
}
