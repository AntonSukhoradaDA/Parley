#!/usr/bin/env node
/**
 * Smoke test: connect to Parley's Prosody sidecar as a Jabber client using a
 * Parley account's credentials (c2s, SASL PLAIN, XEP-0078-ish auth).
 *
 * Usage:
 *   node c2s-login-test.mjs --host=localhost --domain=parley.local \
 *       --user=jabbertest --password=TestPass123!
 */

import { client, xml } from '@xmpp/client'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = 'true'] = a.replace(/^--/, '').split('=')
      return [k, v]
    }),
)

const HOST = args['host'] ?? 'localhost'
const DOMAIN = args['domain'] ?? 'parley.local'
const USER = args['user'] ?? 'jabbertest'
const PASSWORD = args['password'] ?? 'TestPass123!'

// Dev: accept self-signed cert from Prosody's generated cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const xmpp = client({
  service: `xmpp://${HOST}:5222`,
  domain: DOMAIN,
  username: USER,
  password: PASSWORD,
})

xmpp.on('error', (err) => {
  console.error('[error]', err.message)
})
xmpp.on('offline', () => {
  console.log('[offline]')
})
xmpp.on('online', async (address) => {
  console.log('[online]', address.toString())
  await xmpp.send(xml('presence'))
  setTimeout(async () => {
    await xmpp.stop()
    process.exit(0)
  }, 1000)
})

try {
  await xmpp.start()
} catch (err) {
  console.error('[start-failed]', err.message ?? err)
  process.exit(1)
}
