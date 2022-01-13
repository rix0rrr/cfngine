import * as yaml from 'yaml';
import { promises as fs } from 'fs';
import { evalCfn } from "./intrinsics";
import { schema } from "./schema";
import { analyzeSubPattern, isNonLiteral } from './private/sub';
import { DependencyGraph } from './private/toposort';
import { Parameters } from './parameters';
import { parseCfnYaml } from './private/cfn-yaml';

/**
 * A template describes the desired state of some infrastructure
 */
export class Template {
  public static async fromFile(fileName: string): Promise<Template> {
    const tpl = parseCfnYaml(await fs.readFile(fileName, { encoding: 'utf-8' }));
    return new Template(tpl);
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

  /**
   * Return a graph containing all dependencies in execution order
   *
   * This includes relations established both by property references, as
   * well as 'DependsOn' declarations.
   */
  public resourceGraph(): DependencyGraph<schema.Resource>  {
    return new DependencyGraph(this.resources, templateDependencies(this.resources, true));
  }

  /**
   * Return a graph containing all references established by properties
   *
   * This does not include relations established by 'DependsOn' declarations.
   */
  public referenceGraph(): DependencyGraph<schema.Resource>  {
    return new DependencyGraph(this.resources, templateDependencies(this.resources, false));
  }
}

function templateDependencies(resources: Record<string, schema.Resource>, includeDependsOn: boolean): Map<string, Set<string>> {
  const ret = new Map<string, Set<string>>();

  for (const [id, resource] of Object.entries(resources)) {
    if (includeDependsOn) {
      for (const dependsOn of makeList(resource?.DependsOn ?? [])) {
        record(id, dependsOn);
      }
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