import { makeContext, StandardEvaluator, Template } from '../../src';

describe('Mapping with Arrays', () => {
  const template = new Template({
    "Mappings": {
      "RegionMap": {
        "ap-northeast-2": {
          "AZs": ["ap-northeast-2a", "ap-northeast-2c", "ap-northeast-2b"]
        },
        "sa-east-1": {
          "AZs": ["sa-east-1a", "sa-east-1c", "sa-east-1b"]
        }
      }
    },
    Resources: {},
  });

  test('successful lookup', () => {
    const ev = StandardEvaluator.forTemplate(template, makeContext({
      'AWS::Region': 'ap-northeast-2',
    }));
    expect(ev.evaluate({ "Fn::FindInMap": ["RegionMap", { "Ref": "AWS::Region" }, "AZs"] })).toEqual(["ap-northeast-2a", "ap-northeast-2c", "ap-northeast-2b"]);
  });

  test('failed lookup', () => {
    const ev = StandardEvaluator.forTemplate(template, makeContext({
      'AWS::Region': 'ap-northeast-1',
    }));
    expect(() => ev.evaluate({ "Fn::FindInMap": ["RegionMap", { "Ref": "AWS::Region" }, "AZs"] })).toThrow(/has no key/);
  });
});