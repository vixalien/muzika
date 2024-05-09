//////////// polyfills

// EventTarget
import "event-target-polyfill";

export class CustomEvent<T = unknown>
  extends Event
  implements globalThis.CustomEvent
{
  readonly detail: T;

  constructor(type: string, eventInitDict?: CustomEventInit<T>) {
    super(type);
    this.detail = eventInitDict?.detail ?? (null as T);
  }

  initCustomEvent(): void {
    throw new Error("Method not implemented.");
  }
}

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = CustomEvent;
}
