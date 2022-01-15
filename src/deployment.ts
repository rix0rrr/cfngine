import { Environment } from './environment';
import { schema } from './schema';
import { Stack } from './stack';
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
  private readonly environment: Environment;
  private readonly stack: Stack;

  private _outputs?: Record<string, string>;
  private _exports?: Record<string, string>;

  constructor(private readonly template: Template, private readonly options: DeploymentOptions = {}) {
    this.environment = options.environment ?? Environment.default();

    this.stack = new Stack({
      stackName: options.stackName ?? 'StackName',
      stackId: options.stackId ?? '51af3dc0-da77-11e4-872e-1234567db123',
      resourceNames: {},
      template,
      environment: options.environment,
      parameterValues: options.parameterValues,
    });
  }

  public forEach(block: (x: ResourceDeployment) => ResourceDeploymentResult) {
    const queue = this.template.resourceGraph().topoQueue();
    while (!queue.isEmpty()) {
      queue.withNext((logicalId, _resource) => {
        const resource = this.stack.evaluatedResource(logicalId);

        if (resource.Condition && !this.stack.evaluateCondition(resource.Condition)) {
          // Skip
          return;
        }

        const result = block({
          logicalId,
          resource,
          template: this.template,
        });

        this.stack.addResource(logicalId, result.physicalId, result.attributes);
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

  private evaluateOutputs() {
    this._outputs = {};
    this._exports = {};
    for (const [name, output] of Object.entries(this.template.outputs)) {
      if (output.Condition && !this.stack.evaluateCondition(output.Condition)) {
        continue;
      }

      const value = this.stack.evaluate(output.Value);
      this._outputs[name] = value;
      if (output.Export?.Name) {
        this._exports[this.stack.evaluate(output.Export?.Name)] = value;
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