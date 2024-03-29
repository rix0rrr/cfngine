import { promises as fs } from 'fs';
import { parseExpression, TemplateExpression } from './expression';
import { parseMapping, TemplateMapping } from './mappings';
import { parseOutput, TemplateOutput } from './output';
import { TemplateParameters } from './parameters';
import { parseTemplateResource, TemplateResource } from './resource';
import { parseCfnYaml } from '../private/cfn-yaml';
import { DependencyGraph } from '../private/toposort';
import { schema } from '../schema';

export interface TemplateOptions {
  readonly symbolic?: boolean;
}

/**
 * A template describes the desired state of some infrastructure
 */
export class Template {
  public static async fromFile(fileName: string, options: TemplateOptions = {}): Promise<Template> {
    const tpl = parseCfnYaml(await fs.readFile(fileName, { encoding: 'utf-8' }));
    if (!(tpl.Resources)) {
      throw new Error(`${fileName}: does not look like a template`);
    }
    return new Template(tpl, options);
  }

  public static empty(): Template {
    return new Template({
      Resources: {},
    });
  }

  public readonly parameters: TemplateParameters;
  public readonly resources: Map<string, TemplateResource>;
  public readonly conditions: Map<string, TemplateExpression>;
  public readonly mappings: Map<string, TemplateMapping>;
  public readonly outputs: Map<string, TemplateOutput>;

  constructor(private readonly template: schema.Template, options: TemplateOptions = {}) {
    this.parameters = new TemplateParameters(this.template.Parameters ?? {}, { symbolic: options.symbolic });

    this.resources = new Map(Object.entries(template.Resources ?? {})
      .map(([k, v]) => [k, parseTemplateResource(v)]));

    this.conditions = new Map(Object.entries(template.Conditions ?? {})
      .map(([k, v]) => [k, parseExpression(v)]));

    this.mappings = new Map(Object.entries(template.Mappings ?? {})
      .map(([k, v]) => [k, parseMapping(v)]));

    this.outputs = new Map(Object.entries(template.Outputs ?? {})
      .map(([k, v]) => [k, parseOutput(v)]));
  }

  public resource(logicalId: string) {
    const r = this.resources.get(logicalId);
    if (!r) {
      console.log(this.resources);
      console.log(new Error('').stack);
      throw new Error(`No such resource: ${logicalId}`);
    }
    return r;
  }

  public condition(logicalId: string) {
    const condition = this.conditions.get(logicalId);
    if (!condition) {
      throw new Error(`No such Condition: ${logicalId}`);
    }
    return condition;
  }

  /**
   * Return a graph containing all dependencies in execution order
   *
   * This includes relations established both by property references, as
   * well as 'DependsOn' declarations.
   */
  public resourceGraph(): DependencyGraph<TemplateResource> {
    const dependencies = new Map(Array.from(this.resources.entries()).map(([k, v]) => [k, v.dependencies] as const));
    return new DependencyGraph(Object.fromEntries(this.resources.entries()), dependencies);
  }
}