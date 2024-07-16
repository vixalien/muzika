import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_new_releases } from "libmuse";
import type { NewReleases } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

GObject.type_ensure(Loading.$gtype);

export interface NewReleasesPageState extends VScrollState {
  contents: NewReleases;
}

export class NewReleasesPage
  extends Adw.Bin
  implements MuzikaPageWidget<NewReleases, NewReleasesPageState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "NewReleasesPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/new-releases.ui",
        InternalChildren: ["scrolled", "box"],
      },
      this,
    );
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;

  contents?: NewReleases;

  static async load(ctx: PageLoadContext) {
    const data = await get_new_releases({
      signal: ctx.signal,
    });

    ctx.set_title(data.title);

    return data;
  }

  present(new_releases: NewReleases): void {
    this.contents = new_releases;

    new_releases.categories.forEach((category) => {
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

  restore_state(state: NewReleasesPageState) {
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

    return;
  }

  private add_carousel(content: NewReleases["categories"][0]) {
    if (!content || content.contents.length === 0) return;

    const carousel = new Carousel();

    carousel.show_content(content);

    this._box.append(carousel);
  }
}
