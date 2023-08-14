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
    Signal extends string,
    Obj extends GObject.Object,
  >(
    widget: Obj,
    signal: Signal,
    fn: (...args: any[]) => any,
  ) {
    const listener = widget.connect(signal, fn as any);
    this.add(widget, listener);
    return listener;
  }
}
