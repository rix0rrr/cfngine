import { string } from "fast-check";
import { analyzeSubPattern, SubFragment } from "../private/sub";
import { assertField, assertList, assertObject, assertString } from "../private/types";

export type TemplateExpression =
  | StringLiteral
  | ObjectLiteral
  | ArrayLiteral
  | IntrinsicExpression
  ;

export interface StringLiteral {
  readonly type: 'string';
  readonly value: string;
}

export interface ObjectLiteral {
  readonly type: 'object';
  readonly fields: Record<string, TemplateExpression>;
}

export interface ArrayLiteral {
  readonly type: 'array';
  readonly array: TemplateExpression[];
}

export type IntrinsicExpression =
  | RefIntrinsic
  | GetAttIntrinsic
  | Base64Intrinsic
  | CidrIntrinsic
  | FindInMapIntrinsic
  | GetAZsIntrinsic
  | IfIntrinsic
  | ImportValueIntrinsic
  | JoinIntrinsic
  | SelectIntrinsic
  | SplitIntrinsic
  | SubIntrinsic
  | TransformIntrinsic
  | AndIntrinsic
  | OrIntrinsic
  | NotIntrinsic
  | EqualsIntrinsic
  ;

export interface RefIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'ref';
  readonly logicalId: string;
}

export interface GetAttIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'getAtt';
  readonly logicalId: string;
  readonly attribute: TemplateExpression;
}

export interface Base64Intrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'base64';
  readonly expression: TemplateExpression;
}

export interface CidrIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'cidr';
  readonly ipBlock: TemplateExpression;
  readonly count: TemplateExpression;
  readonly netMask: TemplateExpression;
}

export interface FindInMapIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'findInMap';
  readonly mappingName: string;
  readonly key1: TemplateExpression;
  readonly key2: TemplateExpression;
}

export interface GetAZsIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'getAzs';
  readonly region: TemplateExpression;
}

export interface IfIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'if';
  readonly conditionName: string;
  readonly then: TemplateExpression;
  readonly else: TemplateExpression;
}

export interface ImportValueIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'importValue';
  readonly export: TemplateExpression;
}

export interface JoinIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'join';
  readonly separator: string;
  readonly array: TemplateExpression;
}

export interface SelectIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'select';
  readonly index: TemplateExpression;
  readonly array: TemplateExpression;
}

export interface SplitIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'split';
  readonly separator: string;
  readonly value: TemplateExpression;
}

export interface SubIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'sub';
  readonly fragments: SubFragment[];
  readonly additionalContext: Record<string, TemplateExpression>;
}

export interface TransformIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'transform';
  readonly transformName: string;
  readonly parameters: Record<string, TemplateExpression>;
}

export interface AndIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'and';
  readonly operands: TemplateExpression[];
}

export interface OrIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'or';
  readonly operands: TemplateExpression[];
}

export interface NotIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'not';
  readonly operand: TemplateExpression;
}

export interface EqualsIntrinsic {
  readonly type: 'intrinsic';
  readonly fn: 'equals';
  readonly value1: TemplateExpression;
  readonly value2: TemplateExpression;
}

export function parseExpression(x: unknown): TemplateExpression {
  if (typeof x === 'string') { return { type: 'string', value: x }; }
  // There are no such things as numbers in CloudFormation.
  if (typeof x === 'number') { return { type: 'string', value: `${x}` }; }
  if (typeof x === 'boolean') { return { type: 'string', value: `${x}` }; }
  if (Array.isArray(x)) { return { type: 'array', array: x.map(parseExpression) }; }

  const INTRINSIC_TABLE: Record<string, (x: unknown) => IntrinsicExpression> = {
    'Ref': (x) => ({
      type: 'intrinsic', fn: 'ref',
      logicalId: assertString(x),
    }),
    'Fn::GetAtt': (x) => {
      const xs = assertList(x, [2]);
      return {
        type: 'intrinsic', fn: 'getAtt',
        logicalId: assertString(xs[0]),
        attribute: parseExpression(xs[1]),
      };
    },
    'Fn::Base64': (x) => ({
      type: 'intrinsic', fn: 'base64',
      expression: parseExpression(x),
    }),
    'Fn::Cidr': (x) => {
      const xs = assertList(x, [3]);
      return {
        type: 'intrinsic', fn: 'cidr',
        ipBlock: parseExpression(xs[0]),
        count: parseExpression(xs[1]),
        netMask: parseExpression(xs[2]),
      };
    },
    'Fn::FindInMap': (x) => {
      const xs = assertList(x, [3]);
      return {
        type: 'intrinsic', fn: 'findInMap',
        mappingName: assertString(xs[0]),
        key1: parseExpression(xs[1]),
        key2: parseExpression(xs[2]),
      };
    },
    'Fn::GetAZs': (x) => ({
      type: 'intrinsic', fn: 'getAzs',
      region: parseExpression(x),
    }),
    'Fn::If': (x) => {
      const xs = assertList(x, [3]);
      return {
        type: 'intrinsic', fn: 'if',
        conditionName: assertString(xs[0]),
        then: parseExpression(xs[1]),
        else: parseExpression(xs[2]),
      };
    },
    'Fn::ImportValue': (x) => ({
      type: 'intrinsic', fn: 'importValue',
      export: parseExpression(x),
    }),
    'Fn::Join': (x) => {
      const xs = assertList(x, [2]);
      return {
        type: 'intrinsic', fn: 'join',
        separator: assertString(xs[0]),
        array: parseExpression(xs[1]),
      };
    },
    'Fn::Select': (x) => {
      const xs = assertList(x, [2]);
      return {
        type: 'intrinsic', fn: 'select',
        index: parseExpression(xs[0]),
        array: parseExpression(xs[1]),
      };
    },
    'Fn::Split': (x) => {
      const xs = assertList(x, [2]);
      return {
        type: 'intrinsic', fn: 'split',
        separator: assertString(xs[0]),
        value: parseExpression(xs[1]),
      };
    },
    'Fn::Sub': (x) => {
      let pattern: string;
      let context: Record<string, TemplateExpression>;
      if (typeof x === 'string') {
        pattern = x;
        context = {};
      } else if (Array.isArray(x)) {
        const xs = assertList(x);
        pattern = assertString(xs[0]);
        context = parseObject(xs[1]);
      } else {
        throw new Error(`Argument to {Fn::Sub} is of wrong type`);
      }

      const fragments = analyzeSubPattern(pattern);
      return {
        type: 'intrinsic', fn: 'sub',
        fragments,
        additionalContext: context,
      };
    },
    'Fn::Transform': (x) => {
      const fields = assertObject(x);

      const parameters = parseObject(assertField(fields, 'Parameters'));
      return {
        type: 'intrinsic', fn: 'transform',
        transformName: assertString(assertField(fields, 'Name')),
        parameters,
      };
    },
    'Fn::And': (x) => {
      return {
        type: 'intrinsic', fn: 'and',
        operands: assertList(x).map(parseExpression),
      };
    },
    'Fn::Or': (x) => {
      return {
        type: 'intrinsic', fn: 'or',
        operands: assertList(x).map(parseExpression),
      };
    },
    'Fn::Not': (x) => {
      return {
        type: 'intrinsic', fn: 'not',
        operand: parseExpression(x),
      };
    },
    'Fn::Equals': (x) => {
      const [x1, x2] = assertList(x, [2]);
      return {
        type: 'intrinsic', fn: 'equals',
        value1: parseExpression(x1),
        value2: parseExpression(x2),
      };
    },
  };

  if (typeof x === 'object' && x) {
    const keys = Object.keys(x);
    if (keys.length === 1 && INTRINSIC_TABLE[keys[0]]) {
      return INTRINSIC_TABLE[keys[0]]((x as any)[keys[0]]);
    }

    return {
      type: 'object',
      fields: Object.fromEntries(Object.entries(x)
        .map(([k, v]) => [k, parseExpression(v)])),
    };
  }

  throw new Error(`Unable to parse: ${JSON.stringify(x)}`);
}

export function parseObject(x: unknown) {
  if (x === undefined) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(assertObject(x))
    .map(([k, v]) => ([k, parseExpression(v)])));
}

export function ifField<A extends object, K extends keyof A, B>(xs: A, k: K, fn: (x: NonNullable<A[K]>) => B): B | undefined {
  if (xs[k] != null) {
    return fn(xs[k] as any);
  }
  return undefined;
}
