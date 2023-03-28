import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

export function promiseTask(
  object: any,
  method: any,
  finish: any,
  ...args: any[]
) {
  return new Promise((resolve, reject) => {
    object[method](...args, (self: any, asyncResult: any) => {
      try {
        resolve(object[finish](asyncResult));
      } catch (err) {
        reject(err);
      }
    });
  });
}

export interface FetchOptions {
  body?: string | Uint8Array;
  url?: string;
  headers?: Record<string, string>;
  method?: string;
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
  private _stream: Gio.InputStream;
  private _bodyUsed: boolean;
  private _headers: Headers;
  private _status: number;
  private _statusText: string;
  private _ok: boolean;
  private _type: string;
  private _url: string;
  private _redirected: boolean;

  constructor(
    body?: Gio.InputStream | ArrayBuffer | DataView | Uint8Array | string,
    options?: GResponseOptions,
  ) {
    let stream: Gio.InputStream;

    if (body instanceof Gio.InputStream) {
      stream = body;
    } else if (body instanceof Uint8Array) {
      stream = Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new(body),
      );
    } else if (body instanceof ArrayBuffer) {
      // first convert to Uint8Array
      stream = Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new(new Uint8Array(body)),
      );
    } else if (body instanceof DataView) {
      // first convert to Uint8Array
      stream = Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new(new Uint8Array(body.buffer)),
      );
    } else if (typeof body === "string") {
      stream = Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new(encoder.encode(body)),
      );
    } else {
      stream = Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new(new Uint8Array()),
      );
    }

    this._stream = stream;
    this._bodyUsed = false;
    this._headers = new Headers(options?.headers || {});
    this._status = options?.status || 200;
    this._statusText = options?.statusText || "OK";
    this._ok = this._status >= 200 && this._status < 300;
    this._type = "basic";
    this._url = options?.url || "";
    this._redirected = options?.redirected || false;
  }

  get body() {
    if (this._bodyUsed) {
      throw new Error("body already used");
    }

    this._bodyUsed = true;

    return this._stream;
  }

  get bodyUsed() {
    return this._bodyUsed;
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
    const bytes = await this.gBytes();

    this._bodyUsed = false;

    this._stream = Gio.MemoryInputStream.new_from_bytes(bytes);

    const stream = Gio.MemoryInputStream.new_from_bytes(bytes);

    return new GResponse(stream, {
      status: this._status,
      statusText: this._statusText,
      headers: this._headers,
      url: this._url,
      redirected: this._redirected,
    });
  }

  async gBytes() {
    const outputStream = Gio.MemoryOutputStream.new_resizable();

    await promiseTask(
      outputStream,
      "splice_async",
      "splice_finish",
      this.body,
      Gio.OutputStreamSpliceFlags.CLOSE_TARGET |
        Gio.OutputStreamSpliceFlags.CLOSE_SOURCE,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    const bytes = outputStream.steal_as_bytes();
    return bytes;
  }

  async arrayBuffer() {
    const bytes = await this.gBytes();
    return bytes.toArray().buffer;
  }

  async text() {
    const bytes = await this.gBytes();
    return decoder.decode(bytes.toArray());
  }

  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }
}

export async function fetch(url: string | URL, options: FetchOptions = {}) {
  if (typeof url !== "string" && ("href" in (url as URL))) {
    url = (url as URL).href;
  }

  const session = new Soup.Session();
  const method = options.method?.toUpperCase() || "GET";

  const uri = GLib.Uri.parse(url as string, GLib.UriFlags.NONE);

  const message = new Soup.Message({
    method,
    uri,
  });
  const headers = options.headers || {};

  const request_headers = message.get_request_headers();
  for (const header in headers) {
    request_headers.append(header, headers[header]);
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

  const inputStream = await promiseTask(
    session,
    "send_async",
    "send_finish",
    message,
    null,
    null,
  ) as Gio.InputStream;

  const { status_code, reason_phrase } = message;

  return new GResponse(inputStream, {
    status: status_code,
    statusText: reason_phrase,
    url: uri.to_string(),
  });
}

// @ts-ignore
window.fetch = fetch;
