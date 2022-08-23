import { EvaluationContext, parseExpression } from "../../src";
import { Evaluator } from "../../src/evaluate/evaluate";

test('Fn::Select can be passed a stringified index', () => {
  const evaluator = new Evaluator(new EvaluationContext());

  // THEN - should not explode because the { Ref } is never evaluated
  expect(evaluator.evaluate(parseExpression({ 'Fn::Select': ['1', ['a', 'b', 'c']]}))).toEqual('b');
});