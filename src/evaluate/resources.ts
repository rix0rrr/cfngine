import { RetentionPolicy, TemplateResource } from '../template';
import { Evaluator } from './evaluate';

/**
 * An evaluation-time resource
 */
export interface Resource {
  readonly templateResource: TemplateResource;
  readonly type: string;
  readonly properties: Record<string, unknown>;
  readonly conditionName?: string;
  readonly deletionPolicy: RetentionPolicy;
  readonly updateReplacePolicy: RetentionPolicy
  readonly metadata: Record<string, any>;
  // readonly CreationPolicy?: CreationPolicy;
  // readonly UpdatePolicy?: UpdatePolicy;
}

export function evaluateResource(res: TemplateResource, ev: Evaluator): Resource {
  return {
    templateResource: res,
    type: res.type,
    properties: ev.evaluateObject(res.properties),
    conditionName: res.conditionName,
    metadata: res.metadata,
    deletionPolicy: res.deletionPolicy,
    updateReplacePolicy: res.updateReplacePolicy,
  };
}