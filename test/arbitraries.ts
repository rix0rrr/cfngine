import * as fc from 'fast-check';

export namespace arb {

  /**
   * The string that goes into an { Fn::Sub } expression
   */
  export const subFormatString = fc.stringOf(fc.constantFrom('${', '}', 'A', '', '!', '.'), { maxLength: 10 });

  function option<A>(arb: fc.Arbitrary<A>) {
    return fc.option(arb, { nil: undefined });
  }

  // Template builders
  const parameterDef = option(
    fc.record({
      TheParameter: fc.oneof(
        fc.record({
          Type: fc.constant('String'),
          Default: option(fc.constant('DefaultValue')),
          AllowedValues: fc.oneof(
            fc.constant(undefined),
            fc.constant(['DefaultValue']),
            fc.constant(['DefaultValue', 'OtherValue'])
          ),
          NoEcho: option(fc.boolean()),
        }),
      ),
    }));


//   export const template = fc.boolean().chain()

}