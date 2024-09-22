import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import type { LikeStatus, PlaylistItem } from "libmuse";

import { PlayableContainer } from "src/util/playablelist";
import { generate_menu } from "src/util/menu";
import { get_button_props } from "src/util/menu/like";

class ExtraMenuButtons extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "MenuButtons",
      },
      this,
    );
  }

  private item?: PlaylistItem;
  private position = -1;

  private updating_buttons = false;

  private more: Gtk.MenuButton;
  private like: Gtk.ToggleButton;
  private dislike: Gtk.ToggleButton;

  constructor() {
    super();
    this.more = new Gtk.MenuButton({
      icon_name: "view-more-symbolic",
      css_classes: ["flat"],
    });

    this.like = new Gtk.ToggleButton({
      icon_name: "thumbs-up-symbolic",
      css_classes: ["flat"],
    });

    this.like.connect("toggled", () => {
      this.like_button_toggled();
    });

    this.dislike = new Gtk.ToggleButton({
      icon_name: "thumbs-down-symbolic",
      css_classes: ["flat"],
    });

    this.dislike.connect("toggled", () => {
      this.like_button_toggled(false);
    });

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 3,
      margin_end: 14,
    });

    box.append(this.like);
    box.append(this.dislike);
    box.append(this.more);

    this.set_child(box);
  }

  show_item(position: number, item: PlaylistItem) {
    this.item = item;
    this.position = position;

    this.update_menu_model();
    this.update_like_buttons();
  }

  clear() {
    this.more.set_menu_model(null);
  }

  private update_menu_model() {
    if (!this.item) return;

    this.more.menu_model = generate_menu([
      [_("Start radio"), `queue.play-song("${this.item.videoId}?radio=true")`],
      [_("Play next"), `queue.add-song("${this.item.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${this.item.videoId}")`],
      [_("Save to playlist"), `win.add-to-playlist("${this.item.videoId}")`],
      this.position > 0
        ? [
            _("Remove from playlist"),
            `playlist.remove-tracks([${this.position}])`,
          ]
        : null,
      this.item.album
        ? [
            _("Go to album"),
            `navigator.visit("muzika:album:${this.item.album.id}")`,
          ]
        : null,
      this.item.artists.length > 0
        ? [
            _("Go to artist"),
            `navigator.visit("muzika:artist:${this.item.artists[0].id}")`,
          ]
        : null,
    ]);
  }

  private update_like_buttons() {
    if (!this.item) return;

    // prevent `like_button_toggled` and `update_like_buttons` to be executed
    // in an infinite loop
    this.updating_buttons = true;

    const props = get_button_props(this.item.likeStatus);

    Object.assign(this.like, props.like);
    Object.assign(this.dislike, props.dislike);

    this.updating_buttons = false;
  }

  private like_button_toggled(like = true) {
    if (!this.item || this.updating_buttons) return;

    let newStatus: LikeStatus;

    if (like) {
      newStatus = this.item.likeStatus === "LIKE" ? "INDIFFERENT" : "LIKE";
    } else {
      newStatus =
        this.item.likeStatus === "DISLIKE" ? "INDIFFERENT" : "DISLIKE";
    }

    if (newStatus === this.item.likeStatus) return;

    this.activate_action(
      "win.rate-song",
      GLib.Variant.new("(sss)", [
        this.item.videoId,
        newStatus,
        this.item.likeStatus ?? "",
      ]),
    );

    this.item.likeStatus = newStatus;

    this.update_like_buttons();
  }
}

export class MenuColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass(
      {
        GTypeName: "MenuColumn",
        Properties: {
          is_editable: GObject.param_spec_boolean(
            "is-editable",
            "Is editable",
            "Whether the playlist items can be edited (or deleted)",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  is_editable = false;

  constructor() {
    super();

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const extras = new ExtraMenuButtons();

    list_item.set_child(extras);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const extras = list_item.child as ExtraMenuButtons;
    const item = (list_item.item as PlayableContainer).object;

    extras.show_item(this.is_editable ? list_item.position : -1, item);
  }

  unbind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const button = list_item.child as ExtraMenuButtons;

    button.clear();
  }
}
