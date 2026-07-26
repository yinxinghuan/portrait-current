/// <reference types="vite/client" />

interface VRDisplay {
  requestPresent(layers: unknown[]): Promise<void>
  exitPresent(): Promise<void>
  requestAnimationFrame(callback: FrameRequestCallback): number
  cancelAnimationFrame(handle: number): void
}
