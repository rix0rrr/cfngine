import { ContextRecord, EvaluationContext, parseExpression, Template } from '../../src';
import { Evaluator } from '../../src/evaluate/evaluate';
import { testEvaluator } from '../util';

test('Fn::If lazily evaluates arguments', () => {
  const template = new Template({
    Conditions: {
      Tautology: { 'Fn::Equals': ['x', 'x'] },
    },
  });

  const evaluator = testEvaluator(template);
  evaluator.context.addReferenceable('Explodes', unevaluatableContextValue());

  // THEN - should not explode because the { Ref } is never evaluated
  expect(evaluator.evaluate(parseExpression({ 'Fn::If': ['Tautology', 'Hooray', { Ref: 'Explodes' }]}))).toEqual('Hooray');
});


function unevaluatableContextValue(): ContextRecord {
  return Object.defineProperty({} as ContextRecord, 'primaryValue', {
    get() { throw new Error('Should not have tried to evaluate this'); },
  });
}