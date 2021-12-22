import { Context, ContextValue, evalCfn, NO_VALUE, StandardEvaluations } from './intrinstics';
import { schema } from './schema';
import { Template } from './template';
import { TopoQueue } from './toposort';

export interface DeploymentOptions {
  readonly parameters?: Record<string, string>;
  readonly region?: string;
  readonly accountId?: string;
  readonly partition?: string;
  readonly stackName?: string;

  /**
   * The stack UUID (note: not the ARN)
   */
  readonly stackId?: string;
  readonly urlSuffix?: string;

  readonly exports?: Record<string, string>;
}

export class Deployment {
  private readonly context: Context = new Map();
  private readonly evaluator = StandardEvaluations.forTemplate(this.template, this.context, this.options.exports);
  private _outputs?: Record<string, string>;
  private _exports?: Record<string, string>;

  constructor(private readonly template: Template, private readonly options: DeploymentOptions = {}) {
    this.seedContextWithParameters();
    this.seedContextWithPseudos();
  }

  public forEach(block: (x: ResourceDeployment) => ResourceDeploymentResult) {
    const queue = new TopoQueue(this.template.resources, this.template.resourceDependencies);
    while (!queue.isEmpty()) {
      queue.withNext((logicalId, resource) => {
        if (resource.Condition && !this.evaluate(resource.Condition)) {
          // Skip
          return;
        }

        const result = block({
          logicalId,
          resource: this.evaluate(resource),
        });

        this.context.set(logicalId, {
          primaryValue: result.physicalId,
          attributes: result.attributes,
        });
      });
    }
    this.evaluateOutputs();
  }

  public get outputs() {
    if (!this._outputs) {
      throw new Error("You can only evaluate 'outputs' after the deployment is complete.");
    }
    return this._outputs;
  }

  public get exports() {
    if (!this._exports) {
      throw new Error("You can only evaluate 'exports' after the deployment is complete.");
    }
    return this._exports;
  }

  private evaluate(what: any) {
    return evalCfn(what, this.evaluator);
  }

  private seedContextWithParameters() {
    for (const [name, value] of Object.entries(this.options.parameters ?? {})) {
      const param = this.template.parameters[name];
      if (!param) {
        throw new Error(`Unknown parameter: ${name}`);
      }
      this.context.set(name, { primaryValue: parseParamValue(name, param, value) });
    }

    for (const [name, param] of Object.entries(this.template.parameters)) {
      if (this.context.has(name)) { continue; }

      if (!param.Default) {
        throw new Error(`Parameter ${name}: missing value`);
      }

      this.context.set(name, { primaryValue: parseParamValue(name, param, param.Default) });
    }
  }

  private seedContextWithPseudos() {
    this.context.set('AWS::NoValue', { primaryValue: NO_VALUE });

    const partition = this.options.partition ?? 'aws';
    const accountId = this.options.accountId ?? '111111111111';
    const region = this.options.region ?? 'region-1';
    const stackName = this.options.stackName ?? 'StackName';

    this.context.set('AWS::Partition', { primaryValue: partition });
    this.context.set('AWS::AccountId', { primaryValue: accountId });
    this.context.set('AWS::Region', { primaryValue: region });
    this.context.set('AWS::URLSuffix', { primaryValue: this.options.urlSuffix ?? 'amazonaws.com' });
    this.context.set('AWS::NotificationARNs', { primaryValue: [] });
    this.context.set('AWS::StackName', { primaryValue: stackName });

    const stackId = this.options.stackId ?? '51af3dc0-da77-11e4-872e-1234567db123';
    this.context.set('AWS::StackId', {
      primaryValue: `arn:${partition}:cloudformation:${region}:${accountId}:stack/${stackName}/${stackId}`
    });
  }

  private evaluateOutputs() {
    this._outputs = {};
    this._exports = {};
    for (const [name, output] of Object.entries(this.template.outputs)) {
      const value = this.evaluate(output.Value);
      this._outputs[name] = value;
      if (output.Export?.Name) {
        this._exports[this.evaluate(output.Export?.Name)] = value;
      }
    }
  }

}

export interface ResourceDeployment {
  readonly logicalId: string;
  readonly resource: schema.Resource;
}

export interface ResourceDeploymentResult {
  readonly physicalId: string;
  readonly attributes?: Record<string, any>;
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