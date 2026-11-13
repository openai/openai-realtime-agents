const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual hook, replacing only React and SDK/browser boundaries.
// No Realtime API credentials, media devices or new test dependency are needed.
const filename = path.join(__dirname, '../src/app/hooks/useRealtimeSession.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(connectResults = []) {
  const sessions = [];
  const statuses = [];
  class RealtimeSession {
    constructor() {
      this.closed = 0;
      this.messages = [];
      this.result = connectResults.shift();
      sessions.push(this);
    }
    async connect() { await this.result; }
    close() { this.closed++; }
    sendMessage(message) { this.messages.push(message); }
  }
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'react') return {
        useRef: (current) => ({ current }),
        useState: (value) => [value, () => {}],
        useCallback: (callback) => callback,
        useEffect: () => {},
      };
      if (name === '@openai/agents/realtime') return {
        RealtimeSession,
        OpenAIRealtimeWebRTC: class {},
      };
      if (name === '../lib/codecUtils') return { applyCodecPreferences() {} };
      if (name === '../contexts/EventContext') return {
        useEvent: () => ({ logClientEvent() {}, logServerEvent() {} }),
      };
      if (name === './useHandleSessionHistory') return {
        useHandleSessionHistory: () => ({ current: {} }),
      };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
  }, { filename });
  const hook = module.exports.useRealtimeSession({
    onConnectionChange: (status) => statuses.push(status),
  });
  const connect = (getEphemeralKey = async () => 'key') => hook.connect({
    getEphemeralKey,
    initialAgents: [{}],
  });
  return { hook, connect, sessions, statuses };
}

test('a pending key prevents an overlapping connect from starting', async () => {
  const { connect, sessions, statuses } = setup();
  const key = deferred();
  const first = connect(() => key.promise);
  let secondKeyCalls = 0;
  await connect(async () => { secondKeyCalls++; return 'second'; });
  assert.equal(secondKeyCalls, 0);
  assert.equal(sessions.length, 0);
  key.resolve('first');
  await first;
  assert.equal(sessions.length, 1);
  assert.deepEqual(statuses, ['CONNECTING', 'CONNECTED']);
});

test('a failed connection closes its own session and allows a retry', async () => {
  const failure = deferred();
  const { hook, connect, sessions, statuses } = setup([failure.promise]);
  const first = connect();
  const error = new Error('transport rejected');
  failure.reject(error);
  await assert.rejects(first, (actual) => actual === error);
  assert.equal(sessions[0].closed, 1);
  await connect();
  hook.sendUserText('retry works');
  assert.deepEqual(sessions[1].messages, ['retry works']);
  assert.equal(statuses.at(-1), 'CONNECTED');
});

test('a rejected key releases the pending guard for retry', async () => {
  const { connect, sessions, statuses } = setup();
  const error = new Error('key rejected');
  await assert.rejects(connect(async () => { throw error; }),
    (actual) => actual === error);
  assert.equal(sessions.length, 0);
  assert.equal(statuses.at(-1), 'DISCONNECTED');
  await connect();
  assert.equal(sessions.length, 1);
  assert.equal(statuses.at(-1), 'CONNECTED');
});

test('disconnect cancels a pending key before it can create a session', async () => {
  const { hook, connect, sessions, statuses } = setup();
  const key = deferred();
  const first = connect(() => key.promise);
  hook.disconnect();
  key.resolve('cancelled');
  await first;
  assert.equal(sessions.length, 0);
  assert.equal(statuses.at(-1), 'DISCONNECTED');
  await connect();
  assert.equal(sessions.length, 1);
});

test('an older transport failure cannot close or clear a newer session', async () => {
  const failure = deferred();
  const { hook, connect, sessions, statuses } = setup([failure.promise]);
  const first = connect();
  await new Promise(setImmediate); // Drain the cross-realm key promise.
  assert.equal(sessions.length, 1);
  hook.disconnect();
  await connect();
  const error = new Error('older transport rejected');
  failure.reject(error);
  await assert.rejects(first, (actual) => actual === error);
  assert.equal(sessions[1].closed, 0);
  hook.sendUserText('new session survives');
  assert.deepEqual(sessions[1].messages, ['new session survives']);
  assert.equal(statuses.at(-1), 'CONNECTED');
});

test('an older key failure cannot reset the status of a newer session', async () => {
  const { hook, connect, sessions, statuses } = setup();
  const key = deferred();
  const first = connect(() => key.promise);
  hook.disconnect();
  await connect();
  const error = new Error('older key rejected');
  key.reject(error);
  await assert.rejects(first, (actual) => actual === error);
  assert.equal(sessions[0].closed, 0);
  hook.sendUserText('new session survives');
  assert.deepEqual(sessions[0].messages, ['new session survives']);
  assert.equal(statuses.at(-1), 'CONNECTED');
});

test('an older connection completing after disconnect cannot report connected', async () => {
  const pending = deferred();
  const { hook, connect, sessions, statuses } = setup([pending.promise]);
  const first = connect();
  await new Promise(setImmediate);
  assert.equal(sessions.length, 1);
  hook.disconnect();
  pending.resolve();
  await first;
  assert.equal(sessions[0].closed, 1);
  assert.equal(statuses.at(-1), 'DISCONNECTED');
});
