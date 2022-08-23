import { EvaluationContext, Template } from '../src';
import { Evaluator } from '../src/evaluate/evaluate';

export interface TestEvaluatorOptions {
  context?: Record<string, string>;
}

export function testEvaluator(template: Template, options: TestEvaluatorOptions = {}) {
  const context = new EvaluationContext({
    template,
  });
  context.setPrimaryContextValues(options?.context ?? {});
  return new Evaluator(context);
}