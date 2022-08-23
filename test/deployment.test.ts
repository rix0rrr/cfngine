import { Deployment, ResourceDeployment, ResourceDeploymentResult, Stack, Template } from '../src';


describe('template with Condition', () => {
  const stack = new Stack({
    stackName: 'TestStack',
    stackId: '1234',
  });

  const template = new Template({
    Parameters: {
      DoIt: {
        Type: 'String',
      },
    },
    Conditions: {
      Maybe: { 'Fn::Equals': [ { Ref: 'DoIt' }, 'Yes' ] },
    },
    Resources: {
      SomeResource: {
        Type: 'Some::Resource',
        Condition: 'Maybe',
        Properties: {
          DoIt: { Ref: 'DoIt' },
        },
      },
    },
  });

  test('skip resources if condition not satisfied', () => {
    // GIVEN
    const deployment = new Deployment(stack, template, {
      parameterValues: { DoIt: 'No' },
    });

    // WHEN
    const handler = mockHandler();
    deployment.forEach(handler);

    // THEN
    expect(handler).not.toHaveBeenCalled();
  });

  test('include resource if condition satisfied', () => {
    // GIVEN
    const deployment = new Deployment(stack, template, {
      parameterValues: { DoIt: 'Yes' },
    });

    // WHEN
    const handler = mockHandler();
    deployment.forEach(handler);

    // THEN
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      logicalId: 'SomeResource',
      resource: expect.objectContaining({
        type: 'Some::Resource',
        conditionName: 'Maybe',
        properties: {
          DoIt: 'Yes',
        },
      }),
    }));
  });
});

describe('Output with condition', () => {
  const stack = new Stack({
    stackName: 'TestStack',
    stackId: '1234',
  });
  const template = new Template({
    Parameters: {
      DoIt: { Type: 'String' },
    },
    Conditions: {
      Maybe: { 'Fn::Equals': [ { Ref: 'DoIt' }, 'Yes' ] },
    },
    Resources: {
      SomeResource: {
        Type: 'Some::Resource',
        Condition: 'Maybe',
      },
    },
    Outputs: {
      SomeResourceId: {
        Condition: 'Maybe',
        Value: { Ref: 'SomeResource' }
      },
    },
  });

  test.each([
    ['Yes', ['SomeResourceId']],
    ['No', []],
  ])('if param is %p', (doIt, outputs) => {
    // GIVEN
    const deployment = new Deployment(stack, template, {
      parameterValues: { DoIt: doIt },
    });

    // WHEN
    deployment.forEach(mockHandler());

    // THEN
    expect(Object.keys(deployment.outputs)).toEqual(outputs);
  });
});

function mockHandler() {
  return jest.fn((d: ResourceDeployment) => {
    return {
      physicalId: `phys-${d.logicalId}`,
    } as ResourceDeploymentResult;
  });
}
