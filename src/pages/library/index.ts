import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { get_library, Library } from "../../muse.js";
import { Grid } from "../../components/grid/index.js";

export class LibraryPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LibraryPage",
    }, this);
  }

  library?: Library;
  grid: Grid;
  scrolled: Gtk.ScrolledWindow;

  constructor() {
    super();

    this.grid = new Grid();
    this.grid.margin_start = 6;
    this.grid.margin_end = 12;
    this.grid.margin_top = 6;
    this.grid.margin_bottom = 6;

    this.scrolled = new Gtk.ScrolledWindow({
      hexpand: true,
      hscrollbar_policy: Gtk.PolicyType.NEVER,
    });

    this.scrolled.set_child(this.grid);
    this.append(this.scrolled);
  }

  show_library(library: Library) {
    this.grid.show_items(library.results);
  }

  async load_library() {
    this.library = await get_library();

    this.show_library(this.library);
  }
}
