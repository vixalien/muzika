import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { get_more_search_results, get_option, search } from "libmuse";
import type { Filter, SearchOptions, SearchResults, SearchRuns } from "libmuse";

import { SearchSection } from "../components/search/section.js";
import { TopResultSection } from "../components/search/topresultsection.js";
import { Paginator } from "../components/paginator.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { escape_label } from "src/util/text.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { add_toast } from "src/util/window.js";
import { setup_link_label } from "src/util/label.js";

const vprintf = imports.format.vprintf;

interface SearchState extends VScrollState {
  results: SearchResults;
  args: Parameters<typeof search>;
}

interface SearchData {
  results: SearchResults;
  args: Parameters<typeof search>;
}

export class SearchPage
  extends Adw.Bin
  implements MuzikaPageWidget<SearchData, SearchState>
{
  static {
    GObject.registerClass(
      {
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
          "filter_window",
          "scope_toggles",
          "filter_toggles",
        ],
      },
      this,
    );
  }

  private _sections!: Gtk.Box;
  private _stack!: Gtk.Stack;
  private _no_results!: Gtk.Label;
  private _breakpoint!: Adw.Breakpoint;
  private _paginator!: Paginator;
  private _scrolled!: Gtk.ScrolledWindow;
  private _context_label!: Gtk.Label;
  private _scope_window!: Gtk.ScrolledWindow;
  private _filter_window!: Gtk.ScrolledWindow;
  /// @ts-expect-error needs updated types
  private _scope_toggles!: Adw.ToggleGroup;
  /// @ts-expect-error needs updated types
  private _filter_toggles!: Adw.ToggleGroup;

  results?: SearchResults;
  args: Parameters<typeof search> = [""];

  constructor() {
    super();

    setup_link_label(this._context_label);
  }

  show_scope_tabs() {
    if (!get_option("auth").has_token()) {
      return;
    }

    this._scope_window.visible = true;
    this._scope_toggles.active_name = this.get_active_scope();
  }

  private get_active_scope() {
    return this.args[1]?.scope ?? "catalog";
  }

  private on_scope_changed_cb() {
    const scope = this._scope_toggles.active_name;
    if (scope === this.get_active_scope()) return;

    const url = search_args_to_url(
      this.args[0],
      {
        ...this.args[1],
        scope: scope ?? undefined,
        filter: undefined,
      },
      true,
    );

    this.activate_action("navigator.replace", GLib.Variant.new_string(url));
  }

  show_filter_tabs() {
    if (!this.results?.filters || this.results?.filters.length === 0) return;

    this.results.filters
      // sort selected first
      .sort((a, b) => {
        /// @ts-expect-error we alaways want this first
        if (a === "all") return -1;
        if (a === this.get_active_filter()) return -1;
        if (b === this.get_active_filter()) return 1;
        return 0;
      })
      .forEach((filter) => {
        // @ts-expect-error outdated types
        const toggle = new Adw.Toggle({
          name: filter,
          label: filter_to_string(filter),
        });
        this._filter_toggles.add(toggle);
      });

    this._filter_window.visible = true;
    this._filter_toggles.active_name = this.get_active_filter();
  }

  private get_active_filter() {
    return this.args[1]?.filter ?? "all";
  }

  private on_filter_changed_cb() {
    const filter = this._filter_toggles.active_name;
    if (filter === this.get_active_filter()) return;

    const url = search_args_to_url(
      this.args[0],
      {
        ...this.args[1],
        filter: filter === "all" ? undefined : filter,
      },
      true,
    );

    this.activate_action("navigator.replace", GLib.Variant.new_string(url));
  }

  show_did_you_mean() {
    if (!this.results?.did_you_mean) return;

    const link = `<a href="${escape_label(
      search_args_to_url(this.results.did_you_mean.query, this.args[1]),
    )}">${search_runs_to_string(this.results.did_you_mean.search)}</a>`;

    this._context_label.visible = true;
    this._context_label.label = vprintf(_("Did you mean: %s"), [link]);
  }

  show_autocorrect() {
    if (!this.results?.autocorrect) return;

    const original_link = `<a href="${escape_label(
      search_args_to_url(this.results.autocorrect.original.query, {
        ...this.args[1],
        autocorrect: false,
      }),
    )}">${search_runs_to_string(this.results.autocorrect.original.search)}</a>`;

    const corrected_link = `<a href="${escape_label(
      search_args_to_url(
        this.results.autocorrect.corrected.query,
        this.args[1],
      ),
    )}">${search_runs_to_string(this.results.autocorrect.corrected.search)}</a>`;

    this._context_label.visible = true;
    this._context_label.label =
      vprintf(_("Showing results for: %s"), [corrected_link]) +
      "\n" +
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
        if (!this.results) return;

        this.results.continuation = results.continuation;

        const first_section = this._sections.get_first_child() as SearchSection;

        if (!first_section || !(first_section instanceof SearchSection)) {
          return;
        } else {
          first_section.add_search_contents(results.results);
        }

        this._paginator.loading = this.loading = false;
        this._paginator.set_reveal_child(results.continuation != null);
      })
      .catch(() => {
        add_toast(_("Couldn't get more search results. Try again later."));
        this._paginator.loading = this.loading = false;
      });
  }

  static load(context: PageLoadContext) {
    const autocorrect = context.url.searchParams.get("autocorrect");

    const args = [
      decodeURIComponent(context.match.params.query),
      {
        signal: context.signal,
        // @ts-expect-error idk why tbh
        ...Object.fromEntries(context.url.searchParams),
        autocorrect: autocorrect ? autocorrect === "true" : undefined,
      },
    ] as const;

    return search(...args).then((results) => {
      return {
        results,
        args,
      };
    });
  }

  get_state(): SearchState {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  const params = new URLSearchParams(
    Object.entries({ ...options, replace } as unknown as Record<string, string>)
      .filter(([, v]) => v != null)
      .filter(([k]) => k !== "signal"),
  ).toString();
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
  return runs
    .map((run) => {
      if (run.italics) {
        return `<i>${escape_label(run.text)}</i>`;
      } else if (run.bold) {
        return `<b>${escape_label(run.text)}</b>`;
      } else {
        return escape_label(run.text);
      }
    })
    .join("");
}
