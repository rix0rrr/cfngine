import { evalCfn } from "./intrinstics";
import { schema } from "./schema";
import { analyzeSubPattern, isNonLiteral } from "./sub";

export class Template {
  constructor(private readonly template: schema.Template) {
  }

  public get parameters() {
    return this.template.Parameters ?? {};
  }

  public get resources() {
    return this.template.Resources;
  }

  public get conditions() {
    return this.template.Conditions ?? {};
  }

  public get mappings() {
    return this.template.Mappings ?? {};
  }

  public get outputs() {
    return this.template.Outputs ?? {};
  }

  public get resourceDependencies(): Map<string, Set<string>>  {
    return templateDependencies(this.resources);
  }
}

function templateDependencies(resources: Record<string, schema.Resource>): Map<string, Set<string>> {
  const ret = new Map<string, Set<string>>();

  for (const [id, resource] of Object.entries(resources)) {
    for (const dependsOn of resource?.DependsOn ?? []) {
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
      }
    });
  }

  function record(logicalId: string, dependsOn: string) {
    let set = ret.get(logicalId);
    if (!set) {
      set = new Set<string>();
      ret.set(logicalId, set);
    }
    set.add(dependsOn);
  }

  return ret;
}