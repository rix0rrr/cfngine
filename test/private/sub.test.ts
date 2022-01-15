import { analyzeSubPattern, SubFragment } from '../../src/private/sub';

test('test analyzesubpattern', () => {
  const parts = analyzeSubPattern('${AWS::StackName}-LogBucket');
  expect(parts).toEqual([
    { type: 'ref', logicalId: 'AWS::StackName' },
    { type: 'literal', content: '-LogBucket' },
  ] as SubFragment[]);
});