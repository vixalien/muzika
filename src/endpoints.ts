import Gtk from "gi://Gtk?version=4.0";

import { Endpoint, MuzikaComponent } from "./navigation.js";

import { LibraryPage } from "./pages/library/index.js";
import { HomePage } from "./pages/home.js";
import { PlaylistPage } from "./pages/playlist.js";
import { ArtistPage } from "./pages/artist.js";
import { SearchPage } from "./pages/search.js";
import { AlbumPage } from "./pages/album.js";
import { LibraryPlaylistsPage } from "./pages/library/playlists.js";
import { LibraryAlbumsPage } from "./pages/library/albums.js";
import { LibraryArtistsPage } from "./pages/library/artists.js";
import { LibrarySubscriptionsPage } from "./pages/library/subscriptions.js";
import { LibrarySongsPage } from "./pages/library/songs.js";
import { HistoryPage } from "./pages/library/history.js";

export const endpoints: Endpoint<MuzikaComponent<unknown, unknown>>[] = [
  {
    uri: "home",
    title: "Home",
    component: () => new HomePage(),
    load(context) {
      return HomePage.load(context);
    },
  },
  // {
  //   uri: "playlist/:playlistId",
  //   title: "Playlist",
  //   component: () => new PlaylistPage(),
  //   async load(component: PlaylistPage, ctx) {
  //     await component.load_playlist(ctx.match.params.playlistId, ctx.signal);

  //     return {
  //       title: component.playlist?.title,
  //     };
  //   },
  // } as Endpoint<PlaylistPage>,
  // {
  //   uri: "album/:albumId",
  //   title: "Album",
  //   component: () => new AlbumPage(),
  //   async load(component: AlbumPage, ctx) {
  //     await component.load_album(ctx.match.params.albumId, ctx.signal);

  //     return {
  //       title: component.album?.title,
  //     };
  //   },
  // } as Endpoint<AlbumPage>,
  // {
  //   uri: "artist/:channelId",
  //   title: "Artist",
  //   component: () => new ArtistPage(),
  //   async load(component: ArtistPage, ctx) {
  //     await component.load_artist(ctx.match.params.channelId, ctx.signal);

  //     return {
  //       title: component.artist?.name,
  //     };
  //   },
  // } as Endpoint<ArtistPage>,
  // {
  //   uri: "search/:query",
  //   title: "Search Results",
  //   component: () => new SearchPage(),
  //   async load(component: SearchPage, ctx) {
  //     await component.search(
  //       decodeURIComponent(ctx.match.params.query),
  //       {
  //         signal: ctx.signal,
  //         ...Object.fromEntries(ctx.url.searchParams as any),
  //       },
  //     );
  //   },
  // } as Endpoint<SearchPage>,
  {
    uri: "library",
    title: "Library",
    component: () => new LibraryPage(),
    load: LibraryPage.load,
  },
  {
    uri: "library/playlists",
    title: "Library Playlists",
    component: () => new LibraryPlaylistsPage(),
    load: LibraryPlaylistsPage.load,
  },
  // {
  //   uri: "library/albums",
  //   title: "Library Albums",
  //   component: () => new LibraryAlbumsPage(),
  //   load(component: LibraryAlbumsPage, ctx) {
  //     return component.load_library({
  //       signal: ctx.signal,
  //       ...Object.fromEntries(ctx.url.searchParams as any),
  //     });
  //   },
  // } as Endpoint<LibraryAlbumsPage>,
  // {
  //   uri: "library/artists",
  //   title: "Library Artists",
  //   component: () => new LibraryArtistsPage(),
  //   load(component: LibraryArtistsPage, ctx) {
  //     return component.load_library({
  //       signal: ctx.signal,
  //       ...Object.fromEntries(ctx.url.searchParams as any),
  //     });
  //   },
  // } as Endpoint<LibraryArtistsPage>,
  // {
  //   uri: "library/subscriptions",
  //   title: "Library Subscriptions",
  //   component: () => new LibrarySubscriptionsPage(),
  //   load(component: LibrarySubscriptionsPage, ctx) {
  //     return component.load_library({
  //       signal: ctx.signal,
  //       ...Object.fromEntries(ctx.url.searchParams as any),
  //     });
  //   },
  // } as Endpoint<LibrarySubscriptionsPage>,
  // {
  //   uri: "library/songs",
  //   title: "Library Songs",
  //   component: () => new LibrarySongsPage(),
  //   load(component: LibrarySongsPage, ctx) {
  //     return component.load_library({
  //       signal: ctx.signal,
  //       ...Object.fromEntries(ctx.url.searchParams as any),
  //     });
  //   },
  // } as Endpoint<LibrarySongsPage>,
  // {
  //   uri: "history",
  //   title: "History",
  //   component: () => new HistoryPage(),
  //   load(component: HistoryPage) {
  //     return component.load_library();
  //   },
  // } as Endpoint<HistoryPage>,
];
