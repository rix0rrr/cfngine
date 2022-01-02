import { env } from 'process';
import { Deployment, ResourceDeletion, ResourceDeployment, ResourceDeploymentResult, ResourceUpdate } from './deployment';
import { Environment } from './environment';
import { Context, IntrinsicsEvaluator, StandardEvaluator } from './intrinstics';
import { Stack } from './stack';
import { Template } from './template';

export interface DifferentialDeploymentOptions {
  readonly environment?: Environment;
  readonly parameterValues?: Record<string, string>;
}

export interface IDifferentialDeploymentHandler {
  create(resource: ResourceDeployment): ResourceDeploymentResult;
  /**
   * May return a new physicalId to signal a replacement
   */
  update(resource: ResourceUpdate): ResourceDeploymentResult;
  delete(resource: ResourceDeletion): void;
}

export class DifferentialDeployment {
  private readonly context: Context = new Map();
  private readonly environment: Environment;
  private readonly deployment: Deployment;

  constructor(private readonly stack: Stack, private readonly template: Template, options: DifferentialDeploymentOptions = {}) {
    this.environment = options.environment ?? Environment.default();
    this.deployment = new Deployment(template, {
      environment: options.environment,
      parameterValues: options.parameterValues,
      stackId: stack.stackId,
      stackName: stack.stackName,
    });
  }

  public forEach(handler: IDifferentialDeploymentHandler) {
    const toDelete = {...this.stack.resourceNames};

    this.deployment.forEach(deployment => {
      const oldResource = this.stack.template.resources[deployment.logicalId];
      const physicalId = this.stack.resourceNames[deployment.logicalId];
      // { physicalId => oldResource }

      if (physicalId) {
        const result = handler.update({
          logicalId: deployment.logicalId,
          physicalId,
          oldResource: this.stack.evaluatedResource(deployment.logicalId),
          newResource: deployment.resource, // Already evaluated
          oldTemplate: this.stack.template,
          newTemplate: this.template,
        });

        // No replacement
        if (result.physicalId === physicalId) {
          delete toDelete[physicalId];
        }

        return result;
      } else {
        return handler.create(deployment);
      }
    });

    for (const [logicalId, physicalId] of Object.entries(toDelete)) {
      handler.delete({
        logicalId,
        physicalId,
        oldResource: this.stack.evaluatedResource(logicalId),
        template: this.stack.template,
      });
    }
  }

  public get outputs() {
    return this.deployment.outputs;
  }

  public get exports() {
    return this.deployment.exports;
  }

  public updateExports(environment?: Environment) {
    return this.deployment.updateExports(environment);
  }
}