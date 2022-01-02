import { countReset } from 'console';
import { Environment } from './environment';
import { ContextRecord, ContextValue, NO_VALUE, StandardEvaluator } from './intrinstics';
import { Template } from './template';

export class Stack {
  public readonly template: Template;
  public readonly parameterValues: Record<string, string>;
  public readonly resourceNames: Record<string, string>;
  public readonly environment: Environment;
  private readonly evaluator: StandardEvaluator;

  constructor(public readonly stackName: string, public readonly stackId: string, template: Template, resourceNames: Record<string, string>, parameterValues: Record<string, string>, environment?: Environment) {
    this.environment = environment ?? Environment.default();
    this.template = template;
    this.resourceNames = resourceNames;
    this.parameterValues = parameterValues;

    // FIXME: validate resource names against template, based on conditions

    this.evaluator = this.makeEvaluator();
  }

  public evaluatedResource(logicalId: string) {
    const res = this.template.resource(logicalId);
    return this.evaluator.evaluate(res);
  }

  private makeEvaluator() {
    const context = new Map<string, ContextRecord>();
    for (const [logicalId, name] of Object.entries(this.resourceNames)) {
      // FIXME: And attributes...?
      context.set(logicalId, { primaryValue: name });
    }
    for (const [logicalId, value] of Object.entries(this.parameterValues)) {
      context.set(logicalId, { primaryValue: value });
    }

    // FIXME: dedupe with deployment
    const stackArn = `arn:${this.environment.partition}:cloudformation:${this.environment.region}:${this.environment.accountId}:stack/${this.stackName}/${this.stackId}`;

    context.set('AWS::NoValue', { primaryValue: NO_VALUE });
    context.set('AWS::NotificationARNs', { primaryValue: [] });
    context.set('AWS::StackName', { primaryValue: this.stackName });
    context.set('AWS::StackId', { primaryValue: stackArn });

    return StandardEvaluator.forTemplate(this.template, context, this.environment.exports);
  }
}