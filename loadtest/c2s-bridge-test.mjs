#!/usr/bin/env node
/**
 * Two-way bridge smoke test.
 *
 * 1. Registers Alice and Bob on side A (same server).
 * 2. Opens a personal-chat room between them via Parley's API.
 * 3. Logs Bob in over XMPP c2s (as a Jabber client).
 * 4. Connects Alice via Socket.IO (as the Parley web UI).
 * 5. Alice sends a message via Socket.IO; verifies Bob's XMPP c2s sees it.
 * 6. Bob replies via XMPP c2s; verifies Alice's Socket.IO sees it.
 */

import { client as xmppClient, xml } from '@xmpp/client'
import { io } from 'socket.io-client'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const BASE_URL = 'http://localhost:8080'
const XMPP_HOST = 'localhost'
const XMPP_DOMAIN = 'parley-a.local'
const XMPP_PORT = 5222
const RUN = Math.random().toString(36).slice(2, 8)
const PASSWORD = 'TestPass123!'

const aliceUser = `bralice${RUN}`
const bobUser = `brbob${RUN}`

async function jfetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${url} -> ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function register(username) {
  try {
    await jfetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        email: `${username}@test.local`,
        username,
        password: PASSWORD,
      }),
    })
  } catch (err) {
    if (!/409|exist/i.test(String(err))) throw err
  }
}

async function login(username) {
  const { accessToken } = await jfetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: `${username}@test.local`,
      password: PASSWORD,
    }),
  })
  const user = await jfetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return { token: accessToken, user }
}

async function friendAndDM(aliceToken, bobUsername) {
  // Alice sends friend request
  const req = await jfetch(`${BASE_URL}/api/friends/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({ username: bobUsername }),
  })
  return req
}

async function acceptFriend(bobToken, requestId) {
  await jfetch(`${BASE_URL}/api/friends/accept/${requestId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bobToken}` },
  })
}

async function openPersonalChat(token, otherUserId) {
  return jfetch(`${BASE_URL}/api/personal-chats/${otherUserId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE_URL, { auth: { token }, transports: ['websocket'] })
    s.once('connect_error', (err) => reject(err))
    // Wait for the server-side handleConnection to finish (unread:init is
    // the last thing it emits). Otherwise client.userId may not be set yet
    // when we emit message:send.
    s.once('unread:init', () => resolve(s))
  })
}

function connectXmpp(username) {
  return new Promise((resolve, reject) => {
    const c = xmppClient({
      service: `xmpp://${XMPP_HOST}:${XMPP_PORT}`,
      domain: XMPP_DOMAIN,
      username,
      password: PASSWORD,
    })
    c.on('error', (err) => console.error(`[xmpp:${username}]`, err.message ?? err))
    c.once('online', async () => {
      await c.send(xml('presence'))
      resolve(c)
    })
    c.start().catch(reject)
  })
}

function waitFor(predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

async function main() {
  console.log(`Run ${RUN}: alice=${aliceUser} bob=${bobUser}`)

  await register(aliceUser)
  await register(bobUser)
  const alice = await login(aliceUser)
  const bob = await login(bobUser)

  const req = await friendAndDM(alice.token, bobUser)
  await acceptFriend(bob.token, req.id)
  const chat = await openPersonalChat(alice.token, bob.user.id)
  console.log(`Personal chat room id: ${chat.id}`)

  // Bob: Jabber client
  console.log('Bob connecting via XMPP c2s...')
  const bobXmpp = await connectXmpp(bobUser)
  console.log('Bob XMPP online')

  let bobReceivedFromAlice = null
  bobXmpp.on('stanza', (stanza) => {
    if (stanza.name !== 'message') return
    const body = stanza.getChildText('body')
    if (!body) return
    console.log(
      `[bob@xmpp] from=${stanza.attrs.from} body=${body.slice(0, 60)}`,
    )
    if (body.includes('hello-from-alice')) bobReceivedFromAlice = body
  })

  // Alice: Parley web via Socket.IO
  console.log('Alice connecting via Socket.IO...')
  const aliceSock = await connectSocket(alice.token)
  console.log('Alice socket connected')

  let aliceReceivedFromBob = null
  aliceSock.on('message:new', (msg) => {
    console.log(
      `[alice@web] from=${msg.sender?.username} body=${String(msg.content).slice(0, 60)}`,
    )
    if (String(msg.content).includes('hello-from-bob')) {
      aliceReceivedFromBob = msg.content
    }
  })

  // Alice sends via web to Bob -- Bob's Jabber client should see it
  console.log('\n--- Web -> Jabber ---')
  aliceSock.emit('message:send', {
    roomId: chat.id,
    content: `hello-from-alice (run ${RUN})`,
  })
  try {
    await waitFor(() => bobReceivedFromAlice, 5000)
    console.log('PASS: Bob (XMPP) received Alice (web) message')
  } catch {
    console.log('FAIL: Bob did not receive Alice')
  }

  // Bob sends via XMPP to Alice -- Alice's Parley web should see it
  console.log('\n--- Jabber -> Web ---')
  await bobXmpp.send(
    xml(
      'message',
      { type: 'chat', to: `${aliceUser}@${XMPP_DOMAIN}` },
      xml('body', {}, `hello-from-bob (run ${RUN})`),
    ),
  )
  try {
    await waitFor(() => aliceReceivedFromBob, 5000)
    console.log('PASS: Alice (web) received Bob (XMPP) message')
  } catch {
    console.log('FAIL: Alice did not receive Bob')
  }

  aliceSock.close()
  await bobXmpp.stop()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
