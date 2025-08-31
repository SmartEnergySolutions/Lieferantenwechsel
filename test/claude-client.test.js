"use strict";

const { test } = require('node:test');
const assert = require('assert');

test('ClaudeClient returns offline-safe stub content', async () => {
  const { ClaudeClient } = require('../src/generation/claude-client');
  const cc = new ClaudeClient({ apiKey: null });
  const out = await cc.generateContent('Bitte generiere eine Kurzbeschreibung', { chapter: '01-overview' });
  assert.match(out, /Claude Stub/);
  assert.match(out, /Kapitel: 01-overview/);
});
