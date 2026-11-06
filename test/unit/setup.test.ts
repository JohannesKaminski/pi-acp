import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEntry, isEphemeralInstall, mergeConfig } from '../../src/setup.js'

const base = {
  nodePath: '/opt/node/bin/node',
  scriptPath: '/opt/u/lib/node_modules/pi-acp/dist/index.js',
  piPath: '/opt/pi/bin/pi',
  basePath: '/usr/bin:/opt/node/bin',
  platform: 'linux' as const
}

test('buildEntry uses absolute node + script and an explicit PATH', () => {
  const e = buildEntry(base) as any
  assert.equal(e.command, '/opt/node/bin/node')
  assert.deepEqual(e.args, [base.scriptPath])
  assert.equal(e.env.PI_ACP_PI_COMMAND, '/opt/pi/bin/pi')
  assert.equal(e.env.PATH, '/opt/node/bin:/opt/pi/bin:/usr/bin')
})

test('mergeConfig keeps other agents, user keys, and the allow-list', () => {
  const existing = {
    default_mcp_settings: { use_idea_mcp: false },
    agent_servers: {
      other: { command: 'x' },
      'pi-acp': { idea_mcp_allowed_tools: ['read_file'], env: { FOO: '1' }, command: 'old' }
    }
  }
  const m = mergeConfig(existing, 'pi-acp', buildEntry(base)) as any
  assert.equal(m.default_mcp_settings.use_idea_mcp, false)
  assert.equal(m.default_mcp_settings.use_custom_mcp, true)
  assert.deepEqual(m.agent_servers.other, { command: 'x' })
  assert.deepEqual(m.agent_servers['pi-acp'].idea_mcp_allowed_tools, ['read_file'])
  assert.equal(m.agent_servers['pi-acp'].env.FOO, '1')
  assert.equal(m.agent_servers['pi-acp'].command, '/opt/node/bin/node')
})

test('isEphemeralInstall detects the npx cache', () => {
  assert.ok(isEphemeralInstall('/opt/u/.npm/_npx/abc/node_modules/pi-acp/dist/index.js'))
  assert.ok(!isEphemeralInstall(base.scriptPath))
})

test('mergeConfig on an empty file enables IDE MCP', () => {
  const m = mergeConfig({}, 'pi-acp', buildEntry(base)) as any
  assert.equal(m.default_mcp_settings.use_idea_mcp, true)
})
