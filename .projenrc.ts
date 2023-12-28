import { typescript } from 'projen';
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: 'cfngine',
  projenrcTs: true,

  deps: ['json-stringify-pretty-compact', 'yaml'], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: ['dedent', 'fast-check'], /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();