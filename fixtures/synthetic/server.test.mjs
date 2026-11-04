import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './server.mjs';
const request = (url, headers = {}) => {
  let status; let body;
  handler({ url, headers }, { writeHead(code) { status = code; }, end(value) { body = value; } });
  return { status, body };
};
test('private page rejects anonymous requests', () => assert.equal(request('/private').status, 401));
test('public page needs no authentication', () => assert.equal(request('/').status, 200));
test('authenticated page returns the synthetic content', () => {
  const result = request('/private', { 'x-fixture-auth': 'britepulse-public-fixture' });
  assert.equal(result.status, 200);
  assert.match(result.body, /Stable content/);
});
