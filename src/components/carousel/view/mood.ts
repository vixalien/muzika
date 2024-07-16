import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import type { ParsedMoodOrGenre } from "libmuse";

import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { mood_activate_cb } from "./util";

export class MoodBox extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "MoodBox",
        Template:
          "resource:///com/vixalien/muzika/ui/components/carousel/moodbox.ui",
        InternalChildren: ["label"],
      },
      this,
    );
  }

  private _label!: Gtk.Label;

  show_mood(mood: ParsedMoodOrGenre) {
    this._label.label = mood.title;

    const provider = Gtk.CssProvider.new();
    // provider.load_from_data(
    //   `.mood-box { border-left: 8px inset ${mood.color}; }`,
    //   -1,
    // );
    provider.load_from_data(
      `.mood-box { background-color: alpha(${mood.color}, .3); }`,
      -1,
    );

    this.get_style_context().add_provider(
      provider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    );
  }
}

export class CarouselMoodView extends Gtk.GridView {
  static {
    GObject.registerClass(
      {
        GTypeName: "CarouselMoodView",
      },
      this,
    );
  }

  items = new PlayableList<ParsedMoodOrGenre>();

  constructor() {
    super({
      single_click_activate: true,
      margin_bottom: 18,
      min_columns: 4,
      max_columns: 4,
      orientation: Gtk.Orientation.HORIZONTAL,
    });

    this.connect("activate", mood_activate_cb.bind(this));

    this.add_css_class("transparent");
    this.add_css_class("carousel-mood-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));

    this.factory = factory;
    this.model = Gtk.NoSelection.new(this.items);
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new MoodBox();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const moodbox = list_item.child as MoodBox;
    const container = list_item.item as PlayableContainer<ParsedMoodOrGenre>;

    if (container.object) {
      moodbox.show_mood(container.object);
    }
  }

  vfunc_map(): void {
    this.items.setup_listeners();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.items.clear_listeners();
    super.vfunc_unmap();
  }
}
