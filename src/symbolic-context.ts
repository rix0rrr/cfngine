import { proxiedGetter } from './private/everything-obj';
/**
 * Return an object that will return a string for every object that is accessed
 */
export function symbolicContext(prefix: string): Record<string, any> {
  return proxiedGetter(attr => `\$\{${prefix}${attr}}`);
}