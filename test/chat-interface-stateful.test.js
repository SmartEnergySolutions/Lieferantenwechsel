"use strict";

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

test('ChatInterface saves context, persists feedback, and resumes pending decisions', async () => {
  const tmp = path.join(__dirname, 'tmp-chat');
  await fs.remove(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  await fs.mkdirp(stateDir);
  await fs.mkdirp(outputsDir);

  process.env.STATE_DIR = stateDir;
  process.env.OUTPUTS_DIR = outputsDir;

  const { StateManager } = require('../src/state/state-manager');
  const sm = new StateManager(stateDir);
  await sm.initializeState({ interactive: true });

  const { SessionManager } = require('../src/interactive/session-manager');
  const smgr = new SessionManager(sm);
  const { SessionPersistence } = require('../src/interactive/session-persistence');
  const sp = new SessionPersistence(outputsDir);

  const { ChatInterface } = require('../src/interactive/chat-interface');
  const chat = new ChatInterface(sm, smgr, { checkpointOnReview: true, sessionPersistence: sp });

  // save context
  const entry = await chat.saveInteractionContext({ chapterId: '01-overview', term: 'Test' }, [{}, {}]);
  assert.ok(entry);

  // persist feedback
  const ok = await chat.persistFeedback('search_results', { liked: [0,1] });
  assert.strictEqual(ok, true);

  // create pending decision and resume
  await smgr.addPendingDecision('01-overview', { type: 'SEARCH_RESULTS_SELECTION', context: {} });
  const latest = await chat.resumeFromPendingDecision();
  assert.ok(latest);
  assert.strictEqual(latest.chapterId, '01-overview');
});
