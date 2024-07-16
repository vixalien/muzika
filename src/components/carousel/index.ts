// Animation code borrowed from https://gitlab.gnome.org/GNOME/gnome-weather/-/blob/7769ce6f29a897a61010c4b496b60a5753e7edff/src/app/city.js#L74

import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import type { MixedContent, MixedItem, ParsedMoodOrGenre } from "libmuse";

import { MixedCardItem } from "../library/mixedcard.js";
import { PlayableContainer } from "src/util/playablelist.js";
import { CarouselListView } from "./view/list.js";
import { FlatGridView } from "./view/flatgrid.js";
import { CarouselMoodView } from "./view/mood.js";

export type RequiredMixedItem = NonNullable<MixedItem>;

export class Carousel<
  Content extends Partial<Omit<MixedContent, "contents" | "display">> & {
    contents: string | (MixedCardItem | null)[];
    display?: null | "list" | "mood";
  },
> extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "Carousel",
        Template:
          "resource:///com/vixalien/muzika/ui/components/carousel/carousel.ui",
        InternalChildren: [
          "title",
          "subtitle",
          "text",
          "text_view",
          "scrolled",
          "buttons",
          "left_button",
          "right_button",
          "carousel_stack",
          "more_button",
        ],
      },
      this,
    );
  }

  content?: Content;

  private _scrolled!: Gtk.ScrolledWindow;
  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _text!: Gtk.Box;
  private _text_view!: Gtk.TextView;
  private _left_button!: Gtk.Button;
  private _right_button!: Gtk.Button;
  private _carousel_stack!: Gtk.Stack;
  private _buttons!: Gtk.Box;
  private _more_button!: Gtk.Button;

  grid = false;

  model = Gio.ListStore.new(GObject.TYPE_OBJECT);

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(params?: Partial<Gtk.Box.ConstructorProperties>) {
    super(params);
  }

  left_button_clicked_cb() {
    this.begin_scroll_animation(Gtk.DirectionType.LEFT);
  }

  right_button_clicked_cb() {
    this.begin_scroll_animation(Gtk.DirectionType.RIGHT);
  }

  setup_more_button(more: string | null) {
    if (more == null) {
      this._more_button.visible = false;
      return;
    }

    this._more_button.set_detailed_action_name(more);
    this._more_button.visible = true;
  }

  begin_scroll_animation(
    direction: Gtk.DirectionType.RIGHT | Gtk.DirectionType.LEFT,
  ) {
    const hadjustment = this._scrolled.get_hadjustment();

    const target = Adw.PropertyAnimationTarget.new(hadjustment, "value");
    const animation = Adw.TimedAnimation.new(
      this._scrolled,
      hadjustment.value,
      direction === Gtk.DirectionType.RIGHT
        ? hadjustment.value + hadjustment.page_size
        : hadjustment.value - hadjustment.page_size,
      400,
      target,
    );

    animation.play();
  }

  sync_scroll_buttons() {
    const hadjustment = this._scrolled.get_hadjustment();

    if (
      hadjustment.get_upper() - hadjustment.get_lower() ==
      hadjustment.page_size
    ) {
      this._left_button.hide();
      this._right_button.hide();
    } else {
      this._left_button.show();
      this._right_button.show();

      if (hadjustment.value == hadjustment.get_lower()) {
        this._left_button.set_sensitive(false);
        this._right_button.set_sensitive(true);
      } else if (
        hadjustment.value >=
        hadjustment.get_upper() - hadjustment.page_size
      ) {
        this._left_button.set_sensitive(true);
        this._right_button.set_sensitive(false);
      } else {
        this._left_button.set_sensitive(true);
        this._right_button.set_sensitive(true);
      }
    }
  }

  show_listview(contents: (MixedCardItem | null)[]) {
    const listview = new CarouselListView();

    listview.items.splice(
      0,
      0,
      contents
        .filter((content) => content != null)
        .map((content) =>
          PlayableContainer.new_from_mixed_card_item(content as MixedCardItem),
        ),
    );

    this._scrolled.child = listview;
  }

  show_gridview(contents: (MixedCardItem | null)[]) {
    const flatsongview = new FlatGridView();

    flatsongview.items.splice(
      0,
      0,
      contents
        .filter((content) => content != null)
        .map((content) =>
          PlayableContainer.new_from_mixed_card_item(content as MixedCardItem),
        ),
    );

    this._scrolled.child = flatsongview;
  }

  show_moodview(contents: ParsedMoodOrGenre[]) {
    const moodview = new CarouselMoodView();

    moodview.items.splice(
      0,
      0,
      contents
        .filter((content) => content != null)
        .map((content) => PlayableContainer.new(content as ParsedMoodOrGenre)),
    );

    this._scrolled.child = moodview;
  }

  show_content(content: Content) {
    this._title.set_label(content.title ?? "");

    if (content.subtitle) {
      this._subtitle.set_label(content.subtitle);
      this._subtitle.set_visible(true);
    } else {
      this._subtitle.set_visible(false);
    }

    if (typeof content.contents === "string") {
      this._carousel_stack.visible_child = this._text;

      this._text_view.buffer.text = content.contents;
      this._text_view.remove_css_class("view");

      this._buttons.visible = false;
    } else {
      this._carousel_stack.visible_child = this._scrolled;

      if (content.display == "list") {
        this.show_gridview(content.contents);
      } else if (content.display == "mood") {
        // @ts-expect-error TODO fix this later
        this.show_moodview(content.contents);
      } else {
        this.show_listview(content.contents);
      }
    }
  }
}
