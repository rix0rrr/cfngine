import { Deployment } from './deployment';
import { Template } from './template';
import { everythingObject } from './everything-obj';


async function main() {
  const files = process.argv.slice(2);

  for (const file of files) {
    console.log(file);
    const template = await Template.fromFile(file);
    const deployment = new Deployment(template, {
      region: 'sa-east-1',
    });
    deployment.forEach(d => {
      console.log('===========', d.logicalId, '==============');
      console.log(JSON.stringify(d.resource, undefined, 2).split('\n').map(x => `    ${x}`).join('\n'));
      const physicalId = `physical-${d.logicalId}`;
      return { physicalId, attributes: everythingObject(`${physicalId}#`) };
    });
    console.log('Outputs');
    for (const [name, value] of Object.entries(deployment.outputs)) {
      console.log(`   ${name} = ${value}`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});