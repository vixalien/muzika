import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {
  ArtistRun,
  FlatSong,
  ParsedLibraryArtist,
  SearchAlbum,
  SearchArtist,
  SearchContent,
  SearchPlaylist,
  SearchProfile,
  SearchRadio,
  SearchSong,
  SearchVideo,
  Thumbnail,
} from "../../muse.js";

// first register the DynamicImage class
import { pretty_subtitles } from "src/util/text.js";
import {
  ParsedAlbum,
  ParsedPlaylist,
  ParsedSong,
  ParsedVideo,
  Ranked,
  RelatedArtist,
  WatchPlaylist,
} from "libmuse/types/parsers/browsing.js";
import { DynamicImage2, DynamicImage2StorageType } from "../dynamic-image-2.js";
import { DynamicActionState } from "../dynamic-action.js";
import { MixedCardItem } from "../library/mixedcard.js";
import { MenuHelper } from "src/util/menu.js";

DynamicImage2;

export type FlatCardItem = MixedCardItem | InlineSong | SearchContent;

export type InlineSong =
  | FlatSong
  | Ranked<ParsedSong>
  | Ranked<ParsedVideo>;

export class FlatCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "FlatCard",
      Template:
        "resource:///com/vixalien/muzika/ui/components/carousel/flatcard.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "dynamic_image",
      ],
    }, this);
  }

  content?: FlatCardItem;

  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;
  private _dynamic_image!: DynamicImage2;

  private menu_helper: MenuHelper;

  constructor() {
    super();

    this._subtitle.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });

    this.menu_helper = MenuHelper.new(this);
  }

  // utils

  private load_thumbnails(
    thumbnails: Thumbnail[],
    type?: DynamicImage2StorageType,
    // options: Parameters<typeof load_thumbnails>[2] = 60,
  ) {
    switch (type) {
      case DynamicImage2StorageType.AVATAR:
        this._dynamic_image.avatar_thumbnails = thumbnails;
        break;
      case DynamicImage2StorageType.VIDEO_THUMBNAIL:
        this._dynamic_image.video_thumbnails = thumbnails;
        break;
      default:
        this._dynamic_image.cover_thumbnails = thumbnails;
        break;
    }
  }

  private set_title(title: string) {
    this._title.tooltip_text = this._title.label = title;
  }

  private subtitle_authors: (string | ArtistRun)[] = [];
  private subtitle_nodes: string[] = [];
  private type: string | null = null;

  show_type = false;

  private update_subtitle() {
    const subtitles = pretty_subtitles(
      this.subtitle_authors,
      this.subtitle_nodes,
      this.show_type ? this.type : null,
    );

    this._subtitle.label = subtitles.markup;
    this._subtitle.tooltip_text = subtitles.plain;
  }

  private set_subtitle(
    type: string,
    subtitle: string | (null | string | ArtistRun)[],
    nodes: (string | null)[] = [],
  ) {
    this.type = type;
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

  private setup_video(videoId: string | null) {
    if (videoId) {
      this._dynamic_image.setup_video(videoId);
    }
  }

  private setup_playlist(playlistId: string | null) {
    if (playlistId) {
      this._dynamic_image.setup_playlist(playlistId);
    }
  }

  private show_explicit(explicit: boolean) {
    this._explicit.visible = explicit;
  }

  show_flat_song(song: FlatSong) {
    this.content = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists ?? [], [song.views]);
    this.show_explicit(song.isExplicit);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${song.videoId}")`],
      [_("Play next"), `queue.add-song("${song.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${song.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${song.videoId}")`],
      song.album
        ? [
          _("Go to album"),
          `navigator.visit("muzika:album:${song.album.id}")`,
        ]
        : null,
    ];
  }

  show_song(song: Ranked<ParsedSong>) {
    this.content = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists, [song.views ?? song.duration]);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${song.videoId}")`],
      [_("Play next"), `queue.add-song("${song.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${song.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${song.videoId}")`],
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
  }

  show_video(video: Ranked<ParsedVideo>) {
    this.content = video;

    this.set_title(video.title);
    this.set_subtitle(_("Video"), video.artists ?? [], [video.views]);

    this.load_thumbnails(
      video.thumbnails,
      // DynamicImage2StorageType.VIDEO_THUMBNAIL,
    );
    this.setup_video(video.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${video.videoId}")`],
      [_("Play next"), `queue.add-song("${video.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${video.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${video.videoId}")`],
      video.artists && video.artists.length > 1
        ? [
          _("Go to artist"),
          `navigator.visit("muzika:artist:${video.artists[0].id}")`,
        ]
        : null,
    ];
  }

  show_search_song(song: SearchSong) {
    this.content = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists, [song.views ?? song.duration]);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${song.videoId}")`],
      [_("Play next"), `queue.add-song("${song.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${song.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${song.videoId}")`],
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
  }

  show_search_video(video: SearchVideo) {
    this.content = video;

    this.set_title(video.title);
    this.set_subtitle(_("Video"), video.artists, [
      video.views ?? video.duration,
    ]);

    this.load_thumbnails(
      video.thumbnails,
      // DynamicImage2StorageType.VIDEO_THUMBNAIL,
    );
    this.setup_video(video.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${video.videoId}")`],
      [_("Play next"), `queue.add-song("${video.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${video.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${video.videoId}")`],
      video.artists && video.artists.length > 1
        ? [
          _("Go to artist"),
          `navigator.visit("muzika:artist:${video.artists[0].id}")`,
        ]
        : null,
    ];
  }

  show_search_album(album: SearchAlbum) {
    this.content = album;

    this.show_type = true;
    this.set_title(album.title);
    this.set_subtitle(album.album_type, album.artists);

    this.load_thumbnails(album.thumbnails);

    this.menu_helper.props = [
      // TODO: get album audioPlaylistId
      // [
      //   _("Play next"),
      //   `queue.add-playlist("${album.audioPlaylistId}?next=true")`,
      // ],
      // [_("Add to queue"), `queue.add-playlist("${album.audioPlaylistId}")`],
      // [
      //   _("Add to playlist"),
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

  show_search_playlist(playlist: SearchPlaylist) {
    this.content = playlist;

    this.set_title(playlist.title);
    this.set_subtitle(_("Playlist"), playlist.authors);

    this.load_thumbnails(playlist.thumbnails);
    this.setup_playlist(playlist.browseId);

    this.menu_helper.props = [
      [
        _("Play next"),
        `queue.add-playlist("${playlist.browseId}?next=true")`,
      ],
      [_("Add to queue"), `queue.add-playlist("${playlist.browseId}")`],
      [
        _("Add to playlist"),
        `win.add-playlist-to-playlist("${playlist.browseId}")`,
      ],
    ];
  }

  show_search_artist(artist: SearchArtist) {
    this.content = artist;

    this.set_title(artist.name);

    this.show_type = false;
    this.set_subtitle(_("Playlist"), [artist.subscribers]);

    this.load_thumbnails(artist.thumbnails, DynamicImage2StorageType.AVATAR);
  }

  show_search_profile(profile: SearchProfile) {
    this.content = profile;

    this.set_title(profile.name);

    this.show_type = false;
    this.set_subtitle(_("Profile"), [profile.username]);

    this.load_thumbnails(profile.thumbnails, DynamicImage2StorageType.AVATAR);
    this.setup_playlist(profile.browseId);
  }

  show_search_radio(radio: SearchRadio) {
    this.content = radio;

    this.set_title(radio.title);

    this.show_type = false;
    this.set_subtitle(_("Radio"), []);

    this.load_thumbnails(radio.thumbnails);
    this.setup_playlist(radio.playlistId);

    this.menu_helper.props = [
      [
        _("Play next"),
        `queue.add-playlist("${radio.playlistId}?next=true")`,
      ],
      [_("Add to queue"), `queue.add-playlist("${radio.playlistId}")`],
      [
        _("Add to playlist"),
        `win.add-playlist-to-playlist("${radio.playlistId}")`,
      ],
    ];
  }

  show_mixed_song(song: ParsedSong) {
    this.content = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists, [song.views ?? song.duration]);
    this.show_explicit(song.isExplicit);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${song.videoId}")`],
      [_("Play next"), `queue.add-song("${song.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${song.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${song.videoId}")`],
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
  }

  show_mixed_artist(artist: RelatedArtist) {
    this.content = artist;

    // this.set_align(Gtk.Align.CENTER);
    this.set_title(artist.name);
    this.set_subtitle(_("Artist"), [artist.subscribers]);

    this.load_thumbnails(artist.thumbnails, DynamicImage2StorageType.AVATAR);
  }

  show_mixed_library_artist(artist: ParsedLibraryArtist) {
    this.content = artist;

    // this.set_align(Gtk.Align.CENTER);
    this.set_title(artist.name);
    this.set_subtitle(_("Artist"), [artist.subscribers ?? artist.songs]);

    // TODO: upscale image
    this.load_thumbnails(artist.thumbnails, DynamicImage2StorageType.AVATAR);
  }

  show_mixed_video(video: ParsedVideo) {
    this.content = video;

    this.set_title(video.title);
    this.set_subtitle(_("Video"), video.artists ?? [], [video.views]);

    this.load_thumbnails(
      video.thumbnails,
      // DynamicImage2StorageType.VIDEO_THUMBNAIL,
    );
    this.setup_video(video.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${video.videoId}")`],
      [_("Play next"), `queue.add-song("${video.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${video.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${video.videoId}")`],
      video.artists && video.artists.length > 1
        ? [
          _("Go to artist"),
          `navigator.visit("muzika:artist:${video.artists[0].id}")`,
        ]
        : null,
    ];
  }

  show_mixed_inline_video(video: ParsedSong) {
    this.content = video;

    this.set_title(video.title);
    this.set_subtitle(_("Video"), video.artists ?? [], [video.views]);

    this.load_thumbnails(
      video.thumbnails,
      // DynamicImage2StorageType.VIDEO_THUMBNAIL,
    );
    this.setup_video(video.videoId);

    this.menu_helper.props = [
      [_("Start radio"), `queue.play-song("${video.videoId}")`],
      [_("Play next"), `queue.add-song("${video.videoId}?next=true")`],
      [_("Add to queue"), `queue.add-song("${video.videoId}")`],
      [_("Add to playlist"), `win.add-to-playlist("${video.videoId}")`],
      video.artists && video.artists.length > 1
        ? [
          _("Go to artist"),
          `navigator.visit("muzika:artist:${video.artists[0].id}")`,
        ]
        : null,
    ];
  }

  show_mixed_playlist(playlist: ParsedPlaylist) {
    this.content = playlist;

    this.set_title(playlist.title);
    this.set_subtitle(
      _("Playlist"),
      playlist.description ? [playlist.description] : (playlist.authors ?? []),
    );

    this.load_thumbnails(playlist.thumbnails);
    this.setup_playlist(playlist.playlistId);

    this.menu_helper.props = [
      [
        _("Play next"),
        `queue.add-playlist("${playlist.playlistId}?next=true")`,
      ],
      [_("Add to queue"), `queue.add-playlist("${playlist.playlistId}")`],
      [
        _("Add to playlist"),
        `win.add-playlist-to-playlist("${playlist.playlistId}")`,
      ],
    ];
  }

  show_mixed_watch_playlist(playlist: WatchPlaylist) {
    this.content = playlist;

    this.set_title(playlist.title);
    this.show_type = false;
    this.set_subtitle(
      _("Radio"),
      _("Start Radio"),
    );

    this.load_thumbnails(playlist.thumbnails);
    this.setup_playlist(playlist.playlistId);

    this.menu_helper.props = [
      [
        _("Play next"),
        `queue.add-playlist("${playlist.playlistId}?next=true")`,
      ],
      [_("Add to queue"), `queue.add-playlist("${playlist.playlistId}")`],
      [
        _("Add to playlist"),
        `win.add-playlist-to-playlist("${playlist.playlistId}")`,
      ],
    ];
  }

  show_mixed_album(album: ParsedAlbum) {
    this.content = album;

    this.show_type = true;
    this.set_title(album.title);
    this.set_subtitle(_("Album"), album.artists, [album.year]);

    this.load_thumbnails(album.thumbnails);

    this.menu_helper.props = [
      [
        _("Play next"),
        `queue.add-playlist("${album.audioPlaylistId}?next=true")`,
      ],
      [_("Add to queue"), `queue.add-playlist("${album.audioPlaylistId}")`],
      [
        _("Add to playlist"),
        `win.add-playlist-to-playlist("${album.audioPlaylistId}")`,
      ],
      album.artists.length > 1
        ? [
          _("Go to artist"),
          `navigator.visit("muzika:artist:${album.artists[0].id}")`,
        ]
        : null,
    ];
  }

  show_inline_song(content: InlineSong) {
    switch (content.type) {
      case "flat-song":
        this.show_flat_song(content);
        break;
      case "inline-video":
      case "song":
        this.show_song(content);
        break;
      case "video":
        this.show_video(content);
        break;
      default:
        console.warn(`Unknown content type: ${(content as any).type}`);
    }
  }

  show_search_item(content: SearchContent) {
    switch (content.type) {
      case "song":
        this.show_search_song(content);
        break;
      case "video":
        this.show_search_video(content);
        break;
      case "album":
        this.show_search_album(content);
        break;
      case "artist":
        this.show_search_artist(content);
        break;
      case "profile":
        this.show_search_profile(content);
        break;
      case "playlist":
        this.show_search_playlist(content);
        break;
      case "radio":
        this.show_search_radio(content);
        break;
      default:
        console.error("Unknown search content type", (content as any).type);
        return;
    }
  }

  show_mixed_item(content: MixedCardItem) {
    switch (content.type) {
      case "song":
        this.show_mixed_song(content);
        break;
      case "channel":
      case "artist":
        this.show_mixed_artist(content);
        break;
      case "library-artist":
        this.show_mixed_library_artist(content);
        break;
      case "video":
        this.show_mixed_video(content);
        break;
      case "inline-video":
        this.show_mixed_inline_video(content);
        break;
      case "playlist":
        this.show_mixed_playlist(content);
        break;
      case "album":
        this.show_mixed_album(content);
        break;
      case "watch-playlist":
        this.show_mixed_watch_playlist(content);
        break;
      case "flat-song":
        this.show_flat_song(content);
      default:
        console.warn(`Unknown content type: ${content.type}`);
    }
  }

  set_state(state: DynamicActionState) {
    this._dynamic_image.state = state;
  }

  vfunc_unmap(): void {
    this._dynamic_image.clear();
    super.vfunc_unmap();
  }
}
