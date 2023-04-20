import Gio from "gi://Gio";
import GLib from "gi://GLib";

//////////// polyfills

// EventTarget
import "event-target-polyfill";

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

//////////// libmuse

export * from "libmuse";
export type { Category } from "libmuse/types/parsers/browsing.js";

//////////// store

// types

/// @ts-expect-error
import { Store } from "libmuse/store.js";
/// @ts-expect-error
import { FetchClient, RequestInit } from "libmuse/request.js";
import { setup } from "libmuse";
import { GResponse } from "./polyfills/fetch.js";
import { hash } from "./util/hash.js";

const decoder = new TextDecoder();

export class GioFileStore extends (Store as any) {
  map: Map<string, unknown> = new Map();

  private path = Gio.file_new_for_path(
    GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, "store.json"]),
  );

  constructor() {
    super();
    // Load the file if it exists
    try {
      if (!this.path.get_parent()!.query_exists(null)) {
        this.path.get_parent()!.make_directory_with_parents(null);
      }

      const content = decoder.decode(this.path.load_contents(null)[1]);

      const json = JSON.parse(content);

      if (json.version !== this.version) {
        throw "";
      } else {
        this.map = new Map(Object.entries(json));
      }
    } catch (error) {
      console.error("Failed to load store, resetting", error);

      this.map = new Map();
      this.set("version", this.version);
    }

    console.log("storing data at", this.path.get_path());
  }

  get<T>(key: string): T | null {
    return this.map.get(key) as T ?? null;
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value);

    this.save();
  }

  delete(key: string): void {
    this.map.delete(key);

    this.save();
  }

  private save() {
    const json = JSON.stringify(Object.fromEntries(this.map), null, 2);

    // dnt-shim-ignore
    this.path.replace_contents(
      json,
      null,
      false,
      Gio.FileCreateFlags.NONE,
      null,
    );
  }
}

class CustomFetch extends FetchClient {
  cache_dir = Gio.file_new_for_path(
    GLib.build_filenamev([GLib.get_user_cache_dir(), pkg.name, "cache"]),
  );

  constructor() {
    super();

    console.log("caching data at", this.cache_dir.get_path());

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

    const cache = !path.startsWith("like/");

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
    if (cache) {
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
  /// @ts-expect-error
  store: new GioFileStore(),
  /// @ts-expect-error
  client: new CustomFetch(),
});
