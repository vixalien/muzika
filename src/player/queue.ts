import GObject from "gi://GObject";
import Gio from "gi://Gio";

import { get_song, Song } from "../muse.js";
import { ObjectContainer } from "../util/objectcontainer.js";

export class Queue extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "Queue",
      Properties: {
        history: GObject.param_spec_object(
          "history",
          "History",
          "A Gio.ListStore that stores all the previously played songs",
          Gio.ListStore.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        list: GObject.param_spec_object(
          "list",
          "List",
          "A Gio.ListStore that stores all the songs",
          Gio.ListStore.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        position: GObject.param_spec_int(
          "position",
          "Position",
          "The current position in the queue",
          0,
          1000000,
          0,
          GObject.ParamFlags.READABLE,
        ),
        current: GObject.param_spec_object(
          "current",
          "Current",
          "The current song",
          ObjectContainer.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        "can-play-next": GObject.param_spec_boolean(
          "can-play-next",
          "Can play next",
          "Whether the next song can be played",
          false,
          GObject.ParamFlags.READABLE,
        ),
        "can-play-previous": GObject.param_spec_boolean(
          "can-play-previous",
          "Can play previous",
          "Whether the previous song can be played",
          false,
          GObject.ParamFlags.READABLE,
        ),
      },
    }, this);
  }

  private _list: Gio.ListStore<ObjectContainer<Song>> = new Gio.ListStore();
  private _position = -1

  get list() {
    return this._list;
  }

  private change_position(position: number) {
    this._position = position;
    this.notify("position");
    this.notify("current");
    this.notify("can-play-next");
    this.notify("can-play-previous");
  }

  private increment_position(n: number) {
    this.change_position(this.position + n);
  }

  get position() {
    return this._position;
  }

  get current() {
    if (this.position < 0 || this.position >= this.list.n_items) return null;
    return this.list.get_item(this.position);
  }

  get can_play_next() {
    return this.position < this.list.n_items - 1;
  }

  get can_play_previous() {
    return this.position > 0;
  }

  constructor() {
    super();
  }

  next(): Song | null {
    if (this.position >= this.list.n_items) return null;

    this.increment_position(1);
    return this.list.get_item(this.position)?.item!;
  }

  previous(): Song | null {
    if (this.position <= 0) return null;

    this.increment_position(-1);
    return this.list.get_item(this.position)?.item!;
  }

  private async add_at_position(
    song_or_ids: Song[] | string[],
    position: number,
  ) {
    if (!song_or_ids || song_or_ids.length <= 0) return;

    const songs = await Promise.all(
      song_or_ids
        .map((song) => {
          if (typeof song === "string") {
            return get_song(song);
          } else {
            return song;
          }
        }),
    );

    const song_containers = songs.map((song) => ObjectContainer.new(song));

    this.list.splice(position, 0, song_containers);
  }

  async add(song_or_ids: Song[] | string[]) {
    await this.add_at_position(song_or_ids, this.position + 1);
  }

  async add_last(song_or_ids: Song[] | string[]) {
    await this.add_at_position(song_or_ids, this.list.n_items);
  }
}
