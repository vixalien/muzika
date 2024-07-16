import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type {
  ArtistRun,
  ParsedAlbum,
  ParsedLibraryArtist,
  ParsedPlaylist,
  ParsedSong,
  ParsedVideo,
  RelatedArtist,
  Thumbnail,
  WatchPlaylist,
} from "libmuse";

import { get_thumbnail_with_size } from "../webimage.js";
import { pretty_subtitles } from "src/util/text.js";
import { MixedCardItem } from "../library/mixedcard.js";
import { DynamicActionState, DynamicImage } from "../dynamic-image";
import { MenuHelper } from "src/util/menu/index.js";
import { menuLikeRow } from "src/util/menu/like.js";
import { setup_link_label } from "src/util/label.js";
import { get_state_pspec } from "../dynamic-action.js";
import {
  menuLibraryRow,
  menuPlaylistLibraryRow,
} from "src/util/menu/library.js";

enum CarouselImageType {
  AVATAR,
  DYNAMIC_IMAGE,
  DYNAMIC_PICTURE,
  PLAYLIST_IMAGE,
}

export class CarouselCard extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "CarouselCard",
        Template:
          "resource:///com/vixalien/muzika/ui/components/carousel/card.ui",
        Children: ["dynamic_image"],
        Properties: {
          state: get_state_pspec(),
        },
        InternalChildren: ["title", "subtitles", "explicit", "subtitle"],
      },
      this,
    );
  }

  dynamic_image!: DynamicImage;

  private _title!: Gtk.Label;
  private _subtitles!: Gtk.Box;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;

  private content?: MixedCardItem;

  private menu_helper: MenuHelper;

  constructor() {
    super();

    setup_link_label(this._subtitle);

    this.menu_helper = MenuHelper.new(this);
  }

  reset() {
    this.set_align(Gtk.Align.FILL);

    this._title.label = "";
    this._subtitle.label = "";
    this._explicit.visible = false;
    this.subtitle_authors = [];
    this.content = undefined;
  }

  private setup_image(image_type: CarouselImageType, thumbnails: Thumbnail[]) {
    switch (image_type) {
      case CarouselImageType.AVATAR:
        this.dynamic_image.avatar_thumbnails = thumbnails;
        break;
      case CarouselImageType.DYNAMIC_IMAGE:
        this.dynamic_image.persistent_play_button = true;
        this.dynamic_image.cover_thumbnails = thumbnails;
        break;
      // TODO: fix
      case CarouselImageType.PLAYLIST_IMAGE:
        this.dynamic_image.playlist = true;
        this.dynamic_image.cover_thumbnails = thumbnails;
        break;
      case CarouselImageType.DYNAMIC_PICTURE:
        this.dynamic_image.persistent_play_button = true;
        this.dynamic_image.video_thumbnails = thumbnails;
        break;
    }
  }

  private subtitle_authors: (string | ArtistRun)[] = [];
  private subtitle_nodes: string[] = [];

  private update_subtitle() {
    const subtitles = pretty_subtitles(
      this.subtitle_authors,
      this.subtitle_nodes,
    );

    this._subtitle.label = subtitles.markup;
    this._subtitle.tooltip_text = subtitles.plain;
  }

  private set_title(title: string) {
    this._title.tooltip_text = this._title.label = title;
    // this._avatar.text = title;
  }

  private set_subtitle(
    subtitle: string | (null | string | ArtistRun)[],
    nodes: (string | null)[] = [],
  ) {
    this.subtitle_authors = [];
    this.subtitle_nodes = nodes.filter(Boolean) as string[];

    if (typeof subtitle === "string") {
      this.subtitle_authors.push(subtitle);
    } else {
      for (const node of subtitle) {
        if (!node) continue;

        this.subtitle_authors.push(node);
      }
    }

    this.update_subtitle();
  }

  private show_explicit(explicit: boolean) {
    this._explicit.visible = explicit;
  }

  private setup_video(videoId: string | null) {
    if (videoId) {
      this.dynamic_image.setup_video(videoId);
    }
  }

  private setup_playlist(playlistId: string | null) {
    if (playlistId) {
      this.dynamic_image.setup_playlist(playlistId);
    }
  }

  private set_align(align: Gtk.Align) {
    this._subtitles.halign = align;
    this._title.halign = align;
  }

  show_song(song: ParsedSong) {
    this.content = song;

    this.set_title(song.title);
    this.set_subtitle(song.artists);
    this.show_explicit(song.isExplicit);

    this.setup_image(CarouselImageType.DYNAMIC_IMAGE, song.thumbnails);
    this.setup_video(song.videoId);

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

  show_artist(artist: RelatedArtist) {
    this.content = artist;

    this.set_align(Gtk.Align.CENTER);
    this.set_title(artist.name);
    this.set_subtitle(artist.subscribers ?? "");

    this.setup_image(CarouselImageType.AVATAR, artist.thumbnails);

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

  show_library_artist(artist: ParsedLibraryArtist) {
    this.content = artist;

    this.set_align(Gtk.Align.CENTER);
    this.set_title(artist.name);
    this.set_subtitle(artist.subscribers ?? artist.songs ?? "");

    this.setup_image(CarouselImageType.AVATAR, [
      ...artist.thumbnails,
      get_thumbnail_with_size(artist.thumbnails[0], 160),
    ]);
  }

  show_video(video: ParsedVideo) {
    this.content = video;

    this.set_title(video.title);
    this.set_subtitle(video.artists ?? [], [video.views]);

    this.setup_image(CarouselImageType.DYNAMIC_PICTURE, video.thumbnails);
    this.setup_video(video.videoId);

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

  show_inline_video(video: ParsedSong) {
    this.content = video;

    this.set_title(video.title);
    this.set_subtitle(video.artists ?? [], [video.views]);

    this.setup_image(CarouselImageType.DYNAMIC_PICTURE, video.thumbnails);
    this.setup_video(video.videoId);

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
        video.album
          ? [
              _("Go to album"),
              `navigator.visit("muzika:album:${video.album.id}")`,
            ]
          : null,
        video.artists.length > 1
          ? [
              _("Go to artist"),
              `navigator.visit("muzika:artist:${video.artists[0].id}")`,
            ]
          : null,
      ];
    });
  }

  show_playlist(playlist: ParsedPlaylist) {
    this.content = playlist;

    this.set_title(playlist.title);
    this.set_subtitle(playlist.description ?? "");

    this.setup_image(CarouselImageType.PLAYLIST_IMAGE, playlist.thumbnails);
    this.setup_playlist(playlist.playlistId);

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
          `queue.add-playlist("${playlist.playlistId}?next=true")`,
        ],
        [_("Add to queue"), `queue.add-playlist("${playlist.playlistId}")`],
        menuPlaylistLibraryRow(
          playlist.playlistId,
          playlist.libraryLikeStatus,
          (status) => (playlist.libraryLikeStatus = status),
        ),
        [
          _("Save to playlist"),
          `win.add-playlist-to-playlist("${playlist.playlistId}")`,
        ],
      ];
    });
  }

  show_watch_playlist(playlist: WatchPlaylist) {
    this.content = playlist;

    this.set_title(playlist.title);
    this.set_subtitle(_("Start Radio"));

    this.setup_image(CarouselImageType.DYNAMIC_IMAGE, playlist.thumbnails);
    this.setup_playlist(playlist.playlistId);

    this.menu_helper.props = [
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
        `queue.add-playlist("${playlist.playlistId}?next=true")`,
      ],
      [_("Add to queue"), `queue.add-playlist("${playlist.playlistId}")`],
      [
        _("Save to playlist"),
        `win.add-playlist-to-playlist("${playlist.playlistId}")`,
      ],
    ];
  }

  show_album(album: ParsedAlbum) {
    this.content = album;

    this.set_title(album.title);
    this.set_subtitle(album.artists ?? [], [album.year]);
    this.show_explicit(album.isExplicit);

    this.setup_image(CarouselImageType.PLAYLIST_IMAGE, album.thumbnails);
    this.setup_playlist(album.audioPlaylistId);

    this.menu_helper.set_builder(() => {
      return [
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
        [
          _("Play next"),
          `queue.add-playlist("${album.audioPlaylistId}?next=true")`,
        ],
        [_("Add to queue"), `queue.add-playlist("${album.audioPlaylistId}")`],
        menuPlaylistLibraryRow(
          album.audioPlaylistId,
          album.libraryLikeStatus,
          (status) => (album.libraryLikeStatus = status),
        ),
        [
          _("Save to playlist"),
          `win.add-playlist-to-playlist("${album.audioPlaylistId}")`,
        ],
        album.artists.length > 1
          ? [
              _("Go to artist"),
              `navigator.visit("muzika:artist:${album.artists[0].id}")`,
            ]
          : null,
      ];
    });
  }

  show_item(content: MixedCardItem) {
    switch (content.type) {
      case "song":
        this.show_song(content);
        break;
      case "artist":
      case "channel":
        this.show_artist(content);
        break;
      case "library-artist":
        this.show_library_artist(content);
        break;
      case "video":
        this.show_video(content);
        break;
      case "inline-video":
        this.show_inline_video(content);
        break;
      case "playlist":
        this.show_playlist(content);
        break;
      case "album":
        this.show_album(content);
        break;
      case "watch-playlist":
        this.show_watch_playlist(content);
        break;
      default:
        console.warn(`Unknown content type: ${content.type}`);
    }
  }

  get state() {
    return this.dynamic_image.state;
  }

  set state(state: DynamicActionState) {
    this.dynamic_image.state = state;
  }
}
