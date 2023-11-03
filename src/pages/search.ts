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
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

const vprintf = imports.format.vprintf;

interface SearchState extends VScrollState {
  results: SearchResults;
  args: Parameters<typeof search>;
}

interface SearchData {
  results: SearchResults;
  args: Parameters<typeof search>;
}

GObject.type_ensure(InlineTabSwitcher.$gtype);

export class SearchPage extends Adw.Bin
  implements MuzikaComponent<SearchData, SearchState> {
  static {
    GObject.registerClass({
      GTypeName: "SearchPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/search.ui",
      InternalChildren: [
        "sections",
        "stack",
        "no_results",
        "breakpoint",
        "paginator",
        "scrolled",
        "context_label",
        "scope_window",
        "scope_switcher",
        "filter_window",
        "filter_box",
      ],
    }, this);
  }

  private _sections!: Gtk.Box;
  private _stack!: Gtk.Stack;
  private _no_results!: Gtk.Label;
  private _breakpoint!: Adw.Breakpoint;
  private _paginator!: Paginator;
  private _scrolled!: Gtk.ScrolledWindow;
  private _context_label!: Gtk.Label;
  private _scope_window!: Gtk.ScrolledWindow;
  private _scope_switcher!: InlineTabSwitcher;
  private _filter_window!: Gtk.ScrolledWindow;
  private _filter_box!: Gtk.Box;

  results?: SearchResults;
  args: Parameters<typeof search> = [""];

  constructor() {
    super();

    this._context_label.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });
  }

  show_scope_tabs() {
    if (!get_option("auth").has_token()) {
      return;
    }

    this._scope_window.visible = true;
    this._scope_switcher.model.remove_all();

    const scopes = [
      [_("Catalog"), undefined],
      [_("Library"), "library"],
      [_("Uploads"), "uploads"],
    ] as const;

    scopes.forEach(([label, scope]) => {
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

      this._scope_switcher.add_tab({
        id: label.toLowerCase(),
        title: label,
        navigate: !selected ? url : undefined,
      });
    });

    const search_options = this.args[1];

    if (search_options?.scope) {
      if (search_options.scope === "library") {
        this._scope_switcher.select("library");
      } else {
        this._scope_switcher.select("uploads");
      }
    }
  }

  show_filter_tabs() {
    if (!this.results?.filters || this.results?.filters.length === 0) return;

    this._filter_window.visible = true;

    this.results.filters
      // sort selected first
      .sort((a, b) => {
        if (a === this.args[1]?.filter) return -1;
        if (b === this.args[1]?.filter) return 1;
        return 0;
      })
      .forEach((filter) => {
        const selected = this.args[1]?.filter === filter;

        const url = search_args_to_url(
          this.args[0],
          {
            ...this.args[1],
            filter: selected ? undefined : filter ?? undefined,
          },
          true,
        );

        this._filter_box.append(
          new Gtk.ToggleButton({
            label: filter_to_string(filter),
            css_classes: ["chip"],
            action_name: "navigator.visit",
            action_target: GLib.Variant.new("s", url),
            active: selected,
          }),
        );
      });
  }

  show_did_you_mean() {
    if (!this.results?.did_you_mean) return;

    const link = `<a href="${
      escape_label(
        search_args_to_url(this.results.did_you_mean.query, this.args[1]),
      )
    }">${search_runs_to_string(this.results.did_you_mean.search)}</a>`;

    this._context_label.visible = true;
    this._context_label.label = vprintf(_("Did you mean: %s"), [link]);
  }

  show_autocorrect() {
    if (!this.results?.autocorrect) return;

    const original_link = `<a href="${
      escape_label(
        search_args_to_url(this.results.autocorrect.original.query, {
          ...this.args[1],
          autocorrect: false,
        }),
      )
    }">${search_runs_to_string(this.results.autocorrect.original.search)}</a>`;

    const corrected_link = `<a href="${
      escape_label(
        search_args_to_url(
          this.results.autocorrect.corrected.query,
          this.args[1],
        ),
      )
    }">${search_runs_to_string(this.results.autocorrect.corrected.search)}</a>`;

    this._context_label.visible = true;
    this._context_label.label =
      vprintf(_("Showing results for: %s"), [corrected_link]) + "\n" +
      vprintf(_("Search instead for: %s"), [original_link]);
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

    this._paginator.set_reveal_child(results.continuation != null);

    if (results.top_result) {
      const top_result = new TopResultSection(this._breakpoint);

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
          first_section.add_search_contents(results.results);
        }

        this._paginator.loading = this.loading = false;
        this._paginator.set_reveal_child(results.continuation != null);
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
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: SearchState) {
    this.present(state);

    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
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
    case "profiles":
      return _("Profiles");
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
