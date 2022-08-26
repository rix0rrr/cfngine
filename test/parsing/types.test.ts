import { parseExpression } from "../../src";

test('booleans are parsed to strings', () => {
  expect(parseExpression(true)).toEqual({
    type: 'string',
    value: 'true'
  });
});

test('numbers are parsed to strings', () => {
  expect(parseExpression(5)).toEqual({
    type: 'string',
    value: '5'
  });
});

test('nested objects are parsed correctly', () => {
  expect(parseExpression({
    foo: 'foo',
    bar: { more: 3 },
  })).toEqual({
    type: 'object',
    fields: {
      foo: {
        type: 'string',
        value: 'foo',
      },
      bar: {
        type: 'object',
        fields: {
          more: {
            type: 'string',
            value: '3',
          },
        },
      },
    },
  });
});