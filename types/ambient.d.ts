declare function _(id: string): string;
declare function C_(context: string, id: string): string;
declare function print(args: string): void;
declare function log(obj: object, others?: object[]): void;
declare function log(msg: string, substitutions?: unknown[]): void;

declare const pkg: {
  version: string;
  name: string;
};
declare interface String {
  format(...replacements: string[]): string;
  format(...replacements: number[]): string;
}
declare interface Number {
  toFixed(digits: number): number;
}

declare module imports {
  const format: {
    format(this: string, ...args: unknown[]): string;
    printf(fmt: string, ...args: unknown[]): string;
    vprintf(fmt: string, args: unknown[]): string;
  };
}

declare module "gettext" {
  export function gettext(id: string): string;
  export function ngettext(singular: string, plural: string, n: number): string;
}
