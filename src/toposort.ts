/**
 * A queue that will deliver its values in topologically sorted order
 */
export class TopoQueue<A> {
  private readonly blocked: Set<string>;
  private available = new Array<string>();

  constructor(private readonly nodes: Record<string, A>, private readonly dependencies: Map<string, Set<string>>) {
    const nodeKeys = new Set(Object.keys(nodes));
    this.blocked = new Set(Object.keys(nodes));

    // Restrict dependencies to only keys in nodes
    for (const [name, deps] of this.dependencies.entries()) {
      this.dependencies.set(name, intersect(deps, nodeKeys));
    }
    this.determineAvailable();
  }

  public isEmpty() {
    return this.blocked.size + this.available.length === 0;
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
    for (const depSet of this.dependencies.values()) {
      depSet.delete(key);
    }
    this.determineAvailable();
  }

  private determineAvailable() {
    const avail = Array.from(this.blocked)
      .filter(key => !this.dependencies.get(key)?.size);

    for (const x of avail) {
      this.blocked.delete(x);
    }
    this.available.push(...avail);

    if (this.blocked.size > 0 && this.available.length === 0) {
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

function intersect<A>(xs: Set<A>, ys: Set<A>) {
  return new Set(Array.from(xs).filter(x => ys.has(x)));
}