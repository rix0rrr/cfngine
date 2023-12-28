import { ReleasableCommits, typescript } from 'projen';
const project = new typescript.TypeScriptProject({
  name: 'cfngine',
  description: 'Local emulation of the CloudFormation engine',
  projenrcTs: true,
  defaultReleaseBranch: 'main',

  deps: ['json-stringify-pretty-compact', 'yaml'], /* Runtime dependencies of this module. */
  devDeps: ['dedent', 'fast-check'], /* Build dependencies for this module. */

  release: true,
  releaseToNpm: true,
  releasableCommits: ReleasableCommits.featuresAndFixes(),
});
project.synth();