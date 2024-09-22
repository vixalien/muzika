import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import type {
  TopResult,
  TopResultAlbum,
  TopResultArtist,
  TopResultPlaylist,
  TopResultSong,
  TopResultVideo,
} from "libmuse";

import { load_thumbnails } from "../webimage.js";
import { DynamicActionState, DynamicImage } from "../dynamic-image";
import { pretty_subtitles } from "src/util/text.js";
import { get_player } from "src/application.js";
import { SignalListeners } from "src/util/signal-listener.js";
import { MenuHelper } from "src/util/menu/index.js";
import { menuLikeRow } from "src/util/menu/like.js";
import { setup_link_label } from "src/util/label.js";
import {
  menuLibraryRow,
  menuPlaylistLibraryRow,
} from "src/util/menu/library.js";

GObject.type_ensure(DynamicImage.$gtype);

export class TopResultCard extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "TopResultCard",
        Template:
          "resource:///com/vixalien/muzika/ui/components/search/topresult.ui",
        InternalChildren: [
          "avatar",
          "title",
          "explicit",
          "subtitle",
          "primary",
          "primary_content",
          "secondary",
          "secondary_content",
          "image_stack",
          "actions",
          "meta",
          "grid",
        ],
        Children: ["dynamic_image"],
      },
      this,
    );
  }

  private _avatar!: Adw.Avatar;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _primary!: Gtk.Button;
  private _primary_content!: Adw.ButtonContent;
  private _secondary!: Gtk.Button;
  private _secondary_content!: Adw.ButtonContent;
  private _image_stack!: Gtk.Stack;
  private _actions!: Gtk.Box;
  private _meta!: Gtk.Box;
  private _grid!: Gtk.Grid;

  image_size = 100;
  dynamic_image!: DynamicImage;

  _result?: TopResult;

  get result() {
    return this._result;
  }

  set result(result: TopResult | undefined) {
    this._result = result;
    this.setup_listeners();

    // only show dynamic image
    this.dynamic_image.action_locked = this._result
      ? !["song", "video", "playlist"].includes(this._result.type)
      : false;
  }

  constructor() {
    super();

    setup_link_label(this._subtitle);

    const click = new Gtk.GestureClick();

    click.connect("pressed", (click) => {
      click.set_state(Gtk.EventSequenceState.CLAIMED);
      this.activate_cb();
    });

    this.add_controller(click);
  }

  private activate_cb() {
    if (!this.result) return;

    let uri: string | null = null;

    switch (this.result.type) {
      case "artist":
        uri = `artist:${this.result.browseId}`;
        break;
      case "album":
        uri = `album:${this.result.browseId}`;
        break;
      case "song":
      case "video":
        if (
          get_player().now_playing?.object.track.videoId == this.result.videoId
        ) {
          get_player().play_pause();
        } else {
          this.dynamic_image.state = DynamicActionState.LOADING;
          this.activate_action(
            "queue.play-song",
            GLib.Variant.new_string(this.result.videoId),
          );
        }
        break;
      case "playlist":
        uri = `playlist:${this.result.browseId}`;
    }

    if (uri) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:" + uri),
      );
    }
  }

  private unparent_stack_children() {
    for (const child of [this._image_stack, this._meta, this._actions]) {
      this._grid.remove(child);
    }
  }

  small_layout() {
    this.dynamic_image.size = 48;
    this.dynamic_image.action_size = 16;
    this._avatar.size = 48;
    this._primary.hexpand = true;
    this._secondary.hexpand = true;

    this._primary.add_css_class("compact");
    this._secondary.add_css_class("compact");

    this.unparent_stack_children();

    this._grid.attach(this._image_stack, 0, 0, 1, 1);
    this._grid.attach(this._meta, 1, 0, 1, 1);
    this._grid.attach(this._actions, 0, 2, 2, 1);
  }

  large_layout() {
    this.dynamic_image.size = 100;
    this.dynamic_image.action_size = 32;
    this._avatar.size = 100;
    this._primary.hexpand = false;
    this._secondary.hexpand = false;

    this._primary.remove_css_class("compact");
    this._secondary.remove_css_class("compact");

    this.unparent_stack_children();

    this._grid.attach(this._image_stack, 0, 0, 1, 2);
    this._grid.attach(this._meta, 1, 0, 1, 1);
    this._grid.attach(this._actions, 1, 1, 1, 1);
  }

  show_type = true;

  private set_subtitle(
    type: string,
    artists: Parameters<typeof pretty_subtitles>[0],
    suffix?: null | string | (string | null)[],
  ) {
    const subtitles = pretty_subtitles(artists, {
      prefix: this.show_type ? type : undefined,
      suffix: suffix ?? undefined,
    });

    this._subtitle.set_markup(subtitles.markup);
    this._subtitle.tooltip_text = subtitles.plain;
  }

  show_avatar(show: boolean) {
    this._image_stack.visible_child = show ? this._avatar : this.dynamic_image;
  }

  private menu_helper = MenuHelper.new(this);

  private set_song_or_video(track: TopResultSong | TopResultVideo) {
    this.result = track;

    this._title.label = track.title;
    this._explicit.set_visible(track.isExplicit);

    this.dynamic_image.setup_video(track.videoId);

    this._primary.action_name = "queue.play-song";
    this._primary.action_target = GLib.Variant.new_string(track.videoId);

    this._secondary.sensitive = false;
    this._secondary_content.label = _("Add");
    this._secondary_content.icon_name = "list-add-symbolic";
  }

  show_song(song: TopResultSong) {
    this.set_song_or_video(song);

    this.dynamic_image.cover_thumbnails = song.thumbnails;
    this.set_subtitle("Song", song.artists, [song.duration]);

    this.menu_helper.set_builder(() => {
      return [
        menuLikeRow(
          song.likeStatus,
          song.videoId,
          (likeStatus) => (song.likeStatus = likeStatus),
        ),
        [_("Start radio"), `queue.play-song("${song.videoId}?radio=true")`],
        [_("Play next"), `queue.add-song("${song.videoId}?next=true")`],
        [_("Add to queue"), `queue.add-song("${song.videoId}")`],
        menuLibraryRow(
          song.feedbackTokens,
          (tokens) => (song.feedbackTokens = tokens),
        ),
        [_("Save to playlist"), `win.add-to-playlist("${song.videoId}")`],
        song.album
          ? [
              _("Go to album"),
              `navigator.visit("muzika:album:${song.album.id}")`,
            ]
          : null,
        song.artists.length > 1
          ? [
              _("Go to artist"),
              `navigator.visit("muzika:artist:${song.artists[0].id}")`,
            ]
          : null,
      ];
    });
  }

  show_video(video: TopResultVideo) {
    this.set_song_or_video(video);

    this.dynamic_image.cover_thumbnails = video.thumbnails;
    this.set_subtitle("Video", video.artists, [video.duration]);

    this.menu_helper.set_builder(() => {
      return [
        menuLikeRow(
          video.likeStatus,
          video.videoId,
          (likeStatus) => (video.likeStatus = likeStatus),
        ),
        [_("Start radio"), `queue.play-song("${video.videoId}?radio=true")`],
        [_("Play next"), `queue.add-song("${video.videoId}?next=true")`],
        [_("Add to queue"), `queue.add-song("${video.videoId}")`],
        menuLibraryRow(
          video.feedbackTokens,
          (tokens) => (video.feedbackTokens = tokens),
        ),
        [_("Save to playlist"), `win.add-to-playlist("${video.videoId}")`],
        video.artists && video.artists.length > 1
          ? [
              _("Go to artist"),
              `navigator.visit("muzika:artist:${video.artists[0].id}")`,
            ]
          : null,
      ];
    });
  }

  show_album(album: TopResultAlbum) {
    this.result = album;

    this.dynamic_image.cover_thumbnails = album.thumbnails;

    this._title.label = album.title;
    this._explicit.set_visible(album.isExplicit);

    this.set_subtitle(album.album_type, album.artists);

    this._primary.sensitive = false;
    this._secondary.sensitive = false;

    this.menu_helper.props = [
      album.shuffleId
        ? [
            _("Shuffle play"),
            `queue.play-playlist("${album.shuffleId}?next=true")`,
          ]
        : null,
      album.radioId
        ? [
            _("Start radio"),
            `queue.play-playlist("${album.radioId}?next=true")`,
          ]
        : null,
      // TODO: get album audioPlaylistId
      // [
      //   _("Play next"),
      //   `queue.add-playlist("${album.audioPlaylistId}?next=true")`,
      // ],
      // [_("Add to queue"), `queue.add-playlist("${album.audioPlaylistId}")`],
      // [
      //   _("Save to playlist"),
      //   `win.add-playlist-to-playlist("${album.audioPlaylistId}")`,
      // ],
      album.artists.length > 1
        ? [
            _("Go to artist"),
            `navigator.visit("muzika:artist:${album.artists[0].id}")`,
          ]
        : null,
    ];
  }

  show_artist(artist: TopResultArtist) {
    this.result = artist;

    this.show_avatar(true);
    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);

    this._title.label = artist.name;

    this.set_subtitle(_("Artist"), [], artist.subscribers);

    this._primary_content.label = _("Shuffle");
    this._primary_content.icon_name = "media-playlist-shuffle-symbolic";

    if (artist.shuffleId) {
      this._primary.sensitive = true;
      this._primary.action_name = "queue.play-playlist";
      this._primary.action_target = GLib.Variant.new_string(artist.shuffleId);
    } else {
      this._primary.sensitive = false;
    }

    this._secondary_content.label = _("Radio");
    this._secondary_content.icon_name = "sonar-symbolic";

    if (artist.radioId) {
      this._secondary.sensitive = true;
      this._secondary.action_name = "queue.play-playlist";
      this._secondary.action_target = GLib.Variant.new_string(artist.radioId);
    } else {
      this._secondary.sensitive = false;
    }

    this.menu_helper.props = [
      artist.shuffleId
        ? [
            _("Shuffle play"),
            `queue.play-playlist("${artist.shuffleId}?next=true")`,
          ]
        : null,
      artist.radioId
        ? [
            _("Start radio"),
            `queue.play-playlist("${artist.radioId}?next=true")`,
          ]
        : null,
    ];
  }

  show_playlist(playlist: TopResultPlaylist) {
    this.result = playlist;

    this.dynamic_image.cover_thumbnails = playlist.thumbnails;

    this.dynamic_image.setup_playlist(playlist.browseId);

    this._title.label = playlist.title;

    this.set_subtitle(_("Playlist"), [], playlist.description);

    this._primary_content.label = _("Play");
    this._primary_content.icon_name = "media-playback-start-symbolic";
    this._primary.sensitive = true;
    this._primary.action_name = "queue.play-playlist";
    this._primary.action_target = GLib.Variant.new_string(playlist.browseId);

    this._secondary_content.label = _("Shuffle");
    this._secondary_content.icon_name = "media-playlist-shuffle-symbolic";

    if (playlist.shuffleId) {
      this._secondary.sensitive = true;
      this._secondary.action_name = "queue.play-playlist";
      this._secondary.action_target = GLib.Variant.new_string(
        playlist.shuffleId,
      );
    } else {
      this._secondary.sensitive = false;
    }

    this.menu_helper.set_builder(() => {
      return [
        playlist.shuffleId
          ? [
              _("Shuffle play"),
              `queue.play-playlist("${playlist.shuffleId}?next=true")`,
            ]
          : null,
        playlist.radioId
          ? [
              _("Start radio"),
              `queue.play-playlist("${playlist.radioId}?next=true")`,
            ]
          : null,
        [
          _("Play next"),
          `queue.add-playlist("${playlist.browseId}?next=true")`,
        ],
        [_("Add to queue"), `queue.add-playlist("${playlist.browseId}")`],
        menuPlaylistLibraryRow(
          playlist.browseId,
          playlist.libraryLikeStatus,
          (status) => (playlist.libraryLikeStatus = status),
        ),
        [
          _("Save to playlist"),
          `win.add-playlist-to-playlist("${playlist.browseId}")`,
        ],
      ];
    });
  }

  show_top_result(top_result: TopResult) {
    switch (top_result.type) {
      case "song":
        this.show_song(top_result);
        break;
      case "video":
        this.show_video(top_result);
        break;
      case "album":
        this.show_album(top_result);
        break;
      case "artist":
        this.show_artist(top_result);
        break;
      case "playlist":
        this.show_playlist(top_result);
        break;
      default:
        console.error(
          "Unknown top result type",
          (top_result as TopResult).type,
        );
        return;
    }
  }

  private listeners = new SignalListeners();

  private reload_state() {
    const player = get_player();

    if (!this.result) return;

    // TODO: get album audioPlayistId
    const item = {
      playlist_id:
        this.result.type == "playlist" ? this.result.browseId : undefined,
      video_id:
        this.result.type == "song" || this.result.type == "video"
          ? this.result.videoId
          : undefined,
      is_playlist: false,
    };

    item.is_playlist = item.playlist_id != null;

    if (item.is_playlist) {
      this.dynamic_image.state =
        item.playlist_id && player.queue.playlist_id == item.playlist_id
          ? player.playing
            ? DynamicActionState.PLAYING
            : DynamicActionState.PAUSED
          : item.video_id && player.loading_track == item.video_id
            ? DynamicActionState.LOADING
            : DynamicActionState.DEFAULT;
    } else {
      this.dynamic_image.state =
        item.video_id &&
        player.now_playing?.object.track.videoId == item.video_id
          ? player.playing
            ? DynamicActionState.PLAYING
            : DynamicActionState.PAUSED
          : player.loading_track == item.video_id
            ? DynamicActionState.LOADING
            : DynamicActionState.DEFAULT;
    }
  }

  private setup_listeners() {
    this.clear_listeners();

    const player = get_player();

    if (!this.result) return;

    this.listeners.add(player, [
      player.connect("notify::now-playing", this.reload_state.bind(this)),
      player.connect("notify::playing", this.reload_state.bind(this)),
      player.connect("notify::loading-track", this.reload_state.bind(this)),
    ]);

    this.reload_state();
  }

  private clear_listeners() {
    this.listeners.clear();
  }

  vfunc_map() {
    super.vfunc_map();
    this.setup_listeners();
  }

  vfunc_unmap() {
    super.vfunc_unmap();
    this.clear_listeners();
  }
}
