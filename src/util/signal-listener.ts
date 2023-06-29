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
}
