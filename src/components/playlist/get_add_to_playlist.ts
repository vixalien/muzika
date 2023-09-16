import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import {
  AddToPlaylist,
  AddToPlaylistItem,
  edit_playlist,
  get_add_to_playlist,
} from "libmuse";
import { ObjectContainer } from "src/util/objectcontainer";
import { AddToPlaylistItemCard } from "./add-to-playlist-item";
import { Window } from "src/window";

const vprintf = imports.format.vprintf;

export type AddToPlaylistItemWithTitle = AddToPlaylistItem & {
  section_title: string | null;
};

class AddToPlaylistListStore extends Gio.ListStore<
  ObjectContainer<
    AddToPlaylistItemWithTitle
  >
> {
  static {
    GObject.registerClass({
      GTypeName: "AddToPlaylistListStore",
      Implements: [Gtk.SectionModel],
    }, this);
  }

  vfunc_get_section(position: number) {
    let start = -1, end = -1;

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

export class GetAddToPlaylist extends Adw.Window {
  static {
    GObject.registerClass({
      GTypeName: "GetAddToPlaylist",
      Template:
        "resource:///com/vixalien/muzika/ui/components/playlist/get-add-to-playlist.ui",
      InternalChildren: [
        "list_view",
      ],
    }, this);
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

    get_add_to_playlist(videoIds, playlistId).then((result) => {
      this.show_add_to_playlist(result);
      this.set_transient_for(get_window());
      this.present();
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
    const container = list_item.item as ObjectContainer<
      AddToPlaylistItemWithTitle
    >;

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
    const container = list_item.item as ObjectContainer<
      AddToPlaylistItemWithTitle
    >;

    const label = container.object?.section_title;

    title.label = label ?? "";
  }

  private activate_cb(__: Gtk.ListView, position: number) {
    const playlist = this.model.get_item(position)?.object;

    if (!playlist) return;

    const window = get_window();

    // Translators: %s is a playlist name
    const success_toast = new Adw.Toast({
      title: vprintf(_("Saved to %s"), [playlist.title]),
      button_label: "View",
      action_name: "navigator.visit",
      action_target: GLib.Variant.new_string(
        `muzika:playlist:${playlist.playlistId}`,
      ),
    });

    const error_toast = new Adw.Toast({
      title: this.playlistId
        // Translators: %s is a playlist name
        ? vprintf(_("Couldn't add playlist to %s"), [playlist.title])
        // Translators: %s is a playlist name
        : vprintf(
          this.videoIds && this.videoIds.length > 1
            ? _("Couldn't add songs to %s")
            : _("Couldn't add song to %s"),
          [playlist.title],
        ),
    });

    edit_playlist(playlist.playlistId, {
      add_videos: this.videoIds ?? undefined,
      add_source_playlists: this.playlistId ? [this.playlistId] : undefined,
      dedupe: "check"
    }).then((result) => {
      if (result.status === "STATUS_SUCCEEDED") {
        window.add_toast_full(success_toast);
      } else {
        // try to provide an option to dedupe
        // this can only happen for songs
        const toast = new Adw.Toast({
          title: _("This song is already in the playlist"),
          button_label: _("Add anyway"),
        });

        toast.connect("button-clicked", (toast) => {
          toast.dismiss();

          edit_playlist(playlist.playlistId, {
            add_videos: this.videoIds ?? undefined,
            add_source_playlists: this.playlistId
              ? [this.playlistId]
              : undefined,
            dedupe: "skip",
          }).then((result) => {
            if (result.status === "STATUS_SUCCEEDED") {
              window.add_toast_full(success_toast);
            } else {
              window.add_toast_full(error_toast);
            }
          }).catch(() => {
            window.add_toast_full(error_toast);
          });
        });
        window.add_toast_full(toast);
      }
    }).catch(() => {
      window.add_toast_full(error_toast);
    });

    this.close();
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
}

function get_window() {
  return (Gtk.Application.get_default() as Gtk.Application)
    .get_active_window() as Window;
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
