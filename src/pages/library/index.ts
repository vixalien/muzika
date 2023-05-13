import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { get_library, Library } from "../../muse.js";
import { LibraryView } from "../../components/library/view.js";

export class LibraryPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LibraryPage",
    }, this);
  }

  view: LibraryView;
  library?: Library;

  constructor() {
    super();

    this.view = new LibraryView();

    this.append(this.view);
  }

  show_library(library: Library) {
    this.view.show_items(library.results);
  }

  async load_library() {
    this.library = await get_library();

    this.show_library(this.library);
  }
}
