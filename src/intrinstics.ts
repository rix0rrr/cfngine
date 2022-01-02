import { schema } from './schema';
import { analyzeSubPattern } from './private/sub';
import { Template } from './template';
import { mkDict } from './private/util';

export const NO_VALUE = Symbol('AWS::NoValue');

export type ContextValue = string | string[] | symbol;

export interface ContextRecord {
  readonly primaryValue: ContextValue;
  readonly attributes?: Record<string, any>;
}

export type Context = Map<string, ContextRecord>;

export interface IntrinsicsEvaluator {
  base64(x: string): string;
  cidr(base: string, a: number, b: number): string;
  findInMap(mapName: string, key1: string, key2: string): string;
  getAzs(region: string): string[];
  getAtt(logicalId: string, attr: string): any;
  if_(conditionId: string, ifYes: any, ifNo: any): any;
  importValue(exportName: string): any;
  join(delimiter: string, elements: string[]): string;
  select(index: number, elements: string[]): string;
  split(delimiter: string, x: string): string[];
  ref(logicalId: string): any;
  sub(x: string, additionalContext?: Record<string, ContextValue>): string;
}

export interface EvaluationSources {
  readonly context: Context;
  readonly mappings?: Record<string, schema.Mapping>;
  readonly conditions?: Record<string, schema.Condition>;
  readonly exports?: Record<string, string>;
}

export class StandardEvaluator implements IntrinsicsEvaluator {
  public static forTemplate(template: Template, context: Context, exports: Record<string, string> = {}) {
    return new StandardEvaluator({
      context,
      conditions: template.conditions,
      mappings: template.mappings,
      exports,
    });
  }

  public readonly context: Context;

  constructor(private readonly sources: EvaluationSources) {
    this.context = sources.context;
  }

  public evaluate(what: any) {
    return evalCfn(what, this);
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

  public if_(conditionId: string, ifYes: any, ifNo: any) {
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
      throw new Error(`Fn::Select: index ${index} of out range: [0..${elements.length})`);
    }
    return elements[index]!;
  }

  public split(delimiter: string, x: string): string[] {
    return x.split(delimiter);
  }

  public sub(x: string, additionalContext: Record<string, ContextValue> = {}): string {
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
}

export function evalCfn(xs: any, walker: IntrinsicsEvaluator): any {
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

function evalIntrinsic(key: string, params: schema.Intrinsic, walker: IntrinsicsEvaluator): any | undefined {
  let ret: any = undefined;

  // FIXME: should validate types here as well
  evalCase('Fn::Base64', x => walker.base64(recurse(x)));
  evalCase('Fn::Cidr', x => walker.cidr(recurse(x[0]), x[1], x[2]));
  evalCase('Fn::FindInMap', x => walker.findInMap(recurse(x[0]), recurse(x[1]), recurse(x[2])));
  evalCase('Fn::GetAZs', x => walker.getAzs(recurse(x)));
  evalCase('Fn::GetAtt', x => walker.getAtt(x[0], recurse(x[1])));
  evalCase('Fn::If', x => walker.if_(x[0], recurse(x[1]), recurse(x[2])));
  evalCase('Fn::ImportValue', x => walker.importValue(recurse(x)));
  evalCase('Fn::Join', x => walker.join(x[0], recurse(x[1])));
  evalCase('Fn::Select', x => walker.select(recurse(x[0]), recurse(x[1])));
  evalCase('Fn::Split', x => walker.split(x[0], recurse(x[1])));
  evalCase('Fn::Sub', x => typeof x === 'string' ? walker.sub(x) : walker.sub(x[0], recurse(x[1])));
  evalCase('Ref', x => walker.ref(x));

  return ret ?? { key: recurse((params as any)[key]) };

  function recurse(x: any): any {
    return evalCfn(x, walker);
  }

  function evalCase<A extends KeysOfUnion<schema.Intrinsic>>(k: A, handler: (x: IntrinsicParam<A>) => any) {
    if (key === k) {
      ret = handler((params as any)[k]);
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
  A extends keyof schema.FnSelect ? schema.FnSelect[A] :
  A extends keyof schema.FnSplit ? schema.FnSplit[A] :
  A extends keyof schema.FnSub ? schema.FnSub[A] :
  A extends keyof schema.Ref ? schema.Ref[A] :
  never;
