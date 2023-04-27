import Gtk from "gi://Gtk?version=4.0";

import { Endpoint } from "./navigation.js";

import { HomePage } from "./pages/home.js";
import { PlaylistPage } from "./pages/playlist.js";
import { ArtistPage } from "./pages/artist.js";
import { SearchPage } from "./pages/search.js";

export const endpoints: Endpoint<Gtk.Widget>[] = [
  {
    uri: "home",
    title: "Home",
    component: () => new HomePage(),
    load(component: HomePage, ctx) {
      return component.load_home(ctx.signal);
    },
  } as Endpoint<HomePage>,
  {
    uri: "playlist/:playlistId",
    title: "Playlist",
    component: () => new PlaylistPage(),
    async load(component: PlaylistPage, ctx) {
      await component.load_playlist(ctx.match.params.playlistId, ctx.signal);

      return {
        title: component.playlist?.title,
      };
    },
  } as Endpoint<PlaylistPage>,
  {
    uri: "artist/:channelId",
    title: "Playlist",
    component: () => new ArtistPage(),
    async load(component: ArtistPage, ctx) {
      await component.load_artist(ctx.match.params.channelId, ctx.signal);

      return {
        title: component.artist?.name,
      };
    },
  } as Endpoint<ArtistPage>,
  {
    uri: "search/:query",
    title: "Search Results",
    component: () => new SearchPage(),
    async load(component: SearchPage, ctx) {
      await component.search(
        ctx.match.params.query,
        {
          signal: ctx.signal,
          ...Object.fromEntries(ctx.url.searchParams as any),
        },
      );
    },
  } as Endpoint<SearchPage>,
];
