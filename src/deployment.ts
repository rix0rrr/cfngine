import { Environment } from './environment';
import { EvaluationContext } from './evaluate';
import { Evaluator } from './evaluate/evaluate';
import { evaluateResource, Resource } from './evaluate/resources';
import { Stack } from './stack';
import { Template } from './template';

export interface DeploymentOptions {
  readonly parameterValues?: Record<string, string>;
  readonly symbolic?: boolean;
}

export class Deployment {
  private readonly evaluator: Evaluator;

  private _outputs?: Record<string, string>;
  private _exports?: Record<string, string>;

  constructor(private readonly stack: Stack, private readonly template: Template, options: DeploymentOptions = {}) {
    this.evaluator = new Evaluator(new EvaluationContext({
      template,
      environment: stack.environment,
      symbolic: options.symbolic,
    }));
    stack.seedContextWithStackAndResources(this.evaluator.context);
    this.evaluator.context.setParameterValues(options.parameterValues ?? {});
  }

  public forEach(block: (x: ResourceDeployment) => ResourceDeploymentResult) {
    const queue = this.template.resourceGraph().topoQueue();
    while (!queue.isEmpty()) {
      queue.withNext((logicalId, _resource) => {
        const resource = this.evaluatedResource(logicalId);

        if (resource.conditionName && !this.evaluator.evaluateCondition(resource.conditionName)) {
          return; // Skip
        }

        const result = block({
          logicalId,
          resource,
          template: this.template,
        });

        this.evaluator.context.addReferenceable(logicalId, {
          primaryValue: result.physicalId,
          attributes: result.attributes,
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
      (environment ?? this.stack.environment).setExport(name, value);
    }
  }

  private evaluateOutputs() {
    this._outputs = {};
    this._exports = {};
    for (const [name, output] of this.template.outputs.entries()) {
      if (output.conditionName && !this.evaluator.evaluateCondition(output.conditionName)) {
        continue; // Skip
      }

      const value = this.evaluator.evaluate(output.value);
      this._outputs[name] = value;
      if (output.exportName) {
        this._exports[this.evaluator.evaluate(output.exportName)] = value;
      }
    }
  }

  /**
   * Evaluate the resource in the destination state of the deployment
   */
  private evaluatedResource(logicalId: string): Resource {
    return evaluateResource(this.template.resource(logicalId), this.evaluator);
  }
}

export interface ResourceDeployment {
  readonly logicalId: string;
  readonly resource: Resource;
  readonly template: Template;
}

export interface ResourceUpdate {
  readonly physicalId: string;
  readonly logicalId: string;
  readonly oldResource: Resource;
  readonly newResource: Resource;
  readonly oldTemplate: Template;
  readonly newTemplate: Template;
}

export interface ResourceDeletion {
  readonly physicalId: string;
  readonly logicalId: string;
  readonly template: Template;
  readonly oldResource: Resource;
}

export interface ResourceDeploymentResult {
  readonly physicalId: string;
  readonly attributes?: Record<string, any>;
}