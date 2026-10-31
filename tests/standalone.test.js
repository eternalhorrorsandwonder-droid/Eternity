import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeInlineCode, replaceLiteral } from '../scripts/inline-utils.mjs';

test('standalone inline substitution keeps dollar expressions and safely escapes closing tags', () => {
  const code = "const dollars = '$& $` $\\\''; const end = '</script>';";
  const safe = escapeInlineCode(code, 'script');
  assert.equal(safe.includes('</script>'), false);
  assert.ok(safe.includes('<\\/script>'));
  const html = replaceLiteral('before <script src="app.js"></script> after', '<script src="app.js"></script>', `<script>${safe}</script>`);
  assert.equal(html, `before <script>${safe}</script> after`);
  assert.ok(html.includes("$& $` $\\'"));
  assert.equal(escapeInlineCode('x</STYLE>y','style'),'x<\\/STYLE>y');
});
