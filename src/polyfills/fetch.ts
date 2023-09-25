import Soup from "gi://Soup";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

// streams polyfill
import "web-streams-polyfill";

import "./abortcontroller.js";
import "./customevent.js";
import "./domexception.js";

Gio._promisify(
  Soup.Session.prototype,
  "send_async",
  "send_finish",
);

Gio._promisify(
  Gio.InputStream.prototype,
  "read_bytes_async",
  "read_bytes_finish",
);

export interface FetchOptions {
  body?: string | Uint8Array;
  url?: string;
  headers?: Record<string, string>;
  method?: string;
  signal?: AbortSignal | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface GResponseOptions {
  status?: number;
  statusText?: string;
  headers?: Record<string, string> | Headers | [string, string][];
  url?: string;
  redirected?: boolean;
}

export class GResponse {
  private _body: ReadableStream;
  private _headers: Headers;
  private _status: number;
  private _statusText: string;
  private _ok: boolean;
  private _type: string;
  private _url: string;
  private _redirected: boolean;

  constructor(
    body?: ReadableStream | ArrayBuffer | DataView | Uint8Array | string,
    options?: GResponseOptions,
  ) {
    let stream: ReadableStream;

    if (body instanceof ReadableStream) {
      stream = body;
    } else {
      stream = new ReadableStream({
        start(controller) {
          if (body instanceof ArrayBuffer) {
            controller.enqueue(new Uint8Array(body));
          } else if (body instanceof DataView) {
            controller.enqueue(new Uint8Array(body.buffer));
          } else if (body instanceof Uint8Array) {
            controller.enqueue(body);
          } else if (typeof body === "string") {
            controller.enqueue(encoder.encode(body));
          } else {
            controller.enqueue(new Uint8Array());
          }
          controller.close();
        },
      });
    }

    this._body = stream;
    this._headers = new Headers(options?.headers || {});
    this._status = options?.status || 200;
    this._statusText = options?.statusText || "OK";
    this._ok = this._status >= 200 && this._status < 300;
    this._type = "basic";
    this._url = options?.url || "";
    this._redirected = options?.redirected || false;
  }

  get body() {
    return this._body;
  }

  get bodyUsed() {
    return this._body.locked;
  }

  get headers() {
    return this._headers;
  }

  get ok() {
    return this._ok;
  }

  get redirected() {
    return this._redirected;
  }

  get status() {
    return this._status;
  }

  get statusText() {
    return this._statusText;
  }

  get type() {
    return this._type;
  }

  get url() {
    return this._url;
  }

  async clone() {
    const streams = this.body.tee();

    this._body = streams[0];

    return new GResponse(streams[1], {
      status: this._status,
      statusText: this._statusText,
      headers: this._headers,
      url: this._url,
      redirected: this._redirected,
    });
  }

  async arrayBuffer() {
    const reader = this._body.getReader();
    let chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const bytes = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    return bytes.buffer;
  }

  async text() {
    const bytes = await this.arrayBuffer();
    return decoder.decode(bytes);
  }

  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }
}

const SOUP_CACHE_DIR = Gio.file_new_for_path(
  GLib.build_filenamev([GLib.get_user_cache_dir(), pkg.name, "soup-cache"]),
);

if (!SOUP_CACHE_DIR.query_exists(null)) {
  SOUP_CACHE_DIR.make_directory_with_parents(null);
}

console.log("caching soup requests at", SOUP_CACHE_DIR.get_path());

const SESSION = new Soup.Session({
  // change from the default of 10 and 2 respectively
  // because most of the connections go to the same host
  max_conns: 32,
  max_conns_per_host: 8,
});

export const cache = Soup.Cache.new(
  SOUP_CACHE_DIR.get_path()!,
  Soup.CacheType.SHARED,
);
// set max cache size to 16 megabytes
cache.set_max_size(16e+6);

cache.load();

SESSION.add_feature(cache);

export async function fetch(url: string | URL, options: FetchOptions = {}) {
  if (typeof url !== "string" && ("href" in (url as URL))) {
    url = (url as URL).href;
  }

  const method = options.method?.toUpperCase() || "GET";

  const uri = GLib.Uri.parse(url as string, GLib.UriFlags.NONE);

  const message = new Soup.Message({
    method,
    uri,
  });
  const headers = options.headers || {};

  const request_headers = message.get_request_headers();

  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      request_headers.append(key, value);
    });
  } else {
    for (const header in headers) {
      request_headers.append(header, headers[header]);
    }
  }

  if (typeof options.body === "string") {
    message.set_request_body_from_bytes(
      null,
      new GLib.Bytes(
        typeof options.body === "string"
          ? encoder.encode(options.body)
          : options.body,
      ),
    );
  }

  const cancellable = Gio.Cancellable.new();

  if (options.signal) {
    options.signal.addEventListener("abort", () => {
      cancellable.cancel();
    });
  }

  return new Promise<GResponse>(async (resolve, reject) => {
    const inputStream = await SESSION.send_async(
      message,
      GLib.PRIORITY_DEFAULT,
      cancellable,
    ).catch((e) => {
      if (
        (e instanceof Gio.IOErrorEnum) &&
        (e.code === Gio.IOErrorEnum.CANCELLED)
      ) {
        if (options.signal && options.signal.reason instanceof DOMException) {
          reject(options.signal.reason);
        } else {
          reject(new DOMException("The request was aborted", "AbortError"));
        }
      } else {
        reject(e);
      }
    });

    if (!inputStream) {
      reject(new Error("Couldn't connect to the internet. Are you offline?"));
      return;
    }

    const response_headers = message.get_response_headers();
    const headers = new Headers();

    response_headers.foreach((name, value) => {
      headers.append(name, value);
    });

    const stream = new ReadableStream({
      async pull(controller) {
        return inputStream.read_bytes_async(
          1024 * 256,
          GLib.PRIORITY_DEFAULT,
          null,
        ).then((result) => {
          if (result.get_size() === 0) {
            controller.close();
            return;
          }

          controller.enqueue(result.toArray());
        });
      },
    });

    const response = new GResponse(stream, {
      status: message.status_code,
      statusText: message.reason_phrase,
      headers,
      url: url as string,
    });

    resolve(response);
  });
}

// @ts-ignore
window.fetch = fetch;
