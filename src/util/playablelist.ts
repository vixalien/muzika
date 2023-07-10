import Gio from "gi://Gio";
import GObject from "gi://GObject";

import { PlaylistItem } from "src/muse";
import { DynamicImageState } from "src/components/dynamic-image";
import { SignalListeners } from "./signal-listener";
import { get_player } from "src/application";
import { MixedCardItem } from "src/components/library/mixedcard";

export class PlayableContainer<T extends Object = PlaylistItem>
  extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "PlayableContainer",
      Properties: {
        item: GObject.ParamSpec.object(
          "item",
          "Item",
          "The contained item",
          GObject.ParamFlags.READWRITE,
          GObject.Object.$gtype,
        ),
        state: GObject.ParamSpec.uint(
          "state",
          "State",
          "The state of the item",
          GObject.ParamFlags.READWRITE,
          DynamicImageState.DEFAULT,
          DynamicImageState.PLAYING,
          DynamicImageState.DEFAULT,
        ),
        video_id: GObject.ParamSpec.string(
          "video-id",
          "Video ID",
          "The video ID of the item",
          GObject.ParamFlags.READWRITE,
          null as any,
        ),
        playlist_id: GObject.ParamSpec.string(
          "playlist-id",
          "Playlist ID",
          "The playlist ID of the item",
          GObject.ParamFlags.READWRITE,
          null as any,
        ),
        is_playlist: GObject.ParamSpec.boolean(
          "is-playlist",
          "Is Playlist",
          "Whether the item is a playlist",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
    }, this);
  }

  object: T;
  state: DynamicImageState;
  video_id: string | null = null;
  playlist_id: string | null = null;
  is_playlist: boolean = false;

  constructor(props: PlayableContainerProps<T>) {
    super();

    this.state = DynamicImageState.DEFAULT;
    this.object = props.object;

    if (props.video_id) this.video_id = props.video_id;
    if (props.playlist_id) this.playlist_id = props.playlist_id;
    if (props.is_playlist) this.is_playlist = props.is_playlist;
  }

  static new<T extends Object>(object: T): PlayableContainer<T> {
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

  static new_from_mixed_card_item<T extends MixedCardItem>(
    item: MixedCardItem,
  ): PlayableContainer<T> {
    type Props = PlayableContainerProps<MixedCardItem>;

    let props: Props;

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

    return new PlayableContainer(props as PlayableContainerProps<T>);
  }
}

export interface PlayableContainerProps<T extends Object = PlaylistItem> {
  object: T;
  video_id?: string;
  playlist_id?: string;
  is_playlist?: boolean;
}

export class PlayableList<T extends Object = PlaylistItem>
  extends GObject.Object
  implements Gio.ListModel {
  static {
    GObject.registerClass({
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
    }, this);
  }

  private array = new Array<PlayableContainer<T>>();

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

  get_item(position: number): PlayableContainer<T> | null {
    return this.vfunc_get_item(position) as PlayableContainer<T> | null;
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

  find(
    fn: (item: PlayableContainer<T>) => boolean,
  ): number | null {
    const index = this.array.findIndex(fn);

    return index === -1 ? null : index;
  }

  find_by_video_id(video_id: string): number | null {
    return this.find((item) => item.video_id === video_id);
  }

  append(item: PlayableContainer<T>): void {
    this.array.push(item);

    this.items_changed(this.array.length - 1, 0, 1);
  }

  remove(item: number): void {
    this.array.splice(item, 1);

    this.items_changed(item, 1, 0);
  }

  insert(position: number, item: PlayableContainer<T>): void {
    this.array.splice(position, 0, item);

    this.items_changed(position, 0, 1);
  }

  splice(
    position: number,
    removed: number,
    added: PlayableContainer<T>[],
  ): void {
    this.array.splice(position, removed, ...added);

    this.items_changed(position, removed, added.length);
  }

  remove_all(): void {
    const length = this.array.length;

    this.array.splice(0, length);

    this.items_changed(0, length, 0);
  }

  private listeners = new SignalListeners();

  private is_now_playing(item: PlayableContainer<T>) {
    const player = get_player();

    if (item.is_playlist) {
      return player.now_playing?.object.settings.playlistId == item.playlist_id;
    } else {
      return player.now_playing?.object.track.videoId == item.video_id;
    }
  }

  private reload_state() {
    const player = get_player();

    this.array.forEach((item) => {
      item.state = this.is_now_playing(item)
        ? player.playing ? DynamicImageState.PLAYING : DynamicImageState.PAUSED
        : player.loading_track == item.video_id
        ? DynamicImageState.LOADING
        : DynamicImageState.DEFAULT;
    });
  }

  setup_listeners() {
    const player = get_player();

    this.listeners.add(
      player,
      [
        player.connect("notify::now-playing", this.reload_state.bind(this)),
        player.connect("notify::playing", this.reload_state.bind(this)),
        player.connect("notify::loading-track", this.reload_state.bind(this)),
      ],
    );

    this.reload_state();
  }

  clear_listeners() {
    this.listeners.clear();
  }
}

export interface PlayableListProps {
  item_type?: GObject.GType;
}
