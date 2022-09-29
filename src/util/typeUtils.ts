/**
 * Determines whether two objects have the same constructor.
 *
 * @param a The first object
 * @param b The second object
 * @returns True if `a` and `b` have the same constructor
 */
export function isSameType<T>(a: T, b: unknown): b is T {
  return (
    Object.getPrototypeOf(a).constructor ===
    Object.getPrototypeOf(b).constructor
  );
}