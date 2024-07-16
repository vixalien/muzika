// URL, URLSearchParams
import "core-js/features/url";

// Headers
import { Headers } from "headers-polyfill";
globalThis.Headers = Headers;

// Headers
import "./polyfills/fetch.js";

// base64
import "./polyfills/base64.js";

// abortcontroller
import "./polyfills/abortcontroller.js";

//////////// store

// types

import { setup } from "libmuse";
import { MuzikaSecretStore } from "./util/secret-store.js";

setup({
  store: new MuzikaSecretStore(),
});
