import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import GdkPixbuf from "gi://GdkPixbuf";
import Gtk from "gi://Gtk?version=4.0";

/*
const IMAGE_URL = "https://cataas.com/cat";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(
  GdkPixbuf.Pixbuf,
  "new_from_stream_async",
  "new_from_stream_finish",
);

const input_stream = await getInputStream(IMAGE_URL);
const pixbuf = await GdkPixbuf.Pixbuf.new_from_stream_async(input_stream, null);
workbench.builder.get_object("picture").set_pixbuf(pixbuf);

async function getInputStream(url) {
  const session = new Soup.Session();
  const message = new Soup.Message({
    method: "GET",
    uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
  });
  const input_stream = await session.send_async(message, null, null);
  const { status_code, reason_phrase } = message;
  if (status_code !== 200) {
    throw new Error(`Got ${status_code}, ${reason_phrase}`);
  }
  return input_stream;
}

*/

import { fetch } from "../polyfills/fetch.js";

Gio._promisify(
  GdkPixbuf.Pixbuf,
  "new_from_stream_async",
  "new_from_stream_finish",
);

Gio._promisify(
  Gio.File.prototype,
  "replace_contents_async",
  "replace_contents_finish",
);

export class WebImage extends Gtk.Image {
  static {
    GObject.registerClass({
      GTypeName: "WebImage",
    }, this);
  }

  load(url: string) {
    fetch(url, {
      method: "GET",
    }).then(async (response) => {
      const buffer = await response.arrayBuffer();

      const loader = new GdkPixbuf.PixbufLoader();
      loader.write(new Uint8Array(buffer));
      loader.close();

      this.set_from_pixbuf(loader.get_pixbuf());
    });
  }
}

const IMAGE_CACHE_DIR = Gio.file_new_for_path(
  GLib.build_filenamev([GLib.get_user_cache_dir(), pkg.name, "image-cache"]),
);

if (!IMAGE_CACHE_DIR.query_exists(null)) {
  IMAGE_CACHE_DIR.make_directory_with_parents(null);
}

console.log("caching images at", IMAGE_CACHE_DIR.get_path());

export function image_exists_in_cache(href: string) {
  const url = new URL(href);

  if (url.hostname !== "lh3.googleusercontent.com") return false;

  const path = url.pathname + ".jpg";

  const cached_file = Gio.file_new_for_path(GLib.build_filenamev([
    IMAGE_CACHE_DIR.get_path()!,
    path,
  ]));

  if (cached_file.query_exists(null)) {
    return cached_file.get_path()!;
  } else {
    return false;
  }
}

export async function put_image_into_cache(href: string, buffer: ArrayBuffer) {
  const path = new URL(href).pathname + ".jpg";

  const cached_file = Gio.file_new_for_path(GLib.build_filenamev([
    IMAGE_CACHE_DIR.get_path()!,
    path,
  ]));

  return cached_file.replace_contents_async(
    new Uint8Array(buffer),
    null,
    false,
    Gio.FileCreateFlags.NONE,
    null,
  );
}

let loaded = false;

export function load_image(image: Gtk.Image, href: string) {
  const url = new URL(href);

  // https://lh3.googleusercontent.com
  const can_cache = url.hostname === "lh3.googleusercontent.com";

  let path: string | null = null;

  if (can_cache) {
    path = image_exists_in_cache(href) || null;
  }

  if (!path) {
    fetch(url, {
      method: "GET",
    }).then(async (response) => {
      const buffer = await response.arrayBuffer();

      const loader = new GdkPixbuf.PixbufLoader();
      loader.write(new Uint8Array(buffer));
      loader.close();

      image.set_from_pixbuf(loader.get_pixbuf());

      put_image_into_cache(href, buffer);
    }).catch((e) => console.error(e.name, e.message));
  } else {
    console.log("loaded image from cache");
    image.set_from_file(path);
  }
}
