import { Command, OptionValues } from 'commander';
import { Stack, Template, Deployment, symbolicContext } from '..';
import { pick } from '../private/util';

async function main() {
  const program = new Command();

  program
    .name('cnfgine')
    .description('Local emulation of CloudFormation');

  program.command('create')
    .description('Perform a symbolic stack creation based on a template, returning JSON lines')
    .argument('<template>', 'Template file')
    .parse();

  program.parse();

  const options = program.opts();
  const args = program.args;

  switch (args[0]) {
    case 'create': return create(args.slice(1), options);

    default:
      throw new Error(`Forgot to add a case for subcommand ${args[0]}`);
  }
}

async function create(args: string[], _options: OptionValues) {
  const template = await Template.fromFile(args[0]);
  const stack = new Stack({
    stackName: 'Stack',
    stackId: '111111',
  });
  const deployment = new Deployment(stack, template, {
    parameterValues: symbolicContext('Param.'),
    symbolic: true,
  });

  deployment.forEach((resource) => {
    console.log(JSON.stringify({
      ...pick(resource, 'logicalId'),
      ...pick(resource.resource, 'conditionName', 'deletionPolicy', 'properties', 'type', 'updateReplacePolicy'),
    }));
    return {
      physicalId: `\$\{${resource.logicalId}.Ref}`,
      attributes: symbolicContext(`${resource.logicalId}.`),
    };
  });

  console.log(JSON.stringify({ outputs: deployment.outputs }));
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});