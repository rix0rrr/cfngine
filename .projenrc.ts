import { ReleasableCommits, typescript } from 'projen';
const project = new typescript.TypeScriptProject({
  name: 'cfngine',
  description: 'Local emulation of the CloudFormation engine',
  projenrcTs: true,
  defaultReleaseBranch: 'main',

  deps: ['json-stringify-pretty-compact', 'yaml', 'commander'],
  devDeps: ['dedent', 'fast-check'],

  release: true,
  releaseToNpm: true,
  releasableCommits: ReleasableCommits.featuresAndFixes(),
});
project.synth();