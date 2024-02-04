import { MuzikaPageMeta } from "./navigation.js";

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
import { ArtistAlbumsPage } from "./pages/artist-albums.js";
import { ChannelPage } from "./pages/channel.js";
import { ChannelPlaylistsPage } from "./pages/channel-playlists.js";
import { ExplorePage } from "./pages/explore.js";
import { ChartsPage } from "./pages/charts.js";
import { MoodsPage } from "./pages/moods.js";
import { MoodPlaylistsPage } from "./pages/mood-playlists.js";
import { NewReleasesPage } from "./pages/new-releases.js";

export const pageMetas: MuzikaPageMeta[] = [
  {
    uri: "home",
    title: _("Home"),
    build: () => new HomePage(),
    load: HomePage.load,
  },
  {
    uri: "playlist/:playlistId",
    title: _("Playlist"),
    build: () => new PlaylistPage(),
    load: PlaylistPage.load,
  },
  {
    uri: "album/:albumId",
    title: _("Album"),
    build: () => new AlbumPage(),
    load: AlbumPage.load,
  },
  {
    uri: "artist/:channelId",
    title: _("Artist"),
    build: () => new ArtistPage(),
    load: ArtistPage.load,
  },
  {
    uri: "search/:query",
    title: _("Search Results"),
    build: () => new SearchPage(),
    load: SearchPage.load,
  },
  {
    uri: "library",
    title: _("Library"),
    build: () => new LibraryPage(),
    load: LibraryPage.load,
  },
  {
    uri: "library/playlists",
    title: _("Library Playlists"),
    build: () => new LibraryPlaylistsPage(),
    load: LibraryPlaylistsPage.load,
  },
  {
    uri: "library/albums",
    title: _("Library Albums"),
    build: () => new LibraryAlbumsPage(),
    load: LibraryAlbumsPage.load,
  },
  {
    uri: "library/artists",
    title: _("Library Artists"),
    build: () => new LibraryArtistsPage(),
    load: LibraryArtistsPage.load,
  },
  {
    uri: "library/subscriptions",
    title: _("Library Subscriptions"),
    build: () => new LibrarySubscriptionsPage(),
    load: LibrarySubscriptionsPage.load,
  },
  {
    uri: "library/songs",
    title: _("Library Songs"),
    build: () => new LibrarySongsPage(),
    load: LibrarySongsPage.load,
  },
  {
    uri: "history",
    title: _("History"),
    build: () => new HistoryPage(),
    load: HistoryPage.load,
  },
  {
    uri: "artist-albums/:channelId/:params",
    title: _("Artist Albums"),
    build: () => new ArtistAlbumsPage(),
    load: ArtistAlbumsPage.load,
  },
  {
    uri: "channel/:channelId",
    title: _("Channel"),
    build: () => new ChannelPage(),
    load: ChannelPage.load,
  },
  {
    uri: "channel-playlists/:channelId/:params",
    title: _("Channel Playlists"),
    build: () => new ChannelPlaylistsPage(),
    load: ChannelPlaylistsPage.load,
  },
  {
    uri: "explore",
    title: _("Explore"),
    build: () => new ExplorePage(),
    load: ExplorePage.load,
  },
  {
    uri: "charts",
    title: _("Charts"),
    build: () => new ChartsPage(),
    load: ChartsPage.load,
  },
  {
    uri: "moods-and-genres",
    title: _("Moods and genres"),
    build: () => new MoodsPage(),
    load: MoodsPage.load,
  },
  {
    uri: "mood-playlists/:params",
    title: _("Mood"),
    build: () => new MoodPlaylistsPage(),
    load: MoodPlaylistsPage.load,
  },
  {
    uri: "new-releases",
    title: _("New Releases"),
    build: () => new NewReleasesPage(),
    load: NewReleasesPage.load,
  },
];
