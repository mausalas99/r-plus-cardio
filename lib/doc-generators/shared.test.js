'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { esc, replaceT } = require('./shared.js');

describe('doc-generators/shared', () => {
  it('esc escapes XML entities without touching namespace prefixes', () => {
    assert.equal(esc('a & b <c>'), 'a &amp; b &lt;c&gt;');
    assert.equal(esc('w:val'), 'w:val');
  });

  it('replaceT updates both plain and xml:space preserve w:t nodes', () => {
    const xml = '<w:t>OLD</w:t><w:t xml:space="preserve">OLD</w:t>';
    const out = replaceT(xml, 'OLD', 'NEW');
    assert.match(out, /<w:t>NEW<\/w:t>/);
    assert.match(out, /<w:t xml:space="preserve">NEW<\/w:t>/);
  });
});
