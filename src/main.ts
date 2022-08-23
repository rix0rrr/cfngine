import { Deployment } from './deployment';
import { Template } from './template';
import { proxiedGetter } from './private/everything-obj';
import { Environment } from './environment';
import { schema, Stack } from '.';
import stringify from 'json-stringify-pretty-compact';
import path from 'path';

async function main() {
  const files = process.argv.slice(2);

  for (const file of files) {
    console.log(file);
    let template;
    try {
      template = await Template.fromFile(file);
    } catch(e) {
      console.error(e);
      continue;
    }

    const stack = new Stack({
      stackName: path.basename(file),
      stackId: '1234',
      environment: Environment.from({ region: 'sa-east-1' }),
    });

    const parameterValues = Object.fromEntries(Object.entries(template.parameters.required).map(([name, param]) =>
      [name, fakeParameterValue(name, param)]));

    const deployment = new Deployment(stack, template, {
      parameterValues,
    });
    deployment.forEach(d => {
      console.log('===========', d.logicalId, '==============');
      console.log(stringify(d.resource, { indent: 2 }).split('\n').map(x => `    ${x}`).join('\n'));
      const physicalId = `physical-${d.logicalId}`;
      return { physicalId, attributes: proxiedGetter(attr => `${physicalId}#${attr}`) };
    });
    console.log('Outputs');
    for (const [name, value] of Object.entries(deployment.outputs)) {
      console.log(`   ${name} = ${value}`);
    }
  }
}

function fakeParameterValue(name: string, param: schema.Parameter): string {
  if (param.Type === 'Number' || param.Type === 'List<Number>') {
    return `${param.MinValue ?? 1}`;
  }
  if (param.AllowedValues) {
    return param.AllowedValues[0];
  }
  if (param.Type === 'CommaDelimitedList') {
    return `${name}1,${name}2,${name}3,${name}4`;
  }
  return name;
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
