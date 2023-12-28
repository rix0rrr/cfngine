import { Environment } from '../environment';
import { Template } from '../template';
export type ContextValue = string | string[] | symbol;

export const NO_VALUE = Symbol('AWS::NoValue');

export interface ContextRecord {
  readonly primaryValue: ContextValue;
  readonly attributes?: Record<string, ContextValue>;
}

export type Context = Map<string, ContextRecord>;

export interface EvaluationContextOptions {
  readonly template?: Template;
  readonly environment?: Environment;
  readonly symbolic?: boolean;
}

export class EvaluationContext {
  private readonly context = new Map<string, ContextRecord>();
  private readonly template?: Template;
  private readonly environment?: Environment;
  private readonly symbolic: boolean;

  constructor(opts: EvaluationContextOptions = {}) {
    this.template = opts.template;
    this.environment = opts.environment;
    this.symbolic = opts.symbolic ?? false;

    this.context.set('AWS::NoValue', { primaryValue: NO_VALUE });
    this.context.set('AWS::NotificationARNs', { primaryValue: [] });

    this.template?.parameters.seedDefaults(this.context);
    this.environment?.seedContext(this.context);
  }

  public addReferenceable(logicalId: string, record: ContextRecord) {
    this.context.set(logicalId, record);
  }

  public setPrimaryContextValues(contextValues: Record<string, string>) {
    for (const [name, primaryValue] of Object.entries(contextValues ?? {})) {
      this.context.set(name, { primaryValue });
    }
  }

  public setParameterValues(parameterValues: Record<string, string>) {
    for (const [name, value] of Object.entries(parameterValues ?? {})) {
      this.context.set(name, {
        primaryValue: this.template ? this.template.parameters.parse(name, value) : value,
      });
    }
    this.template?.parameters.assertAllPresent(this.context);
  }

  public referenceable(logicalId: string) {
    const r = this.context.get(logicalId);
    if (!r) {
      throw new Error(`No resource or parameter with name: ${logicalId}`);
    }
    return r;
  }

  public mapping(mappingName: string) {
    const map = this.template?.mappings?.get(mappingName);
    if (!map) { throw new Error(`No such Mapping: ${mappingName}`); }
    return map;
  }

  public condition(conditionName: string) {
    const condition = this.template?.conditions?.get(conditionName);
    if (!condition) { throw new Error(`No such condition: ${conditionName}`); }
    return condition;
  }

  public exportValue(exportName: string) {
    const exp = this.environment?.exports.get(exportName);
    if (!exp) {
      if (this.symbolic) {
        return `\${Export:${exportName}}`;
      }
      throw new Error(`No such export: ${exportName}`);
    }
    return exp;
  }

  public azs(_regionName: string): string[] {
    if (this.symbolic) {
      return [
        '${AZ:1}',
        '${AZ:2}',
        '${AZ:3}',
      ];
    }

    throw new Error('AZs not supported yet');
  }
}
