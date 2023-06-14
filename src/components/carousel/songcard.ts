import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";

import { ParsedSong } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";

export class SongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SongCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/songcard.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "popover",
        "dynamic_image",
      ],
    }, this);
  }

  song?: ParsedSong;

  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _popover!: Gtk.PopoverMenu;
  _dynamic_image!: DynamicImage;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    // gestures
    const click = new Gtk.GestureClick({
      button: 3,
    });

    click.connect("pressed", (_, _n, x, y) => {
      this.show_menu(x, y);
    });

    const long_press = Gtk.GestureLongPress.new();

    long_press.connect("pressed", (_, x, y) => {
      this.show_menu(x, y);
    });

    this.add_controller(click);
    this.add_controller(long_press);
  }
  show_menu(x: number, y: number) {
    this._popover.set_pointing_to(
      new Gdk.Rectangle({
        x: x,
        y: y,
        width: 1,
        height: 1,
      }),
    );
    this._popover.popup();
  }

  build_menu() {
    const menu = new Gio.Menu();

    menu.append("Start radio", `queue.play-song('${this.song?.videoId!}')`);
    menu.append(
      "Play next",
      `queue.add-song('${this.song?.videoId!}?next=true')`,
    );
    menu.append("Add to queue", `queue.add-song('${this.song?.videoId!}')`);

    return menu;
  }

  set_song(song: ParsedSong) {
    this.song = song;

    this._title.tooltip_text = this._title.label = song.title;
    this._subtitle.tooltip_text = this._subtitle.label = song.artists[0].name;
    this._explicit.set_visible(song.isExplicit);

    load_thumbnails(this._dynamic_image.image, song.thumbnails, 160);

    this._popover.position = Gtk.PositionType.RIGHT;
    this._popover.set_menu_model(this.build_menu());

    if (song.videoId) {
      this._dynamic_image.setup_video(song.videoId);
    } else {
      this._dynamic_image.reset_listeners();
    }
  }
}
