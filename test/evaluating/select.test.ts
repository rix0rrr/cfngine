import { makeContext, StandardEvaluator } from "../../src";

test('Fn::Select can be passed a stringified index', () => {
  const evaluator = StandardEvaluator.fromSources({ context: makeContext({}) });

  // THEN - should not explode because the { Ref } is never evaluated
  expect(evaluator.evaluate({ 'Fn::Select': ['1', ['a', 'b', 'c']]})).toEqual('b');
});