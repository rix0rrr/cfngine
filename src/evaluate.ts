import { schema } from './schema';
import { analyzeSubPattern } from './private/sub';
import { Template } from './template';
import { mkDict } from './private/util';
import { assertBoolean, assertNumber, assertString } from './private/types';

export interface ContextRecord {
  readonly primaryValue: ContextValue;
  readonly attributes?: Record<string, any>;
}

export type Context = Map<string, ContextRecord>;

export const NO_VALUE = Symbol('AWS::NoValue');

export type ContextValue = string | string[] | symbol;

export type Thunk<A> = () => A;

export interface IntrinsicsEvaluator {
  base64(x: string): string;
  cidr(base: string, a: number, b: number): string;
  findInMap(mapName: string, key1: string, key2: string): string;
  getAzs(region: string): string[];
  getAtt(logicalId: string, attr: string): any;
  if_<A>(conditionId: string, ifYes: A, ifNo: A): A;
  importValue(exportName: string): any;
  join(delimiter: string, elements: string[]): string;
  select(index: number, elements: any[]): any;
  split(delimiter: string, x: string): string[];
  ref(logicalId: string): any;
  sub(x: string, additionalContext?: Record<string, string>): string;
  equals(a: string, b: string): boolean;
  and(xs: unknown[]): boolean;
  or(xs: unknown[]): boolean;
}

export interface UncheckedEvaluator {
  base64(x: unknown): string;
  cidr(base: unknown, a: unknown, b: unknown): string;
  findInMap(mapName: unknown, key1: unknown, key2: unknown): string;
  getAzs(region: unknown): string[];
  getAtt(logicalId: unknown, attr: unknown): any;
  if_<A>(conditionId: unknown, ifYes: A, ifNo: A): A;
  importValue(exportName: unknown): any;
  join(delimiter: unknown, elements: unknown[]): string;
  select(index: unknown, elements: unknown[]): unknown;
  split(delimiter: unknown, x: unknown): string[];
  ref(logicalId: unknown): any;
  sub(x: unknown, additionalContext?: unknown): string;
  equals(a: unknown, b: unknown): boolean;
  and(xs: boolean[]): boolean;
  or(xs: boolean[]): boolean;
}

/**
 * Adds type checking around an evaluator
 */
export class TypecheckedEvaluator implements UncheckedEvaluator {
  constructor(private readonly inner: IntrinsicsEvaluator) {
  }

  base64(x: unknown): string {
    return this.inner.base64(assertString(x));
  }

  cidr(base: unknown, a: unknown, b: unknown): string {
    return this.inner.cidr(assertString(base), assertNumber(a), assertNumber(b));
  }

  findInMap(mapName: unknown, key1: unknown, key2: unknown): string {
    return this.inner.findInMap(assertString(mapName), assertString(key1), assertString(key2));
  }

  getAzs(region: unknown): string[] {
    return this.inner.getAzs(assertString(region));
  }

  getAtt(logicalId: unknown, attr: unknown) {
    return this.inner.getAtt(assertString(logicalId), assertString(attr));
  }

  if_<A>(conditionId: unknown, ifYes: A, ifNo: A) {
    return this.inner.if_(assertString(conditionId), ifYes, ifNo);
  }

  importValue(exportName: unknown) {
    return this.inner.importValue(assertString(exportName));
  }

  join(delimiter: unknown, elements: unknown[]): string {
    return this.inner.join(assertString(delimiter), elements.map(assertString));
  }

  select(index: unknown, elements: unknown[]): unknown {
    return this.inner.select(assertNumber(index), elements);
  }

  split(delimiter: unknown, x: unknown): string[] {
    return this.split(assertString(delimiter), assertString(x));
  }

  ref(logicalId: unknown) {
    return this.inner.ref(assertString(logicalId));
  }

  sub(x: unknown, additionalContext?: unknown): string {
    if (additionalContext && typeof additionalContext !== 'object') {
      throw new Error(`Second argument to Fn::Sub should be an object, got ${JSON.stringify(additionalContext)}`);
    }

    return this.inner.sub(assertString(x), additionalContext as any);
  }

  equals(a: unknown, b: unknown): boolean {
    return this.inner.equals(assertString(a), assertString(b));
  }

  and(xs: unknown[]): boolean {
    return this.inner.and(xs.map(assertBoolean));
  }

  or(xs: unknown[]): boolean {
    return this.inner.or(xs.map(assertBoolean));
  }
}

export class StandardIntrinsics implements IntrinsicsEvaluator {
  public readonly context: Context;

  constructor(private readonly sources: EvaluationSources) {
    this.context = sources.context;
  }

  public base64(x: string): string {
    return Buffer.from(x).toString('base64');
  }

  public cidr(_base: string, _a: number, _b: number): string {
    throw new Error('Fn::Cidr not implemented');
  }

  public findInMap(mapName: string, key1: string, key2: string): string {
    const map = this.sources.mappings?.[mapName];
    if (!map) { throw new Error(`No such Mapping: ${mapName}`); }
    const inner = map[key1];
    if (!inner) { throw new Error(`Mapping ${mapName} has no key '${key1}' (available: ${Object.keys(map)})`); }

    const ret = inner[key2];
    if (ret === undefined) { throw new Error(`Mapping ${mapName}[${key1}] has no key '${key2}' (available: ${Object.keys(inner)})`); }
    return ret;
  }

  public getAzs(region: string): string[] {
    // FIXME: need this from somewhere
    return ['a', 'b', 'c'].map(x => `${region}${x}`);
  }

  public getAtt(logicalId: string, attr: string) {
    const context = this.sources.context.get(logicalId);
    if (!context) { throw new Error(`Fn::GetAtt: unknown identifier: ${logicalId}`); }
    const ret = context.attributes?.[attr];
    if (ret === undefined) { throw new Error(`Fn::GetAtt: ${logicalId} has no attribute ${attr}`); }
    return ret;
  }

  public ref(logicalId: string) {
    const context = this.sources.context.get(logicalId);
    if (!context) { throw new Error(`Ref: unknown identifier: ${logicalId}`); }
    return context.primaryValue;
  }

  public if_<A>(conditionId: string, ifYes: A, ifNo: A): A {
    const condition = this.sources.conditions?.[conditionId];
    if (!condition) { throw new Error(`Fn::If: no such condition: ${conditionId}`); }

    const evaled = evalCfn(condition, this);
    if (typeof evaled !== 'boolean') {
      throw new Error(`Fn::If: condition ${conditionId} must evaluate to boolean, got '${JSON.stringify(evaled)}'`);
    }

    return evaled ? ifYes : ifNo;
  }

  public importValue(exportName: string) {
    const exp = this.sources.exports?.[exportName];
    if (exp === undefined) { throw new Error(`Fn::ImportValue: no such export '${exportName}'`); }
    return exp;
  }

  public join(delimiter: string, elements: string[]): string {
    return elements.join(delimiter);
  }

  public select(index: number, elements: string[]): string {
    if (index < 0 || elements.length <= index) {
      throw new Error(`Fn::Select: index ${index} of out range: [0..${elements.length - 1}]`);
    }
    return elements[index]!;
  }

  public split(delimiter: string, x: string): string[] {
    return x.split(delimiter);
  }

  public sub(x: string, additionalContext: Record<string, string> = {}): string {
    return analyzeSubPattern(x).map((part) => {
      switch (part.type) {
        case 'literal': return part.content;
        case 'ref':
          if (part.logicalId in additionalContext) { return additionalContext[part.logicalId]; }
          return this.ref(part.logicalId);
        case 'getatt':
          return this.getAtt(part.logicalId, part.attr);
      }
    }).join('');
  }

  public equals(a: string, b: string): boolean {
    return a === b;
  }

  public and(xs: boolean[]): boolean {
    return xs.every(x => x);
  }

  public or(xs: unknown[]): boolean {
    return xs.some(x => x);
  }
}

export class StandardEvaluator {
  /**
   * Create a new StandardEvaluator with typechecking
   */
  public static forTemplate(template: Template, context: Context, exports: Record<string, string> = {}) {
    return new StandardEvaluator(new TypecheckedEvaluator(new StandardIntrinsics({
      context,
      conditions: template.conditions,
      mappings: template.mappings,
      exports,
    })), context);
  }

  public static fromSources(sources: EvaluationSources) {
    return new StandardEvaluator(new TypecheckedEvaluator(new StandardIntrinsics(sources)), sources.context);
  }

  constructor(private readonly evaluator: UncheckedEvaluator, public readonly context: Context) {
  }

  public evaluate(what: any) {
    return evalCfn(what, this.evaluator);
  }
}

/**
 * Make trivial context (no attributes)
 */
export function makeContext(kv: Record<string, ContextValue>) {
  return new Map(Object.entries(kv).map(([key, primaryValue]) => [key, { primaryValue }]))
}

export interface EvaluationSources {
  readonly context: Context;
  readonly mappings?: Record<string, schema.Mapping>;
  readonly conditions?: Record<string, schema.Condition>;
  readonly exports?: Record<string, string>;
}

export function evalCfn(xs: any, walker: UncheckedEvaluator): any {
  if (!xs) { return xs; }

  if (Array.isArray(xs)) {
    return xs.map(x => evalCfn(x, walker)).filter(x => x !== NO_VALUE);
  }

  if (typeof xs !== 'object') { return xs; }

  const keys = Object.keys(xs);
  if (keys.length === 1) {
    try {
      return evalIntrinsic(keys[0]!, xs, walker);
    } catch (e: any) {
      throw new Error(`${e.message} while evaluating ${JSON.stringify(xs)}`);
    }
  }

  return mkDict(Object.entries(xs)
    .map(([k, v]) => [k, evalCfn(v, walker)] as const)
    .filter(([_, v]) => v !== NO_VALUE));
}

type KeysOfUnion<T> = T extends T ? keyof T : never;

function evalIntrinsic(key: string, intrins: schema.Intrinsic, walker: IntrinsicsEvaluator): any | undefined {
  let ret: any = undefined;

  evalCase('Fn::Base64', x => walker.base64(recurse(x)));
  evalCase('Fn::Cidr', x => walker.cidr(recurse(x[0]), x[1], x[2]));
  evalCase('Fn::FindInMap', x => walker.findInMap(recurse(x[0]), recurse(x[1]), recurse(x[2])));
  evalCase('Fn::GetAZs', x => walker.getAzs(recurse(x)));
  evalCase('Fn::GetAtt', x => walker.getAtt(x[0], recurse(x[1])));
  evalCase('Fn::If', x => walker.if_(x[0], () => recurse(x[1]), () => recurse(x[2]))());
  evalCase('Fn::ImportValue', x => walker.importValue(recurse(x)));
  evalCase('Fn::Join', x => walker.join(x[0], recurse(x[1])));
  evalCase('Fn::Select', x => walker.select(recurse(x[0]), recurse(x[1])));
  evalCase('Fn::Split', x => walker.split(x[0], recurse(x[1])));
  evalCase('Fn::Sub', x => typeof x === 'string' ? walker.sub(x) : walker.sub(x[0], recurse(x[1])));
  evalCase('Fn::Equals', x => walker.equals(recurse(x[0]), recurse(x[1])));
  evalCase('Fn::And', x => walker.and(x.map(recurse)));
  evalCase('Fn::Or', x => walker.or(x.map(recurse)));
  evalCase('Ref', x => walker.ref(x));

  return ret ?? { [key]: recurse((intrins as any)[key]) };

  function recurse(x: any): any {
    return evalCfn(x, walker);
  }

  function evalCase<A extends KeysOfUnion<schema.Intrinsic | schema.Condition>>(k: A, handler: (x: IntrinsicParam<A>) => any) {
    if (ret === undefined && key === k) {
      ret = handler((intrins as any)[k]);
    }
  }
}

type IntrinsicParam<A extends string> =
  A extends keyof schema.FnBase64 ? schema.FnBase64[A] :
  A extends keyof schema.FnCidr ? schema.FnCidr[A] :
  A extends keyof schema.FnEquals ? schema.FnEquals[A] :
  A extends keyof schema.FnFindInMap ? schema.FnFindInMap[A] :
  A extends keyof schema.FnGetAZs ? schema.FnGetAZs[A] :
  A extends keyof schema.FnGetAtt ? schema.FnGetAtt[A] :
  A extends keyof schema.FnIf ? schema.FnIf[A] :
  A extends keyof schema.FnImportValue ? schema.FnImportValue[A] :
  A extends keyof schema.FnJoin ? schema.FnJoin[A] :
  A extends keyof schema.FnNot ? schema.FnNot[A] :
  A extends keyof schema.FnOr ? schema.FnOr[A] :
  A extends keyof schema.FnAnd ? schema.FnAnd[A] :
  A extends keyof schema.FnSelect ? schema.FnSelect[A] :
  A extends keyof schema.FnSplit ? schema.FnSplit[A] :
  A extends keyof schema.FnSub ? schema.FnSub[A] :
  A extends keyof schema.Ref ? schema.Ref[A] :
  never;