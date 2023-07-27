import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_mood_playlists, MoodPlaylists } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

Loading;

export interface MoodPlaylistsPageState {
  contents: MoodPlaylists;
}

export class MoodPlaylistsPage extends Adw.Bin
  implements MuzikaComponent<MoodPlaylists, MoodPlaylistsPageState> {
  static {
    GObject.registerClass({
      GTypeName: "MoodPlaylistsPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/mood-playlists.ui",
      InternalChildren: ["scrolled", "box"],
    }, this);
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;

  contents?: MoodPlaylists;

  constructor() {
    super();
  }

  static async load(ctx: EndpointContext) {
    const data = await get_mood_playlists(ctx.match.params.params, {
      signal: ctx.signal,
    });

    ctx.set_title(data.title);

    return data;
  }

  present(mood_playlists: MoodPlaylists): void {
    this.contents = mood_playlists;

    mood_playlists.categories.forEach((category) => {
      this.add_carousel(category);
    });
  }

  get_state() {
    return {
      contents: this.contents!,
    };
  }

  restore_state(state: MoodPlaylistsPageState) {
    this.present(state.contents);
  }

  clear() {
    let child = this._box.get_first_child();

    while (child) {
      const current = child;
      child = child.get_next_sibling();
      this._box.remove(current);
    }
  }

  private add_carousel(
    data: MoodPlaylists["categories"][0],
  ) {
    if (!data || data.playlists.length === 0) return;

    const carousel = new Carousel();

    carousel.show_content({
      title: data.title,
      contents: data.playlists,
    });

    this._box.append(carousel);
  }
}
