import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {
  ArtistRun,
  FlatSong,
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
  ParsedSong,
  ParsedVideo,
  Ranked,
} from "libmuse/types/parsers/browsing.js";
import { DynamicImage2, DynamicImage2StorageType } from "../dynamic-image-2.js";
import { DynamicActionState } from "../dynamic-action.js";

DynamicImage2;

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

  song?: InlineSong | SearchContent;

  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;
  private _dynamic_image!: DynamicImage2;

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
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists ?? [], [song.views]);
    this.show_explicit(song.isExplicit);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_song(song: Ranked<ParsedSong>) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists, [song.views ?? song.duration]);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_video(song: Ranked<ParsedVideo>) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(_("Video"), song.artists ?? [], [song.views]);

    this.load_thumbnails(
      song.thumbnails,
      // DynamicImage2StorageType.VIDEO_THUMBNAIL,
    );
    this.setup_video(song.videoId);
  }

  show_search_song(song: SearchSong) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(_("Song"), song.artists, [song.views ?? song.duration]);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_search_video(song: SearchVideo) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(_("Video"), song.artists, [song.views ?? song.duration]);

    this.load_thumbnails(
      song.thumbnails,
      // DynamicImage2StorageType.VIDEO_THUMBNAIL,
    );
    this.setup_video(song.videoId);
  }

  show_search_album(song: SearchAlbum) {
    this.song = song;

    this.show_type = true;
    this.set_title(song.title);
    this.set_subtitle(song.album_type, song.artists);

    this.load_thumbnails(song.thumbnails);
  }

  show_search_playlist(song: SearchPlaylist) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(_("Playlist"), song.authors);

    this.load_thumbnails(song.thumbnails);
    this.setup_playlist(song.browseId);
  }

  show_search_artist(song: SearchArtist) {
    this.song = song;

    this.set_title(song.name);

    this.show_type = false;
    this.set_subtitle(_("Playlist"), [song.subscribers]);

    this.load_thumbnails(song.thumbnails, DynamicImage2StorageType.AVATAR);
    this.setup_playlist(song.browseId);
  }

  show_search_profile(song: SearchProfile) {
    this.song = song;

    this.set_title(song.name);

    this.show_type = false;
    this.set_subtitle(_("Profile"), [song.username]);

    this.load_thumbnails(song.thumbnails, DynamicImage2StorageType.AVATAR);
    this.setup_playlist(song.browseId);
  }

  show_search_radio(song: SearchRadio) {
    this.song = song;

    this.set_title(song.title);

    this.show_type = false;
    this.set_subtitle(_("Radio"), []);

    this.load_thumbnails(song.thumbnails);
    this.setup_playlist(song.playlistId);
  }

  show_item(content: InlineSong) {
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

  set_state(state: DynamicActionState) {
    this._dynamic_image.state = state;
  }

  vfunc_unmap(): void {
    this._dynamic_image.clear();
    super.vfunc_unmap();
  }
}
