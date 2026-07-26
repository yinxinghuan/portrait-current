import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, '_qa', 'ui')
await mkdir(output, { recursive: true })
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
    await page.goto('http://127.0.0.1:4195/', { waitUntil: 'networkidle' })
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

  const override = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  override.on('pageerror', (error) => errors.push(`override: ${error.message}`))
  await override.goto('http://127.0.0.1:4195/?avatar_url=./baseline/sample-03.png', { waitUntil: 'networkidle' })
  await override.waitForFunction(() => document.body.dataset.avatarSource === 'query')
  await override.waitForTimeout(2200)
  await override.screenshot({ path: path.join(output, '390x844-query-avatar.png') })
  await override.close()

  const baseline = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  baseline.on('pageerror', (error) => errors.push(`baseline: ${error.message}`))
  await baseline.goto('http://127.0.0.1:4195/?baseline=1', { waitUntil: 'networkidle' })
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
}
