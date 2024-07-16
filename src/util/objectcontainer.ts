import GObject from "gi://GObject";

export class ObjectContainer<T> extends GObject.Object {
  static {
    if (!GObject.type_from_name("ObjectContainer")) {
      GObject.registerClass(
        {
          GTypeName: "ObjectContainer",
          Properties: {
            object: GObject.ParamSpec.object(
              "object",
              "Object",
              "The contained object",
              GObject.ParamFlags.READWRITE,
              GObject.Object.$gtype,
            ),
          },
        },
        this,
      );
    }
  }

  object: T;

  constructor(object: T) {
    super();

    this.object = object;
  }
}

export class OptionalObjectContainer<T> extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: "OptionalObjectContainer",
        Properties: {
          object: GObject.ParamSpec.object(
            "object",
            "Object",
            "The contained object",
            GObject.ParamFlags.READWRITE,
            GObject.Object.$gtype,
          ),
        },
      },
      this,
    );
  }

  object?: T;

  constructor(item?: T) {
    super();

    this.object = item;
  }
}
