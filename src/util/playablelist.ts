import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import type { PlaylistItem, SearchContent } from "libmuse";

import { DynamicActionState } from "src/components/dynamic-image";
import { SignalListeners } from "./signal-listener";
import { get_player } from "src/application";
import { MixedCardItem } from "src/components/library/mixedcard";
import { ObjectContainer } from "./objectcontainer";
import { get_state_pspec } from "src/components/dynamic-action";

function get_mixed_card_props(item: MixedCardItem) {
  let props: PlayableContainerProps<MixedCardItem>;

  switch (item.type) {
    case "album":
      props = {
        object: item,
        is_playlist: true,
        playlist_id: item.audioPlaylistId,
      };
      break;
    case "artist":
    case "channel":
    case "library-artist":
      props = { object: item };
      break;
    case "video":
    case "song":
    case "inline-video":
    case "flat-song":
      props = { object: item, video_id: item.videoId ?? undefined };
      break;
    case "watch-playlist":
    case "playlist":
      props = {
        object: item,
        is_playlist: true,
        playlist_id: item.playlistId,
      };
      break;
    default:
      props = { object: item };
      break;
  }

  return props;
}

function get_search_content_props(item: SearchContent) {
  let props: PlayableContainerProps<SearchContent>;

  switch (item.type) {
    case "album":
      props = {
        object: item,
        is_playlist: true,
        // playlist_id: item.audioPlaylistId,
      };
      break;
    case "artist":
    case "profile":
      props = { object: item };
      break;
    case "playlist":
      props = {
        object: item,
        is_playlist: true,
        playlist_id: item.browseId,
      };
      break;
    case "radio":
      props = {
        object: item,
        is_playlist: true,
        playlist_id: item.playlistId,
      };
      break;
    case "song":
    case "video":
      props = { object: item, video_id: item.videoId ?? undefined };
      break;
    default:
      props = { object: item };
      break;
  }

  return props;
}

export interface PlayableContainerProps<T = PlaylistItem> {
  object: T;
  video_id?: string;
  playlist_id?: string;
  is_playlist?: boolean;
}

export class PlayableContainer<T = PlaylistItem> extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: "PlayableContainer",
        Properties: {
          object: GObject.ParamSpec.object(
            "object",
            "Contained Object",
            "The contained object",
            GObject.ParamFlags.READWRITE,
            GObject.Object.$gtype,
          ),
          state: get_state_pspec(),
          video_id: GObject.param_spec_string(
            "video-id",
            "Video ID",
            "The video ID of the item",
            null,
            GObject.ParamFlags.READWRITE,
          ),
          playlist_id: GObject.param_spec_string(
            "playlist-id",
            "Playlist ID",
            "The playlist ID of the item",
            null,
            GObject.ParamFlags.READWRITE,
          ),
          is_playlist: GObject.ParamSpec.boolean(
            "is-playlist",
            "Is Playlist",
            "Whether the item is a playlist",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
      },
      this,
    );
  }

  object: T;
  state: DynamicActionState;
  video_id: string | null = null;
  playlist_id: string | null = null;
  is_playlist = false;

  constructor(props: PlayableContainerProps<T>) {
    super();

    this.state = DynamicActionState.DEFAULT;
    this.object = props.object;

    if (props.video_id) this.video_id = props.video_id;
    if (props.playlist_id) this.playlist_id = props.playlist_id;
    if (props.is_playlist != null) this.is_playlist = props.is_playlist;
  }

  static new<T>(object: T): PlayableContainer<T> {
    return new PlayableContainer({ object });
  }

  static new_from_playlist_item(
    item: PlaylistItem,
  ): PlayableContainer<PlaylistItem> {
    return new PlayableContainer({
      object: item,
      video_id: item.videoId,
    });
  }

  static new_from_mixed_card_item(
    item: MixedCardItem,
  ): PlayableContainer<MixedCardItem> {
    return new PlayableContainer(get_mixed_card_props(item));
  }

  static new_from_search_content(
    item: SearchContent,
  ): PlayableContainer<SearchContent> {
    return new PlayableContainer(get_search_content_props(item));
  }
}

export interface SectionedPlayableContainerProps<
  T = PlaylistItem,
  Section = object,
> extends PlayableContainerProps<T> {
  section?: ObjectContainer<Section> | null;
}

export class SectionedPlayableContainer<
  T = PlaylistItem,
  Section = object,
> extends PlayableContainer<T> {
  static {
    GObject.registerClass(
      {
        GTypeName: "SectionedPlayableContainer",
        Properties: {
          section: GObject.ParamSpec.object(
            "section",
            "Section",
            "If this item starts a section, this property will be set to the section",
            GObject.ParamFlags.READWRITE,
            ObjectContainer.$gtype,
          ),
        },
      },
      this,
    );
  }

  constructor(props: SectionedPlayableContainerProps<T, Section>) {
    super(props);

    this.state = DynamicActionState.DEFAULT;
    this.object = props.object;

    if (props.section != null) this.section = props.section;
  }

  section: ObjectContainer<Section> | null = null;

  get_section() {
    return this.section?.object ?? null;
  }

  set_section(section: Section | null) {
    if (section) {
      this.section = new ObjectContainer(section);
    } else {
      this.section = null;
    }
  }

  has_section() {
    return this.section?.object != null;
  }

  static new<T, Section>(
    item: T,
    section: Section | null = null,
  ): SectionedPlayableContainer<T, Section> {
    return new SectionedPlayableContainer({
      object: item,
      section: section ? new ObjectContainer(section) : null,
    });
  }

  static new_from_playlist_item<Section>(
    item: PlaylistItem,
    section: Section | null = null,
  ) {
    return new SectionedPlayableContainer({
      object: item,
      video_id: item.videoId,
      section: section ? new ObjectContainer(section) : null,
    });
  }

  static new_from_mixed_card_item<Section>(
    item: MixedCardItem,
    section: Section | null = null,
  ) {
    return new SectionedPlayableContainer({
      ...get_mixed_card_props(item),
      section: section ? new ObjectContainer(section) : null,
    });
  }

  static new_from_search_content<Section>(
    item: SearchContent,
    section: Section | null = null,
  ) {
    return new SectionedPlayableContainer({
      ...get_search_content_props(item),
      section: section ? new ObjectContainer(section) : null,
    });
  }
}

export interface PlayableListProps {
  item_type?: GObject.GType;
}

export class PlayableList<
    T = PlaylistItem,
    Container extends PlayableContainer<T> = PlayableContainer<T>,
  >
  extends GObject.Object
  implements Gio.ListModel
{
  static {
    GObject.registerClass(
      {
        GTypeName: "PlayableList",
        Properties: {
          item_type: GObject.ParamSpec.uint64(
            "item-type",
            "Item Type",
            "The type of the items in the list",
            GObject.ParamFlags.READWRITE,
            0,
            Number.MAX_SAFE_INTEGER,
            0,
          ),
          n_items: GObject.ParamSpec.uint64(
            "n-items",
            "Number of Items",
            "The number of items in the list",
            GObject.ParamFlags.READABLE,
            0,
            Number.MAX_SAFE_INTEGER,
            0,
          ),
        },
        Implements: [Gio.ListModel],
      },
      this,
    );
  }

  protected array = new Array<Container>();

  constructor(props: PlayableListProps = {}) {
    super(props);
  }

  get_item_type(): GObject.GType<unknown> {
    return this.vfunc_get_item_type();
  }

  get n_items(): number {
    return this.array.length;
  }

  get_n_items(): number {
    return this.n_items;
  }

  get_item(position: number): Container | null {
    return this.vfunc_get_item(position) as Container | null;
  }

  items_changed(position: number, removed: number, added: number): void {
    this.emit("items-changed", position, removed, added);

    if (removed != added) {
      this.notify("n-items");
    }
  }

  vfunc_get_item(position: number): GObject.Object | null {
    return this.array[position] ?? null;
  }

  vfunc_get_n_items(): number {
    return this.array.length;
  }

  vfunc_get_item_type(): GObject.GType<unknown> {
    return PlayableContainer.$gtype;
  }

  find(fn: (item: Container) => boolean): number | null {
    const index = this.array.findIndex(fn);

    return index === -1 ? null : index;
  }

  find_by_video_id(video_id: string): number | null {
    return this.find((item) => item.video_id === video_id);
  }

  append(item: Container): void {
    this.array.push(item);

    this.items_changed(this.array.length - 1, 0, 1);
  }

  remove(item: number): void {
    this.array.splice(item, 1);

    this.items_changed(item, 1, 0);
  }

  insert(position: number, item: Container): void {
    this.array.splice(position, 0, item);

    this.items_changed(position, 0, 1);
  }

  splice(position: number, removed: number, added: Container[]): void {
    this.array.splice(position, removed, ...added);

    this.items_changed(position, removed, added.length);
  }

  remove_all(): void {
    const length = this.array.length;

    this.array.splice(0, length);

    this.items_changed(0, length, 0);
  }

  private listeners = new SignalListeners();

  private reload_state() {
    const player = get_player();

    this.array.forEach((item) => {
      if (item.is_playlist) {
        item.state =
          item.playlist_id && player.queue.playlist_id == item.playlist_id
            ? player.playing
              ? DynamicActionState.PLAYING
              : DynamicActionState.PAUSED
            : item.video_id && player.loading_track == item.video_id
              ? DynamicActionState.LOADING
              : DynamicActionState.DEFAULT;
      } else {
        item.state =
          item.video_id &&
          player.now_playing?.object.track.videoId == item.video_id
            ? player.playing
              ? DynamicActionState.PLAYING
              : DynamicActionState.PAUSED
            : player.loading_track == item.video_id
              ? DynamicActionState.LOADING
              : DynamicActionState.DEFAULT;
      }
    });
  }

  setup_listeners() {
    const player = get_player();

    this.listeners.add(player, [
      player.connect("notify::now-playing", this.reload_state.bind(this)),
      player.connect("notify::playing", this.reload_state.bind(this)),
      player.connect("notify::loading-track", this.reload_state.bind(this)),
    ]);

    this.reload_state();
  }

  clear_listeners() {
    this.listeners.clear();
  }
}

export class SectionedPlayableList<T = PlaylistItem> extends PlayableList<
  T,
  SectionedPlayableContainer<T>
> {
  static {
    GObject.registerClass(
      {
        GTypeName: "SectionedPlayableList",
        Implements: [Gtk.SectionModel],
      },
      this,
    );
  }

  vfunc_get_section(position: number) {
    let start = -1,
      end = -1;

    for (let i = position; i >= 0; i--) {
      if (this.array[i].has_section()) {
        start = i;
        break;
      }
    }

    for (let i = position + 1; i < this.array.length; i++) {
      if (this.array[i].has_section()) {
        end = i;
        break;
      }
    }

    if (start == -1) {
      return [0, this.array.length];
    } else if (end == -1) {
      return [start, this.array.length];
    }

    return [start, end];
  }

  get get_section() {
    return this.vfunc_get_section;
  }
}
