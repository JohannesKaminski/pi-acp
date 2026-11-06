import test from 'node:test'
import assert from 'node:assert/strict'
import { getPideaSessionMapPath } from '../../src/acp/paths.js'
import { join, resolve } from 'node:path'

test('getPideaSessionMapPath honors PIDEA_SESSION_MAP override', () => {
  const prev = process.env.PIDEA_SESSION_MAP
  process.env.PIDEA_SESSION_MAP = '/tmp/pidea-smoke-override/session-map.json'
  try {
    assert.equal(getPideaSessionMapPath(), resolve('/tmp/pidea-smoke-override/session-map.json'))
  } finally {
    if (prev === undefined) delete process.env.PIDEA_SESSION_MAP
    else process.env.PIDEA_SESSION_MAP = prev
  }
})

test('getPideaSessionMapPath defaults under ~/.pi/pidea', () => {
  const prev = process.env.PIDEA_SESSION_MAP
  delete process.env.PIDEA_SESSION_MAP
  try {
    assert.ok(getPideaSessionMapPath().endsWith(join('.pi', 'pidea', 'session-map.json')))
  } finally {
    if (prev !== undefined) process.env.PIDEA_SESSION_MAP = prev
  }
})
