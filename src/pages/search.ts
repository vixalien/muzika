import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {
  Filter,
  get_more_search_results,
  get_option,
  search,
  SearchOptions,
  SearchResults,
} from "../muse.js";
import { SearchSection } from "../components/search/section.js";
import { TopResultSection } from "../components/search/topresultsection.js";
import { Paginator } from "../components/paginator.js";
import { InlineTabSwitcher, Tab } from "../components/inline-tab-switcher.js";

export class SearchPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SearchPage",
      Template: "resource:///com/vixalien/muzika/pages/search.ui",
      InternalChildren: [
        "scrolled",
        "content",
        "sections",
        "stack",
        "no_results",
      ],
    }, this);
  }

  _scrolled!: Gtk.ScrolledWindow;
  _content!: Gtk.Box;
  _sections!: Gtk.Box;
  _stack!: Gtk.Stack;
  _no_results!: Gtk.Label;

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

  show_scope_tabs() {
    if (!get_option("auth").has_token()) {
      return;
    }

    const switcher = new InlineTabSwitcher({
      halign: Gtk.Align.START,
      margin_start: 12,
      margin_end: 12,
      margin_top: 12,
    });

    const scopes = [
      ["Catalog", undefined],
      ["Library", "library"],
      ["Uploads", "uploads"],
    ] as const;

    scopes.forEach(([label, scope]) => {
      const tab = new Tab(label.toLowerCase(), label);

      const selected = this.args[1]?.scope === scope;

      const url = search_args_to_url(
        this.args[0],
        {
          ...this.args[1],
          scope: scope ?? undefined,
        },
      );

      if (!selected) {
        tab.navigate = url;
      }

      switcher.add_tab_full(tab);
    });

    const search_options = this.args[1];

    if (search_options?.scope) {
      if (search_options.scope === "library") {
        switcher.select("library");
      } else {
        switcher.select("uploads");
      }
    }

    switcher.connect("changed", (_, tab) => {
      console.log("tab", tab);
    });

    this._content.prepend(switcher);
  }

  show_filter_tabs() {
    if (!this.results?.filters && !this.results?.filters.length) return;

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      margin_start: 12,
      margin_end: 12,
      margin_top: 12,
    });

    this.results.filters
      // sort selected first
      .sort((a, b) => {
        if (a === this.args[1]?.filter) return -1;
        if (b === this.args[1]?.filter) return 1;
        return 0;
      })
      .forEach((filter) => {
        const button = Gtk.ToggleButton.new_with_label(
          filter_to_string(filter),
        );

        button.add_css_class("chip");

        const selected = this.args[1]?.filter === filter;

        const url = search_args_to_url(
          this.args[0],
          {
            ...this.args[1],
            filter: selected ? undefined : filter ?? undefined,
          },
        );

        button.action_name = "app.navigate";
        button.action_target = GLib.Variant.new("s", url);

        if (selected) {
          button.active = true;
        }

        box.append(button);
      });

    const window = new Gtk.ScrolledWindow({
      vscrollbar_policy: Gtk.PolicyType.NEVER,
    });
    window.set_child(box);

    this._content.prepend(window);
  }

  show_results(results: SearchResults, args: Parameters<typeof search>) {
    this.results = results;
    this.args = args;

    if (!results.top_result && results.categories.length === 0) {
      this._stack.set_visible_child(this._no_results);
    } else {
      this._stack.set_visible_child(this._sections);
    }

    this.show_filter_tabs();

    this.show_scope_tabs();

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

export function search_args_to_url(query: string, options: SearchOptions = {}) {
  const params = new URLSearchParams(
    Object.entries(options)
      .filter(([_, v]) => v != null)
      .filter(([k]) => k !== "signal"),
  )
    .toString();
  let url_string = `muzika:search:${encodeURIComponent(query)}`;
  if (params) url_string += `?${params}`;

  return url_string;
}

function filter_to_string(filter: Filter) {
  switch (filter) {
    case "albums":
      return "Albums";
    case "artists":
      return "Artists";
    case "playlists":
      return "Playlists";
    case "songs":
      return "Songs";
    case "videos":
      return "Videos";
    case "community_playlists":
      return "Community Playlists";
    case "featured_playlists":
      return "Featured Playlists";
    default:
      return filter;
  }
}
