import Gio from "gi://Gio";
import GLib from "gi://GLib";

/// @ts-expect-error
import { Store } from "libmuse/store.js";

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
      console.error(_("Failed to load store, resetting"), error);

      this.map = new Map();
      this.set("version", this.version);
    }

    console.log(_("storing data at"), this.path.get_path());
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

export const store = new GioFileStore();
