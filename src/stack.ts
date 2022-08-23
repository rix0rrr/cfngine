import { Environment } from './environment';
import { Context, ContextRecord, evaluateResource, EvaluationContext, NO_VALUE, Resource } from './evaluate';
import { Evaluator } from './evaluate/evaluate';
import { Template } from './template';

export interface StackOptions {
  readonly stackName: string;
  readonly stackId: string;
  readonly template?: Template;
  readonly resources?: Context;
  readonly parameterValues?: Record<string, string>;
  readonly environment?: Environment;
}

export class Stack {
  public readonly stackName: string;
  public readonly stackId: string;
  public readonly parameterValues: Record<string, string>;
  public readonly resources: Context;
  public readonly environment: Environment;
  public readonly evaluator: Evaluator;

  private _template: Template;

  constructor(options: StackOptions) {
    this.stackId = options.stackId;
    this.stackName = options.stackName;
    this.environment = options.environment ?? Environment.default();
    this._template = options.template ?? Template.empty();
    this.resources = options.resources ?? new Map();
    this.parameterValues = options.parameterValues ?? {};

    assertSetsEqual(new Set(this.resources.keys()), new Set(this.template.resources.keys()));

    this.evaluator = this.makeEvaluator();
  }

  public get template() {
    return this._template;
  }

  public validateResourceCompleteness() {
    // FIXME: validate resource names against template, based on conditions
  }

  public addResource(logicalId: string, physicalId: string, attributes?: Record<string, string>) {
    this.resources.set(logicalId, {
      primaryValue: physicalId,
      attributes,
    });
  }

  public setTemplate(template: Template) {
    this._template = template;
  }

  /**
   * Evaluate the resource in the starting state of the stack
   */
  public evaluatedResource(logicalId: string): Resource {
    return evaluateResource(this.template.resource(logicalId), this.evaluator);
  }

  public seedContextWithStackAndResources(context: EvaluationContext) {
    const stackArn = `arn:${this.environment.partition}:cloudformation:${this.environment.region}:${this.environment.accountId}:stack/${this.stackName}/${this.stackId}`;

    context.addReferenceable('AWS::StackName', { primaryValue: this.stackName });
    context.addReferenceable('AWS::StackId', { primaryValue: stackArn });
    for (const [logicalId, resource] of this.resources.entries()) {
      context.addReferenceable(logicalId, resource);
    }
  }

  private makeEvaluator() {
    const context = new EvaluationContext({
      environment: this.environment,
      template: this.template,
    });

    context.setParameterValues(this.parameterValues);
    this.seedContextWithStackAndResources(context);

    return new Evaluator(context);
  }
}

function assertSetsEqual<A>(xs: Set<A>, ys: Set<A>) {
  const yxs = Array.from(ys.values()).filter(y => !xs.has(y));
  const xys = Array.from(xs.values()).filter(x => !ys.has(x));

  if (yxs.length > 0 || xys.length > 0) {
    const yxss = Array.from(yxs).map(x => `-${x}`);
    const xyss = Array.from(xys).map(x => `+${x}`);
    throw new Error(`Sets should be the same, found: ${[...xyss,...yxss]}`);
  }
}