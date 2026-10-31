// Using a replacement callback is essential: bundles may contain $&, $' and $`
// which String.replace otherwise expands as match/input substitutions.
export const replaceLiteral = (text, tag, replacement) => text.replace(tag, () => replacement);
export const escapeInlineCode = (code, element) => {
  if (element !== 'script' && element !== 'style') throw new Error('Unsupported inline element.');
  return code.replace(new RegExp(`</${element}`, 'gi'), match => `<\\/${match.slice(2)}`);
};
