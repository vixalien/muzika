import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import {
  Filter,
  get_more_search_results,
  get_option,
  search,
  SearchOptions,
  SearchResults,
  SearchRuns,
} from "../muse.js";
import { SearchSection } from "../components/search/section.js";
import { TopResultSection } from "../components/search/topresultsection.js";
import { Paginator } from "../components/paginator.js";
import { InlineTabSwitcher, Tab } from "../components/inline-tab-switcher.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { escape_label } from "src/util/text.js";

const vprintf = imports.format.vprintf;

interface SearchState {
  results: SearchResults;
  args: Parameters<typeof search>;
}

interface SearchData {
  results: SearchResults;
  args: Parameters<typeof search>;
}

export class SearchPage extends Adw.Bin
  implements MuzikaComponent<SearchData, SearchState> {
  static {
    GObject.registerClass({
      GTypeName: "SearchPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/search.ui",
      InternalChildren: [
        "scrolled",
        "content",
        "sections",
        "stack",
        "no_results",
        "details",
      ],
    }, this);
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _content!: Gtk.Box;
  private _sections!: Gtk.Box;
  private _stack!: Gtk.Stack;
  private _no_results!: Gtk.Label;
  private _details!: Gtk.Box;

  paginator: Paginator;

  results?: SearchResults;
  args: Parameters<typeof search> = [""];

  constructor() {
    super();

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
    });

    const scopes = [
      [_("Catalog"), undefined],
      [_("Library"), "library"],
      [_("Uploads"), "uploads"],
    ] as const;

    scopes.forEach(([label, scope]) => {
      const tab = new Tab(label.toLowerCase(), label);

      const selected = this.args[1]?.scope === scope;

      const url = search_args_to_url(
        this.args[0],
        {
          ...this.args[1],
          scope: scope ?? undefined,
          filter: undefined,
        },
        true,
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

    const window = new Gtk.ScrolledWindow({
      vscrollbar_policy: Gtk.PolicyType.NEVER,
      // don't show the scrollbar, but allow scrolling
      hscrollbar_policy: Gtk.PolicyType.EXTERNAL,
    });

    window.set_child(switcher);

    this._details.append(window);
  }

  show_filter_tabs() {
    if (!this.results?.filters && !this.results?.filters.length) return;

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      margin_start: 12,
      margin_end: 12,
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
          true,
        );

        button.action_name = "navigator.visit";
        button.action_target = GLib.Variant.new("s", url);

        if (selected) {
          button.active = true;
        }

        box.append(button);
      });

    const window = new Gtk.ScrolledWindow({
      vscrollbar_policy: Gtk.PolicyType.NEVER,
      // don't show the scrollbar, but allow scrolling
      hscrollbar_policy: Gtk.PolicyType.EXTERNAL,
    });
    window.set_child(box);

    this._details.append(window);
  }

  show_did_you_mean() {
    if (!this.results?.did_you_mean) return;

    const link = `<a href="${
      search_args_to_url(this.results.did_you_mean.query, this.args[1])
    }">${search_runs_to_string(this.results.did_you_mean.search)}</a>`;

    const label = new Gtk.Label({
      label: vprintf(_("Did you mean: %s"), [link]),
      use_markup: true,
      xalign: 0,
      margin_start: 12,
      margin_end: 12,
    });

    label.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });

    label.add_css_class("flat-links");
    label.add_css_class("dim-label");

    this._details.append(label);
  }

  show_autocorrect() {
    if (!this.results?.autocorrect) return;

    const original_link = `<a href="${
      search_args_to_url(this.results.autocorrect.original.query, {
        ...this.args[1],
        autocorrect: false,
      })
    }">${search_runs_to_string(this.results.autocorrect.original.search)}</a>`;

    const corrected_link = `<a href="${
      search_args_to_url(this.results.autocorrect.corrected.query, this.args[1])
    }">${search_runs_to_string(this.results.autocorrect.corrected.search)}</a>`;

    const label = new Gtk.Label({
      label: vprintf(_("Showing results for: %s"), [corrected_link]) + "\n" +
        vprintf(_("Search instead for: %s"), [original_link]),
      use_markup: true,
      xalign: 0,
      margin_start: 12,
      margin_end: 12,
    });

    label.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });

    label.add_css_class("flat-links");
    label.add_css_class("dim-label");

    this._details.append(label);
  }

  present({ results, args }: SearchData) {
    this.results = results;
    this.args = args;

    if (!results.top_result && results.categories.length === 0) {
      this._stack.set_visible_child(this._no_results);
    } else {
      this._stack.set_visible_child(this._sections);
    }

    this.show_scope_tabs();
    this.show_filter_tabs();
    this.show_autocorrect();
    this.show_did_you_mean();

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

  static load(context: EndpointContext) {
    const autocorrect = context.url.searchParams.get("autocorrect");

    const args = [decodeURIComponent(context.match.params.query), {
      signal: context.signal,
      ...Object.fromEntries(context.url.searchParams as any),
      autocorrect: autocorrect ? autocorrect === "true" : undefined,
    }] as const;

    return search(...args).then((results) => {
      return {
        results,
        args,
      };
    });
  }

  get_state(): SearchState {
    return {
      results: this.results!,
      args: this.args,
    };
  }

  restore_state(state: SearchState) {
    this.present(state);
  }
}

export function search_args_to_url(
  query: string,
  options: SearchOptions = {},
  replace = false,
) {
  const opts = options as Record<string, any>;
  if (replace) opts.replace = true;
  const params = new URLSearchParams(
    Object.entries(opts)
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
      return _("Albums");
    case "artists":
      return _("Artists");
    case "playlists":
      return _("Playlists");
    case "songs":
      return _("Songs");
    case "videos":
      return _("Videos");
    case "community_playlists":
      return _("Community Playlists");
    case "featured_playlists":
      return _("Featured Playlists");
    default:
      return filter;
  }
}

function search_runs_to_string(runs: SearchRuns) {
  return runs.map((run) => {
    if (run.italics) {
      return `<i>${escape_label(run.text)}</i>`;
    } else if (run.bold) {
      return `<b>${escape_label(run.text)}</b>`;
    } else {
      return escape_label(run.text);
    }
  }).join("");
}
