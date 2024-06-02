import Gio from "gi://Gio";

export const Settings = new Gio.Settings({
  schema: "com.vixalien.muzika.Devel",
});

export const PlayerStateSettings = new Gio.Settings({
  schema: `${pkg.name}.PlayerState`,
});
