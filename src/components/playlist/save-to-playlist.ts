import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import {
  AddToPlaylist,
  AddToPlaylistItem,
  edit_playlist,
  EditPlaylistOptions,
  get_add_to_playlist,
} from "libmuse";
import { ObjectContainer } from "src/util/objectcontainer";
import { AddToPlaylistItemCard } from "./add-to-playlist-item";
import { add_toast, get_window } from "src/util/window";

const vprintf = imports.format.vprintf;

export type AddToPlaylistItemWithTitle = AddToPlaylistItem & {
  section_title: string | null;
};

class AddToPlaylistListStore extends Gio.ListStore<
  ObjectContainer<AddToPlaylistItemWithTitle>
> {
  static {
    GObject.registerClass(
      {
        GTypeName: "AddToPlaylistListStore",
        Implements: [Gtk.SectionModel],
      },
      this,
    );
  }

  vfunc_get_section(position: number) {
    let start = -1,
      end = -1;

    for (let i = position; i >= 0; i--) {
      if (this.get_item(i)?.object.section_title != null) {
        start = i;
        break;
      }
    }

    for (let i = position + 1; i < this.get_n_items(); i++) {
      if (this.get_item(i)?.object.section_title != null) {
        end = i;
        break;
      }
    }

    if (start == -1) {
      return [0, this.get_n_items()];
    } else if (end == -1) {
      return [start, this.get_n_items()];
    }

    return [start, end];
  }

  get get_section() {
    return this.vfunc_get_section;
  }
}

export interface GetAddToPlaylistOptions {
  videoIds: string[] | null;
  playlistId: string | null;
}

export class SaveToPlaylistDialog extends Adw.Dialog {
  static {
    GObject.registerClass(
      {
        GTypeName: "SaveToPlaylistDialog",
        Template:
          "resource:///com/vixalien/muzika/ui/components/playlist/save-to-playlist.ui",
        InternalChildren: ["list_view"],
      },
      this,
    );
  }

  private _list_view!: Gtk.ListView;

  private model = new AddToPlaylistListStore();
  private videoIds: string[] | null = null;
  private playlistId: string | null = null;

  constructor({ videoIds, playlistId, ...options }: GetAddToPlaylistOptions) {
    super(options);

    this.videoIds = videoIds;
    this.playlistId = playlistId;

    this._list_view.model = Gtk.NoSelection.new(this.model);

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    this._list_view.factory = factory;

    const header_factory = new Gtk.SignalListItemFactory();
    header_factory.connect("setup", this._header_setup_cb.bind(this));
    header_factory.connect("bind", this._header_bind_cb.bind(this));

    this._list_view.header_factory = header_factory;

    this._list_view.connect("activate", this.activate_cb.bind(this));

    get_add_to_playlist(videoIds, playlistId)
      .then((result) => {
        this.show_add_to_playlist(result);
        this.present(get_window());
      })
      .catch(() => {
        add_toast(_("Couldn't get your playlists. Please try again later."));
      });
  }

  private setup_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const item = new AddToPlaylistItemCard();

    list_item.set_child(item);
  }

  private bind_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const card = list_item.child as AddToPlaylistItemCard;
    const container =
      list_item.item as ObjectContainer<AddToPlaylistItemWithTitle>;

    const item = container.object;

    card.show_item(item as AddToPlaylistItem);
  }

  private _header_setup_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const title = new Gtk.Label({
      halign: Gtk.Align.START,
      yalign: 0,
      css_classes: ["dim-label"],
    });
    list_item.set_child(title);
  }

  private _header_bind_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListHeader,
  ) {
    const title = list_item.child as Gtk.Label;
    const container =
      list_item.item as ObjectContainer<AddToPlaylistItemWithTitle>;

    const label = container.object?.section_title;

    title.label = label ?? "";
  }

  private activate_cb(__: Gtk.ListView, position: number) {
    const playlist = this.model.get_item(position)?.object;

    if (!playlist) return;

    const window = get_window();

    edit_playlist(playlist.playlistId, {
      add_videos: this.videoIds ?? undefined,
      add_source_playlists: this.playlistId ? [this.playlistId] : undefined,
      dedupe: "check",
    })
      .then(async (result) => {
        if (result.status === "STATUS_SUCCEEDED") {
          this.success_toast(playlist);
        } else {
          // try to provide an option to dedupe or add anyways
          if (this.playlistId || (this.videoIds && this.videoIds.length > 1)) {
            const dialog = Adw.AlertDialog.new(
              _("Duplicates"),
              _("One or more of the songs are already in your playlist"),
            );

            dialog.add_response("drop_duplicate", _("Skip duplicates"));
            dialog.add_response("skip", _("Add anyway"));

            const response = await dialog
              .choose(window, null)
              .catch(console.error);

            this.add_to_playlist_with_dedupe(
              playlist,
              response as EditPlaylistOptions["dedupe"],
            );
          } else {
            const toast = new Adw.Toast({
              title: _("This song is already in the playlist"),
              button_label: _("Add anyway"),
            });

            toast.connect("button-clicked", (toast) => {
              toast.dismiss();
              this.add_to_playlist_with_dedupe(playlist, "skip");
            });

            window.add_toast_full(toast);
          }
        }
      })
      .catch(() => {
        this.error_toast(playlist);
      });

    this.close();
  }

  private add_to_playlist_with_dedupe(
    playlist: AddToPlaylistItem,
    dedupe: EditPlaylistOptions["dedupe"],
  ) {
    edit_playlist(playlist.playlistId, {
      add_videos: this.videoIds ?? undefined,
      add_source_playlists: this.playlistId ? [this.playlistId] : undefined,
      dedupe,
    })
      .then((result) => {
        if (result.status === "STATUS_SUCCEEDED") {
          this.success_toast(playlist);
        } else {
          this.error_toast(playlist);
        }
      })
      .catch(() => {
        this.error_toast(playlist);
      });
  }

  show_add_to_playlist(add: AddToPlaylist) {
    this.model.splice(
      this.model.n_items,
      0,
      [
        ...add_title_to_add_playlist_items(add.recents, _("Recents")),
        ...add_title_to_add_playlist_items(add.playlists, _("All playlists")),
      ].map((e) => new ObjectContainer(e)),
    );
  }

  static new_videos(videoIds: string[]) {
    return new this({ videoIds, playlistId: null });
  }

  static new_playlist(playlistId: string) {
    return new this({ videoIds: null, playlistId });
  }

  private success_toast(playlist: AddToPlaylistItem) {
    // Translators: %s is a playlist name
    get_window().add_toast_full(
      new Adw.Toast({
        title: vprintf(_("Saved to %s"), [playlist.title]),
        button_label: "View",
        action_name: "navigator.visit",
        action_target: GLib.Variant.new_string(
          `muzika:playlist:${playlist.playlistId}`,
        ),
      }),
    );
  }

  private error_toast(playlist: AddToPlaylistItem) {
    get_window().add_toast_full(
      new Adw.Toast({
        title: this.playlistId
          ? // Translators: %s is a playlist name
            vprintf(_("Couldn't add playlist to %s"), [playlist.title])
          : // Translators: %s is a playlist name
            vprintf(
              this.videoIds && this.videoIds.length > 1
                ? _("Couldn't add songs to %s")
                : _("Couldn't add song to %s"),
              [playlist.title],
            ),
      }),
    );
  }
}

function add_title_to_add_playlist_items(
  items: AddToPlaylistItem[],
  title: string,
) {
  return items.reduce((prev, curr, index) => {
    return [
      ...prev,
      index === 0
        ? { ...curr, section_title: title }
        : { ...curr, category_title_title: null },
    ] as AddToPlaylistItemWithTitle[];
  }, [] as AddToPlaylistItemWithTitle[]);
}
