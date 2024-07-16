import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_mood_playlists } from "libmuse";
import type { MoodPlaylists } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

GObject.type_ensure(Loading.$gtype);

export interface MoodPlaylistsPageState extends VScrollState {
  contents: MoodPlaylists;
}

export class MoodPlaylistsPage
  extends Adw.Bin
  implements MuzikaPageWidget<MoodPlaylists, MoodPlaylistsPageState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "MoodPlaylistsPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/mood-playlists.ui",
        InternalChildren: ["scrolled", "box"],
      },
      this,
    );
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;

  contents?: MoodPlaylists;

  static async load(ctx: PageLoadContext) {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      contents: this.contents!,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: MoodPlaylistsPageState) {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
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

  private add_carousel(data: MoodPlaylists["categories"][0]) {
    if (!data || data.playlists.length === 0) return;

    const carousel = new Carousel();

    carousel.show_content({
      title: data.title,
      contents: data.playlists,
    });

    this._box.append(carousel);
  }
}
