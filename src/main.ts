import './style.css'
import * as THREE from 'three'
import { callAigramAPI, isInAigram, telegramId } from './shared/runtime/bridge'
import { TouchTexture } from './TouchTexture'
import particleVertex from './shaders/particle.compiled.vert?raw'
import particleFragment from './shaders/particle.frag?raw'

type PreparedImage = {
  canvas: HTMLCanvasElement
  pixels: Uint8ClampedArray
  width: number
  height: number
  source: 'baseline' | 'query' | 'player' | 'default'
}

const params = new URLSearchParams(location.search)
const baseline = params.get('baseline') === '1'
const locale = localStorage.getItem('game_locale') === 'en'
  || (!localStorage.getItem('game_locale') && !navigator.language.toLowerCase().startsWith('zh'))
  ? 'en'
  : 'zh'
const copy = locale === 'zh'
  ? {
      loading: '正在读取头像粒子…',
      guide: '划过头像，唤醒像素电流',
      done: '你的像素肖像已收束',
      restart: '重新发现',
      error: '头像不可读，已使用 AlterU 默认头像',
    }
  : {
      loading: 'Reading portrait particles…',
      guide: 'Trace your portrait to wake the current',
      done: 'Your particle portrait has converged',
      restart: 'Rediscover',
      error: 'Portrait unreadable — using the AlterU default',
    }

const stage = document.querySelector<HTMLElement>('.stage')!
const loading = document.querySelector<HTMLElement>('.loading')!
const guide = document.querySelector<HTMLElement>('.guide p')!
const restart = document.querySelector<HTMLButtonElement>('.guide button')!
const coverage = document.querySelector<HTMLElement>('.coverage')!
for (let index = 0; index < 12; index += 1) coverage.append(document.createElement('i'))
const coverageMarks = [...coverage.querySelectorAll<HTMLElement>('i')]

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000)
camera.position.z = 300
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
stage.append(renderer.domElement)

const clock = new THREE.Clock(true)
const touch = new TouchTexture()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const touchedCells = new Set<number>()
const baselineSamples = [1, 2, 3, 4, 5].map((n) => `./baseline/sample-0${n}.png`)
let baselineIndex = 0
let particleMesh: THREE.Mesh | null = null
let hitArea: THREE.Mesh | null = null
let imageWidth = 1
let imageHeight = 1
let active = false
let pointerStartX = 0
let pointerStartY = 0
let intro = 0
let fallbackUsed = false
let visualReadySent = false

function handoffFirstFrame() {
  if (visualReadySent) return
  visualReadySent = true
  document.body.dataset.visualReady = 'true'
  const boot = document.querySelector<HTMLElement>('.boot-bridge')
  boot?.classList.add('is-ready')
  window.setTimeout(() => boot?.remove(), 420)
}

function loadImage(url: string, allowCors: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (allowCors) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load ${url}`))
    image.src = new URL(url, document.baseURI).href
  })
}

function prepareImage(image: HTMLImageElement, source: PreparedImage['source'], keepDimensions = false): PreparedImage {
  const width = keepDimensions ? image.naturalWidth : 180
  const height = keepDimensions ? image.naturalHeight : 180
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  if (keepDimensions) {
    ctx.drawImage(image, 0, 0, width, height)
  } else {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  }

  const flipped = document.createElement('canvas')
  flipped.width = width
  flipped.height = height
  const flippedCtx = flipped.getContext('2d', { willReadFrequently: true })!
  flippedCtx.translate(0, height)
  flippedCtx.scale(1, -1)
  flippedCtx.drawImage(canvas, 0, 0)
  const pixels = flippedCtx.getImageData(0, 0, width, height).data
  return { canvas, pixels, width, height, source }
}

async function resolveProductImage(): Promise<PreparedImage> {
  const queryAvatar = params.get('avatar_url')?.trim()
  let playerAvatar = ''
  if (!queryAvatar && isInAigram && telegramId) {
    try {
      const profile = await callAigramAPI<{ retcode: number; data?: { head_url?: string } }>(
        `/note/telegram/user/get/info/by/telegram_id?telegram_id=${telegramId}`,
        'GET',
      )
      if (profile.retcode === 0) playerAvatar = profile.data?.head_url || ''
    } catch {
      playerAvatar = ''
    }
  }

  const candidates: Array<{ url: string; source: PreparedImage['source']; allowCors: boolean }> = []
  if (queryAvatar) candidates.push({ url: queryAvatar, source: 'query', allowCors: true })
  if (playerAvatar) candidates.push({ url: playerAvatar, source: 'player', allowCors: false })
  candidates.push({ url: './alteru-default-avatar.jpg', source: 'default', allowCors: false })

  for (const candidate of candidates) {
    try {
      const image = await loadImage(candidate.url, candidate.allowCors)
      const prepared = prepareImage(image, candidate.source)
      fallbackUsed = candidate.source === 'default' && (Boolean(queryAvatar) || Boolean(playerAvatar))
      return prepared
    } catch {
      continue
    }
  }
  throw new Error('No readable portrait source')
}

function destroyParticles() {
  if (particleMesh) {
    scene.remove(particleMesh)
    particleMesh.geometry.dispose()
    ;(particleMesh.material as THREE.Material).dispose()
  }
  if (hitArea) {
    scene.remove(hitArea)
    hitArea.geometry.dispose()
    ;(hitArea.material as THREE.Material).dispose()
  }
  particleMesh = null
  hitArea = null
}

function initParticles(prepared: PreparedImage) {
  destroyParticles()
  document.body.dataset.avatarSource = prepared.source
  imageWidth = prepared.width
  imageHeight = prepared.height
  const threshold = 34
  let visible = 0
  for (let index = 0; index < imageWidth * imageHeight; index += 1) {
    if (prepared.pixels[index * 4] > threshold) visible += 1
  }

  const texture = new THREE.Texture(prepared.canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.format = THREE.RGBFormat
  texture.needsUpdate = true

  const positions = new THREE.BufferAttribute(new Float32Array([
    -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0,
  ]), 3)
  const uvs = new THREE.BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 1, 1,
  ]), 2)
  const indices = new Uint16Array(visible)
  const offsets = new Float32Array(visible * 3)
  const angles = new Float32Array(visible)
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < imageWidth * imageHeight; sourceIndex += 1) {
    if (prepared.pixels[sourceIndex * 4] <= threshold) continue
    offsets[targetIndex * 3] = sourceIndex % imageWidth
    offsets[targetIndex * 3 + 1] = Math.floor(sourceIndex / imageWidth)
    indices[targetIndex] = sourceIndex
    angles[targetIndex] = Math.random() * Math.PI
    targetIndex += 1
  }

  const geometry = new THREE.InstancedBufferGeometry()
  geometry.addAttribute('position', positions)
  geometry.addAttribute('uv', uvs)
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 2, 1, 2, 3, 1]), 1))
  geometry.addAttribute('pindex', new THREE.InstancedBufferAttribute(indices, 1, false))
  geometry.addAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3, false))
  geometry.addAttribute('angle', new THREE.InstancedBufferAttribute(angles, 1, false))

  const material = new THREE.RawShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRandom: { value: 1 },
      uDepth: { value: 40 },
      uSize: { value: 0.5 },
      uTextureSize: { value: new THREE.Vector2(imageWidth, imageHeight) },
      uTexture: { value: texture },
      uTouch: { value: touch.texture },
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    depthTest: false,
    transparent: true,
  })

  particleMesh = new THREE.Mesh(geometry, material)
  hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(imageWidth, imageHeight, 1, 1),
    new THREE.MeshBasicMaterial({ visible: false, depthTest: false }),
  )
  scene.add(particleMesh, hitArea)
  intro = 0
  touchedCells.clear()
  touch.reset()
  renderCoverage()
  resize()
  loading.hidden = true
}

function resize() {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  const fovHeight = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z
  const fovWidth = fovHeight * camera.aspect
  const scale = baseline
    ? fovHeight / imageHeight
    : Math.min((fovHeight * 0.72) / imageHeight, (fovWidth * 0.92) / imageWidth)
  particleMesh?.scale.set(scale, scale, 1)
  hitArea?.scale.set(scale, scale, 1)
}

function getUv(event: PointerEvent) {
  if (!hitArea) return null
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const intersection = raycaster.intersectObject(hitArea)[0]
  return intersection?.uv || null
}

function renderCoverage() {
  coverageMarks.forEach((mark, index) => mark.classList.toggle('is-touched', touchedCells.has(index)))
  if (touchedCells.size >= 9) {
    guide.textContent = copy.done
    restart.hidden = false
  }
}

function addInteraction(event: PointerEvent) {
  const uv = getUv(event)
  if (!uv) return
  touch.addTouch(uv)
  if (baseline) return
  const col = Math.min(3, Math.floor(uv.x * 4))
  const row = Math.min(2, Math.floor(uv.y * 3))
  touchedCells.add(row * 4 + col)
  renderCoverage()
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  active = true
  pointerStartX = event.clientX
  pointerStartY = event.clientY
  renderer.domElement.setPointerCapture(event.pointerId)
  addInteraction(event)
})
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!active && !baseline) return
  addInteraction(event)
})
renderer.domElement.addEventListener('pointerup', async (event) => {
  active = false
  if (baseline && Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) < 8) {
    baselineIndex = (baselineIndex + 1) % baselineSamples.length
    const image = await loadImage(baselineSamples[baselineIndex], false)
    initParticles(prepareImage(image, 'baseline', true))
  }
})
renderer.domElement.addEventListener('pointercancel', () => { active = false })

restart.addEventListener('pointerdown', () => {
  touchedCells.clear()
  touch.reset()
  guide.textContent = copy.guide
  restart.hidden = true
  renderCoverage()
})

function animate() {
  requestAnimationFrame(animate)
  if (document.hidden) return
  const delta = Math.min(0.05, clock.getDelta())
  touch.update()
  if (particleMesh) {
    const uniforms = (particleMesh.material as THREE.RawShaderMaterial).uniforms
    uniforms.uTime.value += delta
    intro = Math.min(1, intro + delta / 1.5)
    const ease = 1 - Math.pow(1 - intro, 3)
    const completion = baseline ? 0 : Math.min(1, touchedCells.size / 9)
    const targetRandom = 2 - completion * 1.65
    const targetDepth = 4 - completion * 2.5
    const targetSize = 1.5
    const shownRandom = 1 + ease * (targetRandom - 1)
    const shownDepth = 40 + ease * (targetDepth - 40)
    const shownSize = 0.5 + ease * (targetSize - 0.5)
    uniforms.uRandom.value += (shownRandom - uniforms.uRandom.value) * 0.08
    uniforms.uDepth.value += (shownDepth - uniforms.uDepth.value) * 0.08
    uniforms.uSize.value += (shownSize - uniforms.uSize.value) * 0.08
  }
  renderer.render(scene, camera)
  if (particleMesh && !visualReadySent) requestAnimationFrame(handoffFirstFrame)
}

async function boot() {
  loading.textContent = copy.loading
  guide.textContent = copy.guide
  restart.textContent = copy.restart
  if (baseline) {
    document.body.classList.add('is-baseline')
    const image = await loadImage(baselineSamples[0], false)
    initParticles(prepareImage(image, 'baseline', true))
  } else {
    const prepared = await resolveProductImage()
    initParticles(prepared)
    if (fallbackUsed) {
      loading.hidden = false
      loading.textContent = copy.error
      setTimeout(() => { loading.hidden = true }, 2200)
    }
  }
}

window.addEventListener('resize', resize)
void boot().catch(() => {
  loading.hidden = false
  loading.textContent = copy.error
})
requestAnimationFrame(animate)
