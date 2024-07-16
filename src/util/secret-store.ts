import Secret from "gi://Secret";

import { Store } from "libmuse";

export interface Options {
  visitor_id: string;
}

export class MuzikaSecretStore extends Store {
  private map = new Map<string, unknown>();

  private attributes = {
    version: Secret.SchemaAttributeType.STRING,
  };

  private schema = Secret.Schema.new(
    pkg.name,
    Secret.SchemaFlags.NONE,
    this.attributes,
  );

  private key = "muse-data";

  constructor() {
    super();

    const password = Secret.password_lookup_sync(
      this.schema,
      { version: this.version },
      null,
    );

    try {
      if (password) {
        const json = JSON.parse(password);

        if (json.version !== this.version) {
          throw "";
        } else {
          this.map = new Map(Object.entries(json));
        }
      }
    } catch (error) {
      console.error("Failed to load secret store, resetting", error);

      this.map = new Map();
      this.set("version", this.version);
    }

    console.info("storing token to secret store");
  }

  get<T>(key: string): T | null {
    return (this.map.get(key) as T) ?? null;
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value);

    this.save();
  }

  delete(key: string): void {
    this.map.delete(key);

    this.save();
  }

  clear() {
    this.map.clear();

    this.save();

    Secret.password_clear_sync(this.schema, { version: this.version }, null);
  }

  private save() {
    const json = JSON.stringify(Object.fromEntries(this.map), null, 2);

    Secret.password_store_sync(
      this.schema,
      { version: this.version },
      Secret.COLLECTION_DEFAULT,
      this.key,
      json,
      null,
    );
  }
}
