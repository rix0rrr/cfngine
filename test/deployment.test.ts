import { Deployment, ResourceDeployment, ResourceDeploymentResult, Template } from '../src';


describe('template with Condition', () => {
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
    const deployment = new Deployment(template, {
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
    const deployment = new Deployment(template, {
      parameterValues: { DoIt: 'Yes' },
    });

    // WHEN
    const handler = mockHandler();
    deployment.forEach(handler);

    // THEN
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      logicalId: 'SomeResource',
      resource: {
        Type: 'Some::Resource',
        Condition: 'Maybe',
        Properties: {
          DoIt: 'Yes',
        },
      },
    }));
  });
});

describe('Output with condition', () => {
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

  describe.each([
    ['Yes', ['SomeResourceId']],
    ['No', []],
  ])('if param is %p', (doIt, outputs) => {
    // GIVEN
    const deployment = new Deployment(template, {
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
