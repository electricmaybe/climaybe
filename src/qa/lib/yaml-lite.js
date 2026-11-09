/**
 * Minimal YAML subset reader for climaybe QA configs.
 * Supports: maps, lists, scalars (string/number/boolean/null), nested indentation.
 * Does not support anchors, multi-docs, flow collections, or complex keys.
 */

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((part) => parseScalar(part));
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    // Not fully supported; return raw string.
    return v;
  }
  // Inline comment strip for plain scalars
  const hash = v.indexOf(' #');
  return hash >= 0 ? v.slice(0, hash).trim() : v;
}

function indentOf(line) {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

/**
 * @param {string} text
 * @returns {unknown}
 */
export function parseYamlLite(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => {
      const cut = l.replace(/\t/g, '  ');
      const hash = cut.search(/\s#/);
      // Keep full-line comments out; keep inline comments for scalars via parseScalar
      if (cut.trimStart().startsWith('#')) return '';
      return cut;
    })
    .filter((l, i, arr) => l.trim() !== '' || (i > 0 && arr[i - 1].trim() !== ''));

  const meaningful = lines.filter((l) => l.trim() !== '');
  if (meaningful.length === 0) return {};

  let i = 0;

  function parseBlock(minIndent) {
    const first = meaningful[i];
    if (!first) return {};
    const firstIndent = indentOf(first);
    if (firstIndent < minIndent) return {};

    if (first.trimStart().startsWith('- ')) {
      const list = [];
      while (i < meaningful.length) {
        const line = meaningful[i];
        const ind = indentOf(line);
        if (ind < firstIndent) break;
        if (ind > firstIndent) {
          throw new Error(`Unexpected indent at line: ${line.trim()}`);
        }
        if (!line.trimStart().startsWith('- ')) break;
        const rest = line.trimStart().slice(2);
        i += 1;
        if (rest.includes(':') && !rest.trimStart().startsWith('"') && !rest.trimStart().startsWith("'")) {
          // Inline map start on list item: "- id: M01"
          const obj = {};
          const colon = rest.indexOf(':');
          const key = rest.slice(0, colon).trim();
          const val = rest.slice(colon + 1).trim();
          if (val === '') {
            obj[key] = parseBlock(ind + 2);
          } else {
            obj[key] = parseScalar(val);
          }
          // Continue reading nested keys for this list item
          while (i < meaningful.length) {
            const next = meaningful[i];
            const nInd = indentOf(next);
            if (nInd <= ind) break;
            if (next.trimStart().startsWith('- ')) {
              // nested list under last key — uncommon; attach as value of a synthetic key if needed
              break;
            }
            const nColon = next.indexOf(':');
            if (nColon < 0) break;
            const nKey = next.slice(0, nColon).trim();
            const nVal = next.slice(nColon + 1).trim();
            i += 1;
            if (nVal === '') {
              obj[nKey] = parseBlock(nInd + 2);
            } else {
              obj[nKey] = parseScalar(nVal);
            }
          }
          list.push(obj);
        } else if (rest === '') {
          list.push(parseBlock(ind + 2));
        } else {
          list.push(parseScalar(rest));
        }
      }
      return list;
    }

    const obj = {};
    while (i < meaningful.length) {
      const line = meaningful[i];
      const ind = indentOf(line);
      if (ind < firstIndent) break;
      if (ind > firstIndent) {
        throw new Error(`Unexpected indent at line: ${line.trim()}`);
      }
      if (line.trimStart().startsWith('- ')) break;
      const colon = line.indexOf(':');
      if (colon < 0) {
        i += 1;
        continue;
      }
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      i += 1;
      if (val === '') {
        obj[key] = parseBlock(ind + 2);
      } else {
        obj[key] = parseScalar(val);
      }
    }
    return obj;
  }

  return parseBlock(0);
}
