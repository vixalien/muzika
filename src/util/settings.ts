import Gio from "gi://Gio";

export const Settings = new Gio.Settings({ schema: pkg.name });
