import { ContextRecord, StandardEvaluator } from "../../src";

test('Fn::If lazily evaluates arguments', () => {
  const evaluator = new StandardEvaluator({
    conditions: {
      Tautology: { 'Fn::Equals': ['x', 'x'] },
    },
    context: new Map([
      ['Explodes', unevaluatableContextValue()],
    ]),
  });

  // THEN - should not explode because the { Ref } is never evaluated
  expect(evaluator.evaluate({ 'Fn::If': ['Tautology', 'Hooray', { Ref: 'Explodes' }]})).toEqual('Hooray');
});


function unevaluatableContextValue(): ContextRecord {
  return Object.defineProperty({} as ContextRecord, 'primaryValue', {
    get() { throw new Error('Should not have tried to evaluate this'); },
  });
}