import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import {
  get_more_search_results,
  get_option,
  search,
  SearchResults,
} from "../muse.js";
import { SearchSection } from "../components/search/section.js";
import { TopResultSection } from "../components/search/topresultsection.js";
import { Paginator } from "../components/paginator.js";
import { InlineTabSwitcher } from "src/components/inline-tab-switcher.js";

export class SearchPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SearchPage",
      Template: "resource:///com/vixalien/muzika/pages/search.ui",
      InternalChildren: ["scrolled", "content", "sections"],
    }, this);
  }

  _scrolled!: Gtk.ScrolledWindow;
  _content!: Gtk.Box;
  _sections!: Gtk.Box;

  paginator: Paginator;

  results?: SearchResults;
  args: Parameters<typeof search> = [""];

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.paginator = new Paginator();
    this.paginator.connect("activate", () => {
      this.search_more();
    });
    this._content.append(this.paginator);
  }

  add_scope_tabs() {
    if (!get_option("auth").has_token()) {
      return;
    }

    const switcher = new InlineTabSwitcher({
      halign: Gtk.Align.START,
      margin_start: 12,
      margin_end: 12,
      margin_top: 12,
    });

    switcher.add_tab("catalog", "Catalog");
    switcher.add_tab("lirary", "Library");
    switcher.add_tab("uploads", "Uploads");

    switcher.connect("changed", (_, tab) => {
      console.log("tab", tab);
    });

    this._content.prepend(switcher);
  }

  show_results(results: SearchResults, args: Parameters<typeof search>) {
    this.results = results;
    this.args = args;

    this.add_scope_tabs();

    this.paginator.set_reveal_child(results.continuation != null);

    if (results.top_result) {
      const top_result = new TopResultSection();

      top_result.show_top_result(results.top_result);
      this._sections.append(top_result);
    }

    results.categories.forEach((category) => {
      const section = new SearchSection({
        args,
        show_more: results.categories.length > 1,
        show_type: false,
      });
      section.set_category(category);
      this._sections.append(section);
    });
  }

  search(...args: Parameters<typeof search>) {
    return search(...args).then((results) => {
      this.results = results;
      this.show_results(results, args);
    });
  }

  loading = false;

  search_more() {
    if (this.loading || !this.results || !this.results?.continuation) return;

    this.loading = true;

    get_more_search_results(this.results.continuation, this.args[1] ?? {})
      .then((results) => {
        this.results!.continuation = results.continuation;

        const first_section = this._sections.get_first_child() as SearchSection;

        if (!first_section || !(first_section instanceof SearchSection)) {
          return;
        } else {
          results.results.forEach((content) => {
            this.results!.categories[0].results.push(content);
            first_section.add_content(content);
          });
        }

        this.paginator.loading = this.loading = false;
        this.paginator.set_reveal_child(results.continuation != null);
      });
  }
}
