import { promises as fs } from 'fs';
import { Context, evalCfn } from "./intrinsics";
import { schema } from "./schema";
import { analyzeSubPattern, isNonLiteral } from './private/sub';
import { DependencyGraph } from './private/toposort';
import { Parameters } from './parameters';

/**
 * A template describes the desired state of some infrastructure
 */
export class Template {
  public static async fromFile(fileName: string): Promise<Template> {
    return new Template(JSON.parse(await fs.readFile(fileName, { encoding: 'utf-8' })));
  }

  public readonly parameters: Parameters;

  constructor(private readonly template: schema.Template) {
    this.parameters = new Parameters(this.template.Parameters ?? {});
  }

  public resource(logicalId: string) {
    if (!(logicalId in this.resources)) {
      throw new Error(`No such resource: ${logicalId}`);
    }
    return this.resources[logicalId]!;
  }

  public get resources() {
    return this.template.Resources;
  }

  public get conditions() {
    return this.template.Conditions ?? {};
  }

  public condition(logicalId: string) {
    const condition = this.conditions[logicalId];
    if (!condition) {
      throw new Error(`No such Condition: ${logicalId}`);
    }
    return condition;
  }

  public get mappings() {
    return this.template.Mappings ?? {};
  }

  public get outputs() {
    return this.template.Outputs ?? {};
  }

  public resourceGraph(): DependencyGraph<schema.Resource>  {
    return new DependencyGraph(this.resources, templateDependencies(this.resources));
  }
}

function templateDependencies(resources: Record<string, schema.Resource>): Map<string, Set<string>> {
  const ret = new Map<string, Set<string>>();

  for (const [id, resource] of Object.entries(resources)) {
    for (const dependsOn of makeList(resource?.DependsOn ?? [])) {
      record(id, dependsOn);
    }
    evalCfn(resource, {
      base64() { return ''; },
      cidr() { return ''; },
      findInMap() { return ''; },
      getAtt(logicalId) {
        record(id, logicalId);
        return '';
      },
      getAzs() { return []; },
      if_() { return ''; },
      importValue() { return ''; },
      join() { return ''; },
      ref(logicalId) {
        if (!logicalId.startsWith('AWS::')) {
          record(id, logicalId);
        }
        return '';
      },
      select() { return ''; },
      split() { return []; },
      sub(pattern) {
        const pat = analyzeSubPattern(pattern);
        for (const x of pat.filter(isNonLiteral)) {
          record(id, x.logicalId);
        }
        return '';
      },
      equals() { return false; },
      and() { return false; },
      or() { return false; },
    });
  }

  function record(logicalId: string, dependsOn: string) {
    if (logicalId === dependsOn) {
      throw new Error(`${logicalId} cannot depend on itself`);
    }
    let set = ret.get(logicalId);
    if (!set) {
      set = new Set<string>();
      ret.set(logicalId, set);
    }
    set.add(dependsOn);
  }

  return ret;
}

function makeList<A>(x: A | A[]): A[] {
  return Array.isArray(x) ? x : [x];
}