import * as THREE from 'three'

type TrailPoint = { x: number; y: number; age: number; force: number }

export class TouchTexture {
  readonly size = 64
  readonly maxAge = 120
  readonly radius = 0.15
  readonly canvas = document.createElement('canvas')
  readonly texture: THREE.Texture
  private readonly ctx: CanvasRenderingContext2D
  private readonly trail: TrailPoint[] = []

  constructor() {
    this.canvas.width = this.canvas.height = this.size
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!
    this.texture = new THREE.Texture(this.canvas)
    this.clear()
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0
    const last = this.trail[this.trail.length - 1]
    if (last) {
      const dx = last.x - point.x
      const dy = last.y - point.y
      force = Math.min((dx * dx + dy * dy) * 10000, 1)
    }
    this.trail.push({ x: point.x, y: point.y, age: 0, force })
  }

  update() {
    this.clear()
    for (let index = this.trail.length - 1; index >= 0; index -= 1) {
      const point = this.trail[index]
      point.age += 1
      if (point.age > this.maxAge) {
        this.trail.splice(index, 1)
        continue
      }
      this.drawTouch(point)
    }
    this.texture.needsUpdate = true
  }

  reset() {
    this.trail.length = 0
    this.clear()
    this.texture.needsUpdate = true
  }

  private clear() {
    this.ctx.fillStyle = 'black'
    this.ctx.fillRect(0, 0, this.size, this.size)
  }

  private drawTouch(point: TrailPoint) {
    const x = point.x * this.size
    const y = (1 - point.y) * this.size
    const ageRatio = point.age / this.maxAge
    const envelope = ageRatio < 0.3
      ? Math.sin((ageRatio / 0.3) * Math.PI * 0.5)
      : Math.sin(((1 - ageRatio) / 0.7) * Math.PI * 0.5)
    const radius = this.size * this.radius * envelope * point.force
    if (radius <= 0.01) return
    const gradient = this.ctx.createRadialGradient(x, y, radius * 0.25, x, y, radius)
    gradient.addColorStop(0, 'rgba(255,255,255,0.2)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    this.ctx.beginPath()
    this.ctx.fillStyle = gradient
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fill()
  }
}
