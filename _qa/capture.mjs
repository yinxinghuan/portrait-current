import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, '_qa', 'ui')
await mkdir(output, { recursive: true })
const noCorsAvatar = await readFile(path.join(root, 'public', 'baseline', 'sample-03.png'))
const avatarServer = createServer((request, response) => {
  if (request.url === '/avatar.png') {
    response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
    response.end(noCorsAvatar)
    return
  }
  response.writeHead(404)
  response.end()
})
await new Promise((resolve, reject) => {
  avatarServer.once('error', reject)
  avatarServer.listen(4196, '127.0.0.1', resolve)
})
const server = spawn(process.execPath, [
  path.join(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1', '--port', '4195',
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let stderr = ''
server.stderr.on('data', (chunk) => { stderr += chunk.toString() })
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Vite did not start')), 15000)
  server.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('Local:')) {
      clearTimeout(timer)
      resolve()
    }
  })
  server.on('exit', (code) => reject(new Error(`Vite exited: ${code}\n${stderr}`)))
})

try {
  const browser = await chromium.launch({ headless: true })
  const errors = []
  for (const viewport of [
    { width: 390, height: 844, name: '390x844' },
    { width: 320, height: 568, name: '320x568' },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true })
    page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') console.log(`${viewport.name} console ${message.type()}: ${message.text()}`)
      if (/Shader couldn't compile|WebGLProgram: shader error/.test(message.text())) {
        errors.push(`${viewport.name}: ${message.text()}`)
      }
    })
    await page.goto('http://127.0.0.1:4195/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.body.dataset.avatarSource === 'default')
    await page.waitForTimeout(2200)
    await page.screenshot({ path: path.join(output, `${viewport.name}-default-start.png`) })

    const size = viewport.width * .82
    const left = (viewport.width - size) / 2
    const top = (viewport.height - size) / 2
    await page.mouse.move(left + size * .125, top + size * .17)
    await page.mouse.down()
    for (let row = 0; row < 3; row += 1) {
      const columns = row % 2 === 0 ? [0, 1, 2, 3] : [3, 2, 1, 0]
      for (const col of columns) {
        await page.mouse.move(left + size * ((col + .5) / 4), top + size * ((row + .5) / 3), { steps: 8 })
        await page.waitForTimeout(90)
      }
    }
    await page.mouse.up()
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(output, `${viewport.name}-complete.png`) })
    const state = await page.evaluate(() => ({
      source: document.body.dataset.avatarSource,
      touched: document.querySelectorAll('.coverage i.is-touched').length,
      restartVisible: !(document.querySelector('.guide button')?.hidden),
      canvasWidth: document.querySelector('canvas')?.width,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    }))
    if (state.source !== 'default' || state.touched < 9 || !state.restartVisible || !state.canvasWidth) {
      errors.push(`${viewport.name}: invalid completion ${JSON.stringify(state)}`)
    }
    if (state.scrollWidth > state.innerWidth) errors.push(`${viewport.name}: horizontal overflow`)
    await page.close()
  }

  for (const viewport of [
    { width: 390, height: 844, name: '390x844' },
    { width: 320, height: 568, name: '320x568' },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true })
    page.on('pageerror', (error) => errors.push(`${viewport.name} platform: ${error.message}`))
    await page.addInitScript(({ avatarUrl }) => {
      Object.defineProperty(window, 'webkit', {
        configurable: true,
        value: {
          messageHandlers: {
            aigram: {
              postMessage(message) {
                if (typeof message !== 'string' || !message.startsWith('callAPI-')) return
                const payload = JSON.parse(atob(message.slice('callAPI-'.length)))
                window.setTimeout(() => {
                  const callback = window[`__aigram_cb_${payload.request_id.replaceAll('-', '_')}`]
                  callback?.(JSON.stringify({
                    request_id: payload.request_id,
                    success: true,
                    data: {
                      retcode: 0,
                      data: { name: '平台真实用户', head_url: avatarUrl },
                    },
                  }))
                }, 30)
              },
            },
          },
        },
      })
    }, { avatarUrl: 'http://127.0.0.1:4196/avatar.png' })
    await page.goto('http://127.0.0.1:4195/?api_origin=https%3A%2F%2Faigram.app&telegram_id=739201', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.body.dataset.avatarSource === 'player')
    await page.waitForFunction(() => document.body.dataset.avatarRenderer === 'tiles')
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(output, `${viewport.name}-platform-player.png`) })
    const state = await page.evaluate(() => ({
      source: document.body.dataset.avatarSource,
      renderer: document.body.dataset.avatarRenderer,
      tiles: document.querySelectorAll('.portrait-tiles span').length,
      bootPresent: Boolean(document.querySelector('.boot-bridge')),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    }))
    if (state.source !== 'player' || state.renderer !== 'tiles' || state.tiles !== 576 || state.bootPresent) {
      errors.push(`${viewport.name} platform: invalid identity render ${JSON.stringify(state)}`)
    }
    if (state.scrollWidth > state.innerWidth) errors.push(`${viewport.name} platform: horizontal overflow`)
    await page.close()
  }

  const override = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  override.on('pageerror', (error) => errors.push(`override: ${error.message}`))
  await override.goto('http://127.0.0.1:4195/?avatar_url=./baseline/sample-03.png', { waitUntil: 'domcontentloaded' })
  await override.waitForFunction(() => document.body.dataset.avatarSource === 'query')
  await override.waitForTimeout(2200)
  await override.screenshot({ path: path.join(output, '390x844-query-avatar.png') })
  await override.close()

  const baseline = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  baseline.on('pageerror', (error) => errors.push(`baseline: ${error.message}`))
  await baseline.goto('http://127.0.0.1:4195/?baseline=1', { waitUntil: 'domcontentloaded' })
  await baseline.waitForFunction(() => document.body.dataset.avatarSource === 'baseline')
  await baseline.waitForTimeout(2200)
  await baseline.screenshot({ path: path.join(output, '390x844-baseline.png') })
  const baselineState = await baseline.evaluate(() => ({
    hudDisplay: getComputedStyle(document.querySelector('.hud')).display,
    source: document.body.dataset.avatarSource,
    canvasWidth: document.querySelector('canvas')?.width,
  }))
  if (baselineState.hudDisplay !== 'none' || baselineState.source !== 'baseline' || !baselineState.canvasWidth) {
    errors.push(`baseline: invalid state ${JSON.stringify(baselineState)}`)
  }
  await baseline.close()

  await browser.close()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`QA passed. Screenshots: ${output}`)
} finally {
  server.kill('SIGTERM')
  avatarServer.close()
}
