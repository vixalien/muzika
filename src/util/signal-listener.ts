import GObject from "gi://GObject";

export class SignalListeners {
  listeners = new Map<GObject.Object, number[]>();
  bindings: GObject.Binding[] = [];

  add(widget: GObject.Object, listener: number | number[]) {
    const listeners = this.listeners.get(widget) ?? [];
    listeners.push(...[listener].flat());
    this.listeners.set(widget, listeners);
  }

  add_bindings(...bindings: GObject.Binding[]) {
    this.bindings.push(...bindings);
  }

  add_binding(binding: GObject.Binding) {
    this.add_bindings(binding);
  }

  clear() {
    this.listeners.forEach((listeners, widget) => {
      listeners.forEach((listener) => {
        widget.disconnect(listener);
      });
    });

    this.bindings.forEach((binding) => {
      binding.unbind();
    });

    this.listeners.clear();
    this.bindings.length = 0;
  }

  connect<Signal extends string, Obj extends GObject.Object>(
    widget: Obj,
    signal: Signal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => unknown,
  ) {
    const listener = widget.connect(signal, fn);
    this.add(widget, listener);
    return listener;
  }
}
