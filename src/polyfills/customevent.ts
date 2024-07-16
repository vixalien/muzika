//////////// polyfills

// EventTarget
import "event-target-polyfill";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CustomEvent<T = any>
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
