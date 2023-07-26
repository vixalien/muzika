import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_mood_categories, MoodCategories } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

Loading;

export interface MoodsPageState {
  contents: MoodCategories;
}

export class MoodsPage extends Adw.Bin
  implements MuzikaComponent<MoodCategories, MoodsPageState> {
  static {
    GObject.registerClass({
      GTypeName: "MoodsPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/moods.ui",
      InternalChildren: ["scrolled", "box"],
    }, this);
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;

  contents?: MoodCategories;

  constructor() {
    super();
  }

  static load(ctx: EndpointContext) {
    return get_mood_categories({
      signal: ctx.signal,
    });
  }

  present(moods: MoodCategories): void {
    this.contents = moods;

    moods.categories.forEach((category) => {
      this.add_carousel(category);
    });
  }

  get_state() {
    return {
      contents: this.contents!,
    };
  }

  restore_state(state: MoodsPageState) {
    this.present(state.contents);
  }

  clear() {
    let child = this._box.get_first_child();

    while (child) {
      const current = child;
      child = child.get_next_sibling();
      this._box.remove(current);
    }

    return;
  }

  private add_carousel(
    data: MoodCategories["categories"][0],
  ) {
    if (!data || data.items.length === 0) return;

    const carousel = new Carousel();

    carousel.show_content({
      title: data.title,
      display: "mood",
      contents: data.items as any[],
    });

    this._box.append(carousel);
  }
}
