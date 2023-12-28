// eslint-disable-next-line import/no-extraneous-dependencies
import dedent from 'dedent';
import { parseCfnYaml } from '../src/private/cfn-yaml';

test.each([
  // Test !Ref
  [
    '!Ref',
    dedent`
      Resources:
        !Ref Banana
    `,
    {
      Resources: { Ref: 'Banana' },
    },
  ],

  // Test !Sub
  [
    '!Sub',
    dedent`
      Value:
        !Sub
          - String
          - Var1Name: Var1Value
            Var2Name: Var2Value
    `,
    {
      Value: { 'Fn::Sub': ['String', { Var1Name: 'Var1Value', Var2Name: 'Var2Value' }] },
    },
  ],

  // Test !GetAtt
  [
    '!GetAtt string',
    dedent`
      Value:
        !GetAtt LogicalId.Attr
    `,
    {
      Value: { 'Fn::GetAtt': ['LogicalId', 'Attr'] },
    },
  ],

  // Nested tags
  [
    'Nested tags',
    dedent`
      Value:
        !Select
          - 0
          - !Split
            - ','
            - !ImportValue Henk
    `,
    {
      Value: { 'Fn::Select': [0, { 'Fn::Split': [',', { 'Fn::ImportValue': 'Henk' }] }] },
    },
  ],
])('can parse YAML short forms: %p', (_, yaml, expected) => {
  const parsed = parseCfnYaml(yaml.trimStart());
  expect(parsed).toEqual(expected);
});


// Nested tags
