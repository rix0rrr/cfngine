import { Environment } from './environment';
import { Context, evalCfn, IntrinsicsEvaluator, NO_VALUE, StandardEvaluator } from './intrinstics';
import { schema } from './schema';
import { Template } from './template';


export interface DeploymentOptions {
  readonly environment?: Environment;

  readonly parameterValues?: Record<string, string>;
  readonly stackName?: string;

  /**
   * The stack UUID (note: not the ARN)
   */
  readonly stackId?: string;
}

export class Deployment {
  private readonly context: Context = new Map();
  private readonly evaluator: IntrinsicsEvaluator;
  private _outputs?: Record<string, string>;
  private _exports?: Record<string, string>;
  private readonly environment: Environment;

  constructor(private readonly template: Template, private readonly options: DeploymentOptions = {}) {
    this.environment = options.environment ?? Environment.default();
    this.seedContextWithParameters();
    this.seedContextWithPseudos();
    this.evaluator = StandardEvaluator.forTemplate(this.template, this.context, this.environment.exports);
  }

  public forEach(block: (x: ResourceDeployment) => ResourceDeploymentResult) {
    const queue = this.template.resourceGraph().topoQueue();
    while (!queue.isEmpty()) {
      queue.withNext((logicalId, resource) => {
        if (resource.Condition && !this.evaluate(resource.Condition)) {
          // Skip
          return;
        }

        const result = block({
          logicalId,
          resource: this.evaluate(resource),
          template: this.template,
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

  public updateExports(environment?: Environment) {
    for (const [name, value] of Object.entries(this.exports)) {
      (environment ?? this.environment).setExport(name, value);
    }
  }

  private evaluate(what: any) {
    return evalCfn(what, this.evaluator);
  }

  private seedContextWithParameters() {
    this.template.parameters.seedDefaults(this.context);
    for (const [name, value] of Object.entries(this.options.parameterValues ?? {})) {
      this.context.set(name, { primaryValue: this.template.parameters.parse(name, value) });
    }
    this.template.parameters.assertAllPresent(this.context);
  }

  private seedContextWithPseudos() {
    const stackName = this.options.stackName ?? 'StackName';
    const stackId = this.options.stackId ?? '51af3dc0-da77-11e4-872e-1234567db123';
    const stackArn = `arn:${this.environment.partition}:cloudformation:${this.environment.region}:${this.environment.accountId}:stack/${stackName}/${stackId}`;

    this.context.set('AWS::NoValue', { primaryValue: NO_VALUE });
    this.context.set('AWS::NotificationARNs', { primaryValue: [] });
    this.context.set('AWS::StackName', { primaryValue: stackName });
    this.context.set('AWS::StackId', { primaryValue: stackArn });

    this.environment.seedContext(this.context);
  }

  private evaluateOutputs() {
    this._outputs = {};
    this._exports = {};
    for (const [name, output] of Object.entries(this.template.outputs)) {
      if (output.Condition && !this.evaluate(output.Condition)) {
        continue;
      }

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
  readonly template: Template;
}

export interface ResourceUpdate {
  readonly physicalId: string;
  readonly logicalId: string;
  readonly oldResource: schema.Resource;
  readonly newResource: schema.Resource;
  readonly oldTemplate: Template;
  readonly newTemplate: Template;
}

export interface ResourceDeletion {
  readonly physicalId: string;
  readonly logicalId: string;
  readonly template: Template;
  readonly oldResource: schema.Resource;
}

export interface ResourceDeploymentResult {
  readonly physicalId: string;
  readonly attributes?: Record<string, any>;
}