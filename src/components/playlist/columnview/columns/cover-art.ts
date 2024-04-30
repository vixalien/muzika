import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import {
  DynamicImage,
  DynamicImageStorageType,
} from "src/components/dynamic-image";
import { PlayableContainer } from "src/util/playablelist";

export class CoverArtColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({
      GTypeName: "ImageColumn",
      Signals: {
        "selection-mode-toggled": {
          param_types: [GObject.TYPE_UINT64, GObject.TYPE_BOOLEAN],
        },
      },
    }, this);
  }

  album = false;
  selection_mode = false;

  constructor(public playlistId?: string) {
    super();

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = new DynamicImage({
      size: 36,
      action_size: 16,
      storage_type: this.album
        ? DynamicImageStorageType.TRACK_NUMBER
        : DynamicImageStorageType.COVER_THUMBNAIL,
      persistent_play_button: false,
    });

    dynamic_image.add_css_class("br-6");

    list_item.set_child(dynamic_image);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = list_item.child as DynamicImage;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    dynamic_image.connect(
      "notify::selected",
      (dynamic_image: DynamicImage) => {
        this.emit(
          "selection-mode-toggled",
          list_item.position,
          dynamic_image.selected,
        );
      },
    );

    container.connect("notify::state", () => {
      dynamic_image.state = container.state;
    });

    dynamic_image.state = container.state;

    if (this.album) {
      dynamic_image.track_number = list_item.position + 1;
    } else {
      dynamic_image.cover_thumbnails = playlist_item.thumbnails;
    }

    dynamic_image.selection_mode = this.selection_mode;
    dynamic_image.selected = list_item.selected;

    dynamic_image.setup_video(playlist_item.videoId, this.playlistId);

    container.connect("notify", () => {
      dynamic_image.selection_mode = this.selection_mode;
    });
  }
}
