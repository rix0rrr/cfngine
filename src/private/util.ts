export function mkDict<A>(xs: ReadonlyArray<readonly [string, A]>): Record<string, A> {
  const ret: Record<string, A> = {};
  for (const [k, v] of xs) {
    ret[k] = v;
  }
  return ret;
}

export function pick<A extends object, K extends keyof A>(x: A, ...keys: K[]): {[k in K]: A[k]} {
  const ret: any = {};
  for (const k of keys) {
    if (x[k] !== undefined) {
      ret[k] = x[k];
    }
  }
  return ret;
}