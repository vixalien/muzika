import GObject from "gi://GObject";

export class SignalListeners {
  listeners = new Map<GObject.Object, number[]>();

  add(widget: GObject.Object, listener: number | number[]) {
    const listeners = this.listeners.get(widget) ?? [];
    listeners.push(...[listener].flat());
    this.listeners.set(widget, listeners);
  }

  clear() {
    this.listeners.forEach((listeners, widget) => {
      listeners.forEach((listener) => {
        widget.disconnect(listener);
      });
    });

    this.listeners.clear();
  }

  connect<
    Obj extends GObject.Object,
    Signal extends string,
    Return extends any,
  >(
    widget: Obj,
    signal: Signal,
    fn: Obj["connect"] extends (arg0: Signal, ...args: infer P) => Return
      ? (...args: P) => Return
      : Function,
  ) {
    const listener = widget.connect(signal, fn as any);
    this.add(widget, listener);
    return listener;
  }
}
