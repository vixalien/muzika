import GLib from "gi://GLib";

//////////// polyfills

import "./customevent.js";

export class AbortSignal extends EventTarget implements globalThis.AbortSignal {
  private _aborted = false;

  dispatchEvent(event: CustomEvent): boolean {
    if (event.type === "abort") {
      this._aborted = true;
      this._reason = event.detail;
    }

    return super.dispatchEvent(event);
  }

  get aborted() {
    return this._aborted;
  }

  private _reason: unknown = null;

  get reason() {
    return this._reason;
  }

  private _onabort: ((this: globalThis.AbortSignal, ev: Event) => void) | null =
    null;

  get onabort() {
    return this._onabort;
  }

  set onabort(value) {
    this._onabort = value;
    if (value) {
      this.addEventListener("abort", value);
    } else {
      this.removeEventListener("abort", value);
    }
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason;
    }
  }

  static timeout(ms: number) {
    const signal = new this();

    GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, ms, () => {
      signal.dispatchEvent(
        new CustomEvent("abort", {
          detail: new DOMException(
            "The operation was aborted. ",
            "TimeoutError",
          ),
        }),
      );

      return GLib.SOURCE_REMOVE;
    });

    return signal;
  }

  static abort() {
    const signal = new this();

    signal.dispatchEvent(
      new CustomEvent("abort", {
        detail: new DOMException("The operation was aborted. ", "AbortError"),
      }),
    );

    return signal;
  }
}

export class AbortController implements globalThis.AbortController {
  readonly signal = new AbortSignal();

  abort() {
    this.signal.dispatchEvent(
      new CustomEvent("abort", {
        detail: new DOMException("The operation was aborted", "AbortError"),
      }),
    );
  }
}

if (!globalThis.AbortSignal) {
  // @ts-expect-error overriding a global
  globalThis.AbortSignal = AbortSignal;
}

if (!globalThis.AbortController) {
  globalThis.AbortController = AbortController;
}
