export function analyzeSubPattern(pattern: string): SubFragment[] {
  const ret: SubFragment[] = [];
  let start = 0;

  let ph0 = pattern.indexOf('${', start);
  while (ph0 > -1) {
    if (pattern[ph0 + 2] === '!') {
      // "${!" means "don't actually substitute"
      start = ph0 + 3;
      ph0 = pattern.indexOf('${', start);
      continue;
    }

    const ph1 = pattern.indexOf('}', ph0 + 2);
    if (ph1 === -1) {
      break;
    }
    const placeholder = pattern.substring(ph0 + 2, ph1);

    if (ph0 > start) {
      ret.push({ type: 'literal', content: pattern.substring(start, ph0) });
    }
    if (placeholder.includes('.')) {
      const [logicalId, attr] = placeholder.split('.');
      ret.push({ type: 'getatt', logicalId: logicalId!, attr: attr! });
    } else {
      ret.push({ type: 'ref', logicalId: placeholder });
    }

    start = ph1 + 1;
    ph0 = pattern.indexOf('${', start);
  }

  if (start < pattern.length - 1) {
    ret.push({ type: 'literal', content: pattern.substr(start) });
  }

  return ret;
}

export type SubFragment =
  | { readonly type: 'literal'; readonly content: string }
  | { readonly type: 'ref'; readonly logicalId: string }
  | { readonly type: 'getatt'; readonly logicalId: string; readonly attr: string };


export function isNonLiteral(x: SubFragment): x is Extract<SubFragment, { type: 'ref' | 'getatt' }> {
  return x.type !== 'literal';
}
