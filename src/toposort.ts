/**
 * A queue that will deliver its values in topologically sorted order
 */
export class TopoQueue<A> {
  private readonly remaining: Set<string>;
  private available!: Array<string>;

  constructor(private readonly nodes: Record<string, A>, private readonly dependencies: Map<string, Set<string>>) {
    this.remaining = new Set(Object.keys(nodes));
    this.determineAvailable();
  }

  public isEmpty() {
    return Object.keys(this.remaining).length === 0;
  }

  public take(): QueueElement<A> {
    const identifier = this.available.shift();
    if (!identifier) {
      throw new Error('Cannot \'take\', queue is empty');
    }

    return {
      identifier,
      element: this.nodes[identifier]!,
      remove: () => {
        this.advance(identifier);
      },
    };
  }

  public withNext<B>(block: (identifier: string, element: A) => B): B {
    const one = this.take();
    const ret = block(one.identifier, one.element);
    one.remove();
    return ret;
  }

  public peek(): PeekElements<A> {
    const elements = this.available.map((key) => [key, this.nodes[key]!] as const);
    return {
      elements,
      skip: () => {
        this.available.splice(0, this.available.length);
        for (const el of elements) {
          this.advance(el[0]);
        }
      },
    };
  }

  private advance(key: string) {
    this.remaining.delete(key);
    for (const depSet of this.dependencies.values()) {
      depSet.delete(key);
    }
  }

  private determineAvailable() {
    this.available = Array.from(this.remaining)
      .filter((key) =>
        !Array.from(this.dependencies.values()).some((deps) => deps.has(key)));

    if (this.remaining.size > 0 && this.available.length === 0) {
      const cycle = findCycle(this.dependencies);
      throw new Error(`Dependency cycle in graph: ${cycle.join(' => ')}`);
    }
  }
}

export interface QueueElement<A> {
  readonly identifier: string;
  readonly element: A;

  remove(): void;
}

export interface PeekElements<A> {
  readonly elements: Array<readonly [string, A]>;

  skip(): void;
}

/**
 * Find cycles in a graph
 *
 * Not the fastest, but effective and should be rare
 */
function findCycle(deps: Map<string, Set<string>>): string[] {
  for (const node of deps.keys()) {
    const cycle = recurse(node, [node]);
    if (cycle) { return cycle; }
  }
  throw new Error('No cycle found. Assertion failure!');

  function recurse(node: string, path: string[]): string[] | undefined {
    for (const dep of deps.get(node) ?? []) {
      if (dep === path[0]) { return [...path, dep]; }

      const cycle = recurse(dep, [...path, dep]);
      if (cycle) { return cycle; }
    }

    return undefined;
  }
}