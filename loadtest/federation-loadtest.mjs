#!/usr/bin/env node
/**
 * Parley federation load test.
 *
 * Spawns N users on two Parley stacks, creates cross-server personal chats
 * via the /api/personal-chats/by-jid endpoint (which provisions a shadow
 * remote user + room, bypassing local friendship requirements), then fires
 * M messages from each A-side user to its B-side peer and measures end-to-
 * end latency.
 *
 * Usage:
 *   node federation-loadtest.mjs \
 *     --side-a-url=http://localhost:8080 --side-a-domain=parley-a.local \
 *     --side-b-url=http://localhost:8081 --side-b-domain=parley-b.local \
 *     --count=50 --messages=100
 */

import { io } from 'socket.io-client'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = 'true'] = a.replace(/^--/, '').split('=')
      return [k, v]
    }),
)

const SIDE_A_URL = args['side-a-url'] ?? 'http://localhost:8080'
const SIDE_B_URL = args['side-b-url'] ?? 'http://localhost:8081'
const SIDE_A_DOMAIN = args['side-a-domain'] ?? 'parley-a.local'
const SIDE_B_DOMAIN = args['side-b-domain'] ?? 'parley-b.local'
const COUNT = Number(args['count'] ?? 50)
const MESSAGES = Number(args['messages'] ?? 100)
const RUN_ID = Math.random().toString(36).slice(2, 8)

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a)

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
  if (!res.ok) {
    throw new Error(`${opts.method ?? 'GET'} ${url} -> ${res.status}: ${text}`)
  }
  return text ? JSON.parse(text) : null
}

async function register(baseUrl, username, email, password) {
  return jfetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  })
}

async function login(baseUrl, email, password) {
  return jfetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

async function openByJid(baseUrl, token, jid) {
  return jfetch(`${baseUrl}/api/personal-chats/by-jid`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jid }),
  })
}

function connectSocket(baseUrl, token) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, { auth: { token }, transports: ['websocket'] })
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', (err) =>
      reject(new Error(`socket: ${err.message}`)),
    )
  })
}

async function seedUsers(baseUrl, prefix, n) {
  const users = []
  for (let i = 0; i < n; i++) {
    const username = `lt${RUN_ID}${prefix}${i}`
    const email = `${username}@test.local`
    const password = 'Password123!'
    try {
      await register(baseUrl, username, email, password)
    } catch {
      /* user may already exist */
    }
    const { accessToken } = await login(baseUrl, email, password)
    users.push({ username, email, password, token: accessToken })
  }
  return users
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0
  const idx = Math.min(
    sortedArr.length - 1,
    Math.floor((p / 100) * sortedArr.length),
  )
  return sortedArr[idx]
}

async function waitForBridge(baseUrl, token) {
  for (let i = 0; i < 30; i++) {
    try {
      const stats = await jfetch(`${baseUrl}/api/admin/xmpp/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (stats?.connected) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Bridge on ${baseUrl} never came online`)
}

async function main() {
  log(`Run ${RUN_ID}: count=${COUNT} messages=${MESSAGES}`)

  log('Seeding users on side A...')
  const aUsers = await seedUsers(SIDE_A_URL, 'a', COUNT)
  log('Seeding users on side B...')
  const bUsers = await seedUsers(SIDE_B_URL, 'b', COUNT)

  log('Waiting for XMPP bridges...')
  await waitForBridge(SIDE_A_URL, aUsers[0].token)
  await waitForBridge(SIDE_B_URL, bUsers[0].token)

  log('Provisioning cross-server personal rooms on side A (remote=B)...')
  for (let i = 0; i < COUNT; i++) {
    const targetJid = `${bUsers[i].username}@${SIDE_B_DOMAIN}`
    const room = await openByJid(SIDE_A_URL, aUsers[i].token, targetJid)
    aUsers[i].roomId = room.id
  }

  log('Connecting sockets...')
  const aSockets = await Promise.all(
    aUsers.map((u) => connectSocket(SIDE_A_URL, u.token)),
  )
  const bSockets = await Promise.all(
    bUsers.map((u) => connectSocket(SIDE_B_URL, u.token)),
  )

  const latencies = []
  let received = 0
  let errors = 0
  const expected = COUNT * MESSAGES

  const receivedByKey = new Map()
  const sendTimes = new Map()

  bSockets.forEach((sock) => {
    sock.on('message:new', (msg) => {
      try {
        const parsed = JSON.parse(msg.content)
        if (parsed.runId !== RUN_ID) return
        const key = `${parsed.a}:${parsed.seq}`
        receivedByKey.set(key, Date.now())
        received += 1
      } catch {
        /* non-loadtest message */
      }
    })
  })

  log(`Sending ${expected} messages cross-server...`)
  const sendStart = Date.now()

  for (let seq = 0; seq < MESSAGES; seq++) {
    await Promise.all(
      aUsers.map(async (u, i) => {
        const body = JSON.stringify({
          runId: RUN_ID,
          a: i,
          seq,
          sentAt: Date.now(),
        })
        const key = `${i}:${seq}`
        sendTimes.set(key, Date.now())
        try {
          aSockets[i].emit('message:send', {
            roomId: u.roomId,
            content: body,
          })
        } catch {
          errors += 1
        }
      }),
    )
  }

  const deadline = Date.now() + 300_000
  while (received < expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250))
  }

  for (const [key, recvTs] of receivedByKey.entries()) {
    const sentTs = sendTimes.get(key)
    if (sentTs) latencies.push(recvTs - sentTs)
  }
  latencies.sort((a, b) => a - b)

  const durationMs = Date.now() - sendStart
  const throughput = received / (durationMs / 1000)

  console.log('\n─── Results ─────────────────────────')
  console.log(`Run:         ${RUN_ID}`)
  console.log(`Clients:     ${COUNT} per side`)
  console.log(`Messages:    ${expected}`)
  console.log(`Received:    ${received}`)
  console.log(`Errors:      ${errors}`)
  console.log(`Throughput:  ${throughput.toFixed(1)} msg/s`)
  console.log(`Latency p50: ${percentile(latencies, 50)} ms`)
  console.log(`Latency p95: ${percentile(latencies, 95)} ms`)
  console.log(`Latency p99: ${percentile(latencies, 99)} ms`)
  console.log(`Duration:    ${(durationMs / 1000).toFixed(2)} s`)

  aSockets.forEach((s) => s.close())
  bSockets.forEach((s) => s.close())
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
