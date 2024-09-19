import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { ngettext } from "gettext";

const vprintf = imports.format.vprintf;

import {
  delete_playlist,
  edit_playlist,
  get_more_playlist_tracks,
  get_playlist,
  get_playlist_suggestions,
  remove_playlist_items,
} from "libmuse";
import type { ParsedPlaylist, Playlist, PlaylistItem } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { PlaylistHeader } from "../components/playlist/header.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { ObjectContainer } from "src/util/objectcontainer.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { Paginator } from "src/components/paginator.js";
import { PlaylistBar } from "src/components/playlist/bar.js";
import { list_model_to_array } from "src/util/list.js";
import {
  EditedValues,
  EditPlaylistDialog,
} from "src/components/playlist/edit.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { AddActionEntries } from "src/util/action.js";
import { generate_menu } from "src/util/menu/index.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { add_toast, get_window } from "src/util/window.js";
import { AnnotatedView } from "src/components/annotated-view.js";

interface PlaylistState extends VScrollState {
  playlist: Playlist;
}

GObject.type_ensure(Paginator.$gtype);
GObject.type_ensure(PlaylistHeader.$gtype);
GObject.type_ensure(PlaylistItemView.$gtype);
GObject.type_ensure(PlaylistBar.$gtype);
GObject.type_ensure(AnnotatedView.$gtype);

export class PlaylistPage
  extends Adw.Bin
  implements MuzikaPageWidget<Playlist, PlaylistState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "PlaylistPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/playlist.ui",
        InternalChildren: [
          "trackCount",
          "separator",
          "duration",
          "scrolled",
          "data",
          "playlist_item_view",
          "paginator",
          "header",
          "bar",
          "suggestions",
          "suggestions_item_view",
          "insights_clamp",
          "insights",
          "menu",
          "shuffle_button",
          "edit_playlist_button",
          "add_to_library_button",
        ],
        Properties: {
          "selection-mode": GObject.ParamSpec.boolean(
            "selection-mode",
            "Selection Mode",
            "Whether this view is in selection mode",
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
            false,
          ),
        },
      },
      this,
    );
  }

  playlist?: Playlist;

  private _trackCount!: Gtk.Label;
  private _duration!: Gtk.Label;
  private _separator!: Gtk.Label;
  private _scrolled!: Gtk.ScrolledWindow;
  private _data!: Gtk.Box;
  private _playlist_item_view!: PlaylistItemView;
  private _paginator!: Paginator;
  private _header!: PlaylistHeader;
  private _bar!: PlaylistBar;
  private _suggestions!: Gtk.Box;
  private _suggestions_item_view!: PlaylistItemView;
  private _insights_clamp!: Adw.Clamp;
  private _insights!: Gtk.Box;
  private _menu!: Gtk.PopoverMenu;
  private _shuffle_button!: Gtk.Button;
  private _edit_playlist_button!: Gtk.Button;
  private _add_to_library_button!: Gtk.Button;

  model = new PlayableList();

  suggestions_model = new PlayableList();

  constructor() {
    super();

    this._scrolled.connect("edge-reached", (_, pos) => {
      if (pos === Gtk.PositionType.BOTTOM) {
        this.load_more();
      }
    });

    const selection_model = Gtk.MultiSelection.new(
      this.model,
    ) as Gtk.MultiSelection<ObjectContainer<PlaylistItem>>;

    this._playlist_item_view.model = selection_model;
    this._bar.model = selection_model;

    this._suggestions_item_view.model = Gtk.MultiSelection.new(
      this.suggestions_model,
    );

    this._suggestions_item_view.connect("add", this.add_cb.bind(this));

    this.add_actions();

    // selection-mode

    this.bind_property(
      "selection-mode",
      this._bar,
      "selection-mode",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "selection-mode",
      this._playlist_item_view,
      "selection-mode",
      GObject.BindingFlags.SYNC_CREATE,
    );
  }

  selection_mode = false;

  add_actions() {
    const group = new Gio.SimpleActionGroup();

    (group.add_action_entries as AddActionEntries)([
      {
        name: "delete",
        activate: () => {
          this.delete_playlist_cb();
        },
      },
      {
        name: "select",
        activate: () => {
          this.selection_mode = !this.selection_mode;
        },
      },
      {
        name: "remove-tracks",
        parameter_type: "ai",
        activate: (_, parameter) => {
          if (!parameter) return;

          if (!this.playlist?.id) return;

          const positions: number[] = [];

          for (let i = 0; i < parameter.n_children(); i++) {
            positions.push(parameter.get_child_value(i).get_int32());
          }

          this.remove_tracks(positions);
        },
      },
    ]);

    this.insert_action_group("playlist", group);
  }

  private async delete_playlist_cb() {
    if (!this.playlist || this.playlist.editable !== true) return;

    const dialog = Adw.AlertDialog.new(
      _("Delete playlist"),
      _("Are you sure you want to delete this playlist?"),
    );

    dialog.add_response("cancel", _("Cancel"));
    dialog.add_response("delete", _("Delete"));
    dialog.set_response_appearance(
      "delete",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );

    const response = await dialog
      .choose(get_window(), null)
      .catch(console.error);

    if (response === "delete") {
      delete_playlist(this.playlist.id)
        .then(() => {
          add_toast(_("Playlist deleted"));
          this.activate_action("navigation.pop", null);
        })
        .catch(() => {
          add_toast(_("Couldn't delete playlist"));
        });
    }
  }

  private async remove_tracks(positions: number[]) {
    if (!this.playlist || positions.length === 0) return;

    const items: Parameters<typeof remove_playlist_items>[1] = [];

    for (const position of positions) {
      const id = this.model.get_item(position)?.object;

      if (!id) {
        continue;
      }

      items.push({
        videoId: id.videoId,
        setVideoId: id.setVideoId ?? "",
      });
    }

    const error_toast = () => {
      add_toast(
        items.length > 1
          ? _("Couldn't remove songs from playlist")
          : _("Couldn't remove song from playlist"),
      );
    };

    const success_toast = () => {
      add_toast(
        ngettext(
          vprintf(_("%d song removed from playlist"), [items.length]),
          vprintf(_("%d songs removed from playlist"), [items.length]),
          items.length,
        ),
      );
    };

    const dialog = Adw.AlertDialog.new(
      _("Remove from playlist"),
      _(
        " Are you sure that you want to remove the selected content from the playlist? ",
      ),
    );

    dialog.add_response("cancel", _("Cancel"));
    dialog.add_response("remove", _("Remove"));
    dialog.set_response_appearance(
      "remove",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );

    const response = await dialog
      .choose(get_window(), null)
      .catch(console.error);

    if (response === "remove") {
      const message = await remove_playlist_items(
        this.playlist.id,
        items,
      ).catch((err) => {
        console.error(err);
      });

      if (message?.status === "STATUS_SUCCEEDED") {
        success_toast();

        positions
          // order by position descending
          .sort((a, b) => b - a)
          .forEach((position) => {
            this.model.remove(position);
          });

        this._playlist_item_view.model?.unselect_all();
      } else {
        error_toast();
      }
    }
  }

  private add_cb(
    _playlist_item_view: PlaylistItemView,
    container: PlayableContainer,
  ) {
    if (!this.playlist || !this._suggestions_item_view.model) return;

    this.model.append(container);
    this.playlist.tracks.push(container.object);

    // tempolary set videoId to null
    container.object.setVideoId = null;

    edit_playlist(this.playlist.id, {
      add_videos: [container.object.videoId],
    })
      .then((result) => {
        // update setVideoId

        const added = result.added[0];

        if (result.added[0]) {
          container.object.videoId = added.videoId;
          container.object.setVideoId = added.setVideoId;
        }
      })
      .catch(() => {
        this.model.remove(this.model.get_n_items() - 1);
        this.playlist?.tracks.pop();

        add_toast(_("Failed to add suggestion"));
      });

    if (this._suggestions_item_view.model.get_n_items() <= 0) {
      this.refresh_suggestions_cb();
    }
  }

  private edit_cb() {
    if (!this.playlist?.editable) return;

    const edit_dialog = new EditPlaylistDialog(this.playlist);

    edit_dialog.connect("saved", (_, values: ObjectContainer<EditedValues>) => {
      this.update_values(values.object);
    });

    edit_dialog.present(get_window());
  }

  update_values(values: EditedValues) {
    if (!this.playlist) return;

    this.playlist.title = values.title;
    this.playlist.description = values.description;
    this.playlist.privacy = values.privacy.id as Playlist["privacy"];

    this._header.set_title(values.title);
    this._header.set_description(values.description);
    this._header.set_genre(values.privacy.name);
  }

  append_tracks(tracks: PlaylistItem[]) {
    const n = this.model.get_n_items();

    this.model.splice(
      n > 0 ? n - 1 : 0,
      0,
      tracks.map((track) => PlayableContainer.new_from_playlist_item(track)),
    );
  }

  show_related(related: ParsedPlaylist[]) {
    const carousel = new Carousel();

    carousel.show_content({
      title: _("Related playlists"),
      contents: related,
    });

    this._insights.append(carousel);
  }

  present(playlist: Playlist) {
    this.model.remove_all();

    this.playlist = playlist;

    this._playlist_item_view.playlist_id = playlist.id;
    this._playlist_item_view.is_editable = this._bar.editable =
      playlist.editable;

    this._bar.playlistId = this.playlist.id;
    this._suggestions.visible = this.playlist.editable;

    this._header.load_thumbnails(playlist.thumbnails);
    this._header.set_description(playlist.description);
    this._header.set_title(playlist.title);
    this._header.set_explicit(false);
    this._header.set_genre(playlist.type);
    this._header.set_year(playlist.year);

    if (playlist.authors && playlist.authors.length >= 1) {
      this._header.set_subtitle(playlist.authors);
    }

    this.setup_menu();

    if (playlist.trackCount) {
      this._trackCount.set_label(playlist.trackCount.toString());
    } else {
      this._trackCount.set_visible(false);
      this._separator.set_visible(false);
    }

    if (playlist.duration) {
      this._duration.set_label(playlist.duration);
    } else {
      this._duration.set_visible(false);
      this._separator.set_visible(false);
    }

    if (!playlist.duration && !playlist.trackCount) {
      this._data.set_visible(false);
    }

    if (playlist.related && playlist.related.length > 0) {
      this.show_related(playlist.related);
    }

    this._paginator.can_paginate = this.playlist.continuation != null;

    this.append_tracks(playlist.tracks);

    this.suggestions_model.splice(
      0,
      this.suggestions_model.n_items,
      playlist.suggestions.map((suggestion) =>
        PlayableContainer.new_from_playlist_item(suggestion),
      ),
    );

    if (playlist.suggestions.length > 0 || playlist.related.length > 0) {
      this._insights_clamp.visible = true;
    }

    this._shuffle_button.action_target = GLib.Variant.new_string(
      `${this.playlist.id}?shuffle=true`,
    );

    this._edit_playlist_button.visible = playlist.editable;
    this._add_to_library_button.visible = !playlist.editable;
  }

  private refresh_suggestions_cb() {
    if (!this.playlist) return;

    if (this.playlist.suggestions_continuation) {
      get_playlist_suggestions(
        this.playlist.id,
        this.playlist.suggestions_continuation,
        {},
      )
        .then((result) => {
          if (!this.playlist) return;

          this.playlist.suggestions = result.suggestions;
          this.playlist.suggestions_continuation = result.continuation;

          this.suggestions_model.splice(
            0,
            this.suggestions_model.n_items,
            result.suggestions.map((suggestion) =>
              PlayableContainer.new(suggestion),
            ),
          );
        })
        .catch(() => {
          add_toast(_("Couldn't refresh playlist suggestions"));
        });
    } else {
      this.suggestions_model.remove_all();
      this.playlist.suggestions = [];
    }
  }

  private setup_menu() {
    if (!this.playlist) return;

    this._menu.set_menu_model(
      generate_menu([
        [
          _("Start Radio"),
          `queue.play-playlist("${this.playlist.id}?radio=true")`,
        ],
        [_("Play Next"), `queue.add-playlist("${this.playlist.id}?next=true")`],
        [_("Add to queue"), `queue.add-playlist("${this.playlist.id}")`],
        {
          section: null,
          items: [
            [_("Select tracks…"), `playlist.select`],
            this.playlist.editable
              ? [_("Delete Playlist…"), `playlist.delete`]
              : null,
          ],
        },
        {
          section: null,
          items: [
            [
              _("Copy Link"),
              `win.copy-url("https://music.youtube.com/playlist?list=${this.playlist.id}")`,
            ],
          ],
        },
      ]),
    );
  }

  no_more = false;

  get isLoading() {
    return this._paginator.loading;
  }

  set isLoading(value: boolean) {
    this._paginator.loading = value;
  }

  async load_more() {
    if (this.isLoading || this.no_more) return;
    this.isLoading = true;

    if (!this.playlist) return;

    if (this.playlist.continuation) {
      const more = await get_more_playlist_tracks(
        this.playlist.id,
        this.playlist.continuation,
        {
          limit: 100,
        },
      );

      this.isLoading = false;

      this.playlist.continuation = more.continuation;
      this._paginator.can_paginate = more.continuation != null;
      this.playlist.tracks.push(...more.tracks);

      this.append_tracks(more.tracks);
    } else {
      this.isLoading = false;
      this.no_more = true;
    }
  }

  static async load(context: PageLoadContext) {
    const data = await get_playlist(context.match.params.playlistId, {
      related: true,
      suggestions_limit: 6,
      signal: context.signal,
    });

    context.set_title(data.title);

    return data;
  }

  get_state(): PlaylistState {
    return {
      playlist: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...this.playlist!,
        tracks: list_model_to_array(this.model)
          .map((container) => (container as PlayableContainer).object)
          .filter((item) => item != null) as PlaylistItem[],
      },
      vscroll: 0,
    };
  }

  restore_state(state: PlaylistState) {
    this.present(state.playlist);

    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
  }
}
