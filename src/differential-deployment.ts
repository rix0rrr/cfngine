import { Deployment, ResourceDeletion, ResourceDeployment, ResourceDeploymentResult, ResourceUpdate } from './deployment';
import { Environment } from './environment';
import { assertString } from './private/types';
import { Stack } from './stack';
import { Template } from './template';

export interface DifferentialDeploymentOptions {
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
  private readonly deployment: Deployment;

  constructor(private readonly stack: Stack, private readonly template: Template, options: DifferentialDeploymentOptions = {}) {
    this.deployment = new Deployment(stack, template, {
      parameterValues: options.parameterValues,
    });
  }

  public forEach(handler: IDifferentialDeploymentHandler) {
    const toDelete = new Map(this.stack.resources.entries());

    this.deployment.forEach(deployment => {
      const oldResourceContext = this.stack.resources.get(deployment.logicalId);
      const oldResource = this.stack.template.resources.get(deployment.logicalId);

      if (!!oldResource !== !!oldResourceContext) {
        throw new Error('Invariant violated');
      }

      // { physicalId => oldResource }

      if (oldResource && oldResourceContext) {
        const physicalId = assertString(oldResourceContext.primaryValue);

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
          toDelete.delete(physicalId);
        }

        return result;
      } else {
        return handler.create(deployment);
      }
    });

    for (const [logicalId, resourceAttrs] of toDelete.entries()) {
      handler.delete({
        logicalId,
        physicalId: assertString(resourceAttrs.primaryValue),
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