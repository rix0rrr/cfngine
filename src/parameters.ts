import { Context, ContextValue } from './intrinsics';
import { schema } from './schema';

export class Parameters {
  constructor(private readonly parameters: Record<string, schema.Parameter>) {
  }

  public get required(): Record<string, schema.Parameter> {
    return Object.fromEntries(Object.entries(this.parameters).filter(
      ([_, param]) => param.Default == null,
    ));
  }

  public has(name: string) {
    return !!this.parameters[name];
  }

  public seedDefaults(context: Context) {
    for (const [name, param] of Object.entries(this.parameters ?? {})) {
      if (param.Default) {
        context.set(name, { primaryValue: parseParamValue(name, param, param.Default) });
      }
    }
  }

  public assertAllPresent(context: Context) {
    for (const [name, param] of Object.entries(this.parameters ?? {})) {
      if (!context.has(name)) {
        throw new Error(`Parameter ${name}: missing value`);
      }
    }
  }

  public parse(name: string, value: string) {
    const param = this.parameters[name];
    if (!param) {
      throw new Error(`Unknown parameter: ${name}`);
    }
    return parseParamValue(name, param, value);
  }
}


function parseParamValue(name: string, param: schema.Parameter, value: string) {
  let ret: ContextValue;
  switch (param.Type) {
    case 'String':
      ret = value;
      break;
    case 'Number':
      ret = parseNumber(value).asString;
      break;
    case 'CommaDelimitedList':
      ret = value.split(',');
      break;
    case 'List<Number>':
      ret = value.split(',').map(x => parseNumber(x).asString);
      break;
  }

  if (param.AllowedValues && !param.AllowedValues.includes(assertString(ret))) {
    throw new Error(`Parameter ${name} ${param.ConstraintDescription ?? `not in list ${param.AllowedValues}`}`);
  }

  if (param.AllowedPattern && !new RegExp(param.AllowedPattern).test(assertString(ret))) {
    throw new Error(`Parameter ${name} ${param.ConstraintDescription ?? `does not match pattern ${param.AllowedPattern}`}`);
  }

  // FIXME: More validations here

  return ret;
}

function parseNumber(asString: string | number) {
  const asNumber = parseInt(`${asString}`, 10);
  if (`${asNumber}` !== asString) {
    throw new Error(`Not a number: ${asString}`);
  }
  return { asString, asNumber };
}

function assertString(x: ContextValue): string {
  if (typeof x !== 'string') {
    throw new Error(`Expected string, got ${JSON.stringify(x)}`);
  }
  return x;
}
