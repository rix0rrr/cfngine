import { Environment } from './environment';
import { ContextRecord, ContextValue, NO_VALUE, StandardEvaluator } from './intrinsics';
import { Template } from './template';

export interface StackOptions {
  readonly stackName: string;
  readonly stackId: string;
  readonly template: Template;
  readonly resourceNames: Record<string, string>;
  readonly parameterValues?: Record<string, string>;
  readonly environment?: Environment;
}

export class Stack {
  public readonly stackName: string;
  public readonly stackId: string;
  public readonly template: Template;
  public readonly parameterValues: Record<string, string>;
  public readonly resourceNames: Record<string, string>;
  public readonly environment: Environment;
  private readonly evaluator: StandardEvaluator;

  constructor(options: StackOptions) {
    this.stackId = options.stackId;
    this.stackName = options.stackName;
    this.environment = options.environment ?? Environment.default();
    this.template = options.template;
    this.resourceNames = options.resourceNames;
    this.parameterValues = options.parameterValues ?? {};

    this.evaluator = this.makeEvaluator();
  }

  public validateResourceCompleteness() {
    // FIXME: validate resource names against template, based on conditions
  }

  public evaluate(what: any) {
    return this.evaluator.evaluate(what);
  }

  public evaluatedResource(logicalId: string) {
    const resource = this.template.resource(logicalId);
    return {
      ...resource,
      Properties: this.evaluate(resource.Properties)
    };
  }

  public evaluateCondition(conditionId: string) {
    const result = this.evaluate(this.template.condition(conditionId));
    if (typeof result !== 'boolean') {
      throw new Error(`Condition does not evaluate to boolean: ${JSON.stringify(result)}`);
    }
    return result;
  }

  public addResource(logicalId: string, physicalId: string, attributes?: Record<string, string>) {
    this.evaluator.context.set(logicalId, {
      primaryValue: physicalId,
      attributes,
    });
  }

  private makeEvaluator() {
    const context = new Map<string, ContextRecord>();

    // Parameters
    this.template.parameters.seedDefaults(context);
    for (const [name, value] of Object.entries(this.parameterValues ?? {})) {
      context.set(name, { primaryValue: this.template.parameters.parse(name, value) });
    }
    this.template.parameters.assertAllPresent(context);

    // Pseudos
    const stackArn = `arn:${this.environment.partition}:cloudformation:${this.environment.region}:${this.environment.accountId}:stack/${this.stackName}/${this.stackId}`;

    context.set('AWS::NoValue', { primaryValue: NO_VALUE });
    context.set('AWS::NotificationARNs', { primaryValue: [] });
    context.set('AWS::StackName', { primaryValue: this.stackName });
    context.set('AWS::StackId', { primaryValue: stackArn });

    this.environment.seedContext(context);

    // Existing resources
    for (const [logicalId, name] of Object.entries(this.resourceNames)) {
      // FIXME: And attributes...?
      context.set(logicalId, { primaryValue: name });
    }

    return StandardEvaluator.forTemplate(this.template, context, this.environment.exports);
  }
}