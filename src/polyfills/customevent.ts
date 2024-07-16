//////////// polyfills

// EventTarget
import "event-target-polyfill";

export class CustomEvent<T = any>
  extends Event
  implements globalThis.CustomEvent
{
  readonly detail: T;

  constructor(type: string, eventInitDict?: CustomEventInit<T>) {
    super(type);
    this.detail = eventInitDict?.detail ?? (null as T);
  }

  initCustomEvent(
    _type: string,
    _bubbles?: boolean | undefined,
    _cancelable?: boolean | undefined,
    _detail?: any,
  ): void {
    throw new Error("Method not implemented.");
  }
}

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = CustomEvent;
}
