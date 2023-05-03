import GObject from "gi://GObject";

export class ObjectContainer<T extends Object> extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "ObjectContainer",
      Properties: {
        item: GObject.ParamSpec.object(
          "item",
          "item",
          "item",
          GObject.ParamFlags.READWRITE,
          GObject.Object.$gtype,
        ),
      },
    }, this);
  }

  item?: T;

  constructor() {
    super();
  }

  static new<T extends Object>(item: T) {
    const obj = new ObjectContainer<T>();
    obj.item = item;
    return obj;
  }
}
