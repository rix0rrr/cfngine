
export function everythingObject(prefix: string) {
  return new Proxy({}, {
    get(_target, name, _receiver) {
      return `${prefix}${String(name)}`;
    }
  });
}