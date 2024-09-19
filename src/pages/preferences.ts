import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { ObjectContainer } from "src/util/objectcontainer";
import { AudioQualities, VideoQualities } from "src/player";
import { Settings } from "src/util/settings.js";

export class MuzikaPreferencesDialog extends Adw.PreferencesDialog {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaPreferencesDialog",
        Template: "resource:///com/vixalien/muzika/ui/pages/preferences.ui",
        InternalChildren: [
          "audio_quality",
          "video_quality",
          "background_play",
          "inhibit_suspend",
        ],
      },
      this,
    );
  }

  private _video_quality!: Adw.ComboRow;
  private _audio_quality!: Adw.ComboRow;
  private _background_play!: Adw.SwitchRow;
  private _inhibit_suspend!: Adw.SwitchRow;

  constructor() {
    super();

    this.prepare_quality(this._audio_quality, AudioQualities, "audio-quality");
    this.prepare_quality(this._video_quality, VideoQualities, "video-quality");

    Settings.bind(
      "background-play",
      this._background_play,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    Settings.bind(
      "inhibit-suspend",
      this._inhibit_suspend,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
  }

  private prepare_quality(
    widget: typeof this._audio_quality | typeof this._video_quality,
    qualities: typeof AudioQualities | typeof VideoQualities,
    gsettings_key: string,
  ) {
    const model = new Gio.ListStore();
    model.splice(
      0,
      0,
      qualities.map((e) => new ObjectContainer(e)),
    );

    widget.expression = Gtk.ClosureExpression.new(
      GObject.TYPE_STRING,
      (container: ObjectContainer<(typeof qualities)[number]>) => {
        return container.object.name;
      },
      [],
    );

    widget.model = model;
    widget.selected = Settings.get_enum(gsettings_key);

    widget.connect("notify::selected", () => {
      const value = widget.selected;

      if (value != Settings.get_enum(gsettings_key)) {
        Settings.set_enum(gsettings_key, value);
      }
    });
  }
}
