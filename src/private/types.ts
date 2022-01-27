export function parseNumber(asString: string | number) {
  const asNumber = parseInt(`${asString}`, 10);
  if (`${asNumber}` !== `${asString}`) {
    throw new Error(`Not a number: ${asString}`);
  }
  return { asString: `${asNumber}`, asNumber };
}

export function assertNumber(x: unknown): number {
  if (typeof x === 'number') { return x; }
  if (typeof x === 'string') {
    return parseNumber(x).asNumber;
  }
  throw new Error(`Expected number, got: ${JSON.stringify(x)}`);
}

export function assertList(x: unknown): string[] {
  if (!Array.isArray(x)) {
    throw new Error(`Expected list, got: ${JSON.stringify(x)}`);
  }
  return x.map(y => `${y}`);
}