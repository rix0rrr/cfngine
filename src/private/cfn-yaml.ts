import * as yaml from 'yaml';

function shortForms(): yaml.Tags {
  return [
    mkTag('Ref', 'scalar'),
    mkTag('Condition', 'scalar'),
    mkTag('Fn::Sub', 'seq'),
    mkTag('Fn::Base64', 'scalar'),
    mkTag('Fn::Cidr', 'seq'),
    mkTag('Fn::FindInMap', 'seq'),
    mkTag('Fn::GetAZs', 'scalar'),
    mkTag('Fn::ImportValue', 'scalar'),
    mkTag('Fn::Join', 'seq'),
    mkTag('Fn::Select', 'seq'),
    mkTag('Fn::Split', 'seq'),
    mkTag('Fn::Transform', 'map'),
    mkTag('Fn::And', 'seq'),
    mkTag('Fn::Equals', 'seq'),
    mkTag('Fn::If', 'seq'),
    mkTag('Fn::Not', 'seq'),
    mkTag('Fn::Or', 'seq'),
    getAttrString(),
  ];
}

export function parseCfnYaml(text: string): any {
  const customTags = shortForms();
  return yaml.parse(text, {
    customTags,
    schema: 'core',
    version: '1.1',
  });
}

function mkTag(fullName: string, kind: 'scalar' | 'map' | 'seq'): yaml.ScalarTag | yaml.CollectionTag {
  const shortName = fullName.split('::').slice(-1)[0];
  const tag = `!${shortName}`;

  if (kind === 'scalar') {
    return {
      identify() { return false; },
      tag,
      resolve: (value) => {
        return { [fullName]: value };
      },
    } satisfies yaml.ScalarTag;
  } else {
    return {
      identify() { return false; },
      collection: kind,
      tag,
      resolve: (value) => {
        return { [fullName]: value.toJSON() };
      },
    } satisfies yaml.CollectionTag;
  }
}

function getAttrString(): yaml.ScalarTag {
  return {
    identify() { return false; },
    tag: '!GetAtt',
    resolve: (value) => {
      return { 'Fn::GetAtt': value.split('.', 2) };
    },
  } satisfies yaml.ScalarTag;
}