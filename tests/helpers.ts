/** Preserve a registry's key union when exercising every preset. */
export function keysOf<T extends object>(value: T): Extract<keyof T, string>[] {
  return Object.keys(value) as Extract<keyof T, string>[];
}
