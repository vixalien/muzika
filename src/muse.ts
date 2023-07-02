import Gio from "gi://Gio";
import GLib from "gi://GLib";

// URL, URLSearchParams
import "core-js/features/url";

// Headers
import { Headers } from "headers-polyfill";
/// @ts-ignore
globalThis.Headers = Headers;

// Headers
import "./polyfills/fetch.js";

// base64
import "./polyfills/base64.js";

// abortcontroller
import "./polyfills/abortcontroller.js";

//////////// libmuse

export * from "libmuse";

//////////// store

// types

/// @ts-expect-error
import { FetchClient, RequestInit } from "libmuse/request.js";
import { setup } from "libmuse";
import { GResponse } from "./polyfills/fetch.js";
import { hash } from "./util/hash.js";
import { store } from "./util/secret-store.js";

const decoder = new TextDecoder();

class CustomFetch extends FetchClient {
  cache_dir = Gio.file_new_for_path(
    GLib.build_filenamev([GLib.get_user_cache_dir(), pkg.name, "cache"]),
  );

  CACHE = false;

  constructor() {
    super();

    console.log("caching data", this.cache_dir.get_path());

    // console.log("exists", !this.cache_dir.get_parent()!.query_exists(null));

    if (!this.cache_dir.query_exists(null)) {
      this.cache_dir.make_directory_with_parents(null);
    }
  }

  async request(path: string, options: RequestInit) {
    console.debug("REQUEST", options.method, path);

    // caching
    const cache_name = `${
      hash(
        JSON.stringify({ ...options.data, ...options.params, path } || {}),
      )
    }.json`;

    const cache = this.CACHE && !path.startsWith("like/");

    const cached_file = Gio.file_new_for_path(GLib.build_filenamev([
      this.cache_dir.get_path()!,
      cache_name,
    ]));

    try {
      const cached_contents = decoder.decode(
        cached_file.load_contents(null)[1],
      );

      const cached_json = JSON.parse(cached_contents);

      if (cache && cached_json) {
        console.debug("CACHED", options.method, path);
        return new GResponse(JSON.stringify(cached_json));
      }
    } catch (error) {
      // console.error("Failed to load cache", error);
    }
    // end caching

    const response = await super.request(path, options) as GResponse;

    // store into cache
    if (cache && response.ok) {
      try {
        // await Deno.mkdir("store/cache", { recursive: true });
        // await Deno.writeTextFile(
        //   cache_path,
        //   JSON.stringify(await response.clone().json(), null, 2),
        // );

        cached_file.replace_contents(
          JSON.stringify(
            await response.clone().then((response) => response.json()),
            null,
            2,
          ),
          null,
          false,
          Gio.FileCreateFlags.NONE,
          null,
        );
      } catch (error) {
        console.error("Failed to cache", (error as Error).toString());
        // not json probably: ignore
      }
    }

    return response;
  }
}

setup({
  store: store,
  /// @ts-expect-error
  client: new CustomFetch(),
});
