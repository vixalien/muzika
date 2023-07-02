import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import { PlaylistListItem } from "./listitem";
import { ObjectContainer } from "src/util/objectcontainer";
import { PlaylistItem } from "libmuse";
import { DynamicImageVisibleChild } from "../dynamic-image";

export class PlaylistListView extends Gtk.ListView {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistListView",
    }, this);
  }

  album = false;
  selection_mode = false;
  playlistId?: string;

  constructor() {
    super({
      margin_start: 12,
      margin_end: 12,
    });

    this.add_css_class("playlist-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = new PlaylistListItem();

    if (this.album) {
      item.dynamic_image.visible_child = DynamicImageVisibleChild.NUMBER;
    }

    list_item.set_child(item);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItem;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.object;

    item.dynamic_image.connect(
      "selection-mode-toggled",
      (_dynamic_image, value) => {
        this.selection_mode_toggled(list_item.position, value);
      },
    );

    item.dynamic_image.selection_mode = this.selection_mode;
    item.dynamic_image.selected = list_item.selected;

    item.set_item(playlist_item, this.playlistId);

    if (this.album) {
      item.dynamic_image.track_number = (list_item.position + 1).toString();
    }

    container.connect("notify", () => {
      item.dynamic_image.selection_mode = this.selection_mode;
    });
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
}
