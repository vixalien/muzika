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
import { fetch } from "./fetch.js";
/// @ts-ignore
globalThis.fetch = fetch;

// console.log("URL", URL);

export * from "libmuse";
