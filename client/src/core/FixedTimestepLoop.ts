export type CancelHandle = () => void;

export interface LoopOptions {
  tickRate: number;
  update: (dtMs: number) => void;
  render?: (interp: number) => void;
  requestFrame?: (cb: (time: number) => void) => CancelHandle;
  now?: () => number;
}

/**
 * Fixed-timestep simulation loop with decoupled rendering.
 * The simulation advances exactly `tickRate` ticks per second regardless of
 * display refresh rate; rendering interpolates without mutating sim state.
 */
export class FixedTimestepLoop {
  readonly tickRate: number;
  frameCount = 0;
  lastDeltaMs = 0;
  measuredFps = 0;

  private readonly update: (dtMs: number) => void;
  private readonly render: (interp: number) => void;
  private readonly requestFrame: (cb: (time: number) => void) => CancelHandle;
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly maxDeltaMs: number;

  private accumulator = 0;
  private previousTime = 0;
  private running = false;
  private paused = false;
  private cancelFrame: CancelHandle | null = null;
  private fpsFrames = 0;
  private fpsWindowStart = 0;

  constructor(opts: LoopOptions) {
    this.tickRate = opts.tickRate;
    this.tickMs = 1000 / opts.tickRate;
    this.maxDeltaMs = 1000;
    this.update = opts.update;
    this.render = opts.render ?? (() => {});
    this.requestFrame = opts.requestFrame ?? ((cb) => {
      const id = requestAnimationFrame(cb);
      return () => cancelAnimationFrame(id);
    });
    this.now = opts.now ?? (() => performance.now());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTime = this.now();
    this.fpsWindowStart = this.previousTime;
    const step = (time: number): void => {
      if (!this.running) return;
      this.tick(time);
      if (this.paused) {
        this.previousTime = this.now();
      }
      this.cancelFrame = this.requestFrame(step);
    };
    this.cancelFrame = this.requestFrame(step);
  }

  stop(): void {
    this.running = false;
    this.cancelFrame?.();
    this.cancelFrame = null;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.previousTime = this.now();
    this.accumulator = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Drives the loop deterministically; used for headless tests and replays. */
  advance(deltaMs: number): number {
    let ticks = 0;
    this.accumulator += deltaMs;
    const budgetLimit = this.maxDeltaMs * 4;
    if (this.accumulator > budgetLimit) this.accumulator = budgetLimit;
    while (this.accumulator >= this.tickMs - 1e-6) {
      this.update(this.tickMs);
      this.frameCount++;
      this.accumulator -= this.tickMs;
      ticks++;
    }
    this.render(this.accumulator / this.tickMs);
    return ticks;
  }

  private tick(time: number): number {
    let delta = time - this.previousTime;
    this.previousTime = time;
    if (delta > this.maxDeltaMs) delta = this.maxDeltaMs;
    this.lastDeltaMs = delta;
    let ticks = 0;
    this.accumulator += delta;
    while (this.accumulator >= this.tickMs - 1e-6) {
      this.update(this.tickMs);
      this.frameCount++;
      this.accumulator -= this.tickMs;
      ticks++;
    }
    this.render(this.accumulator / this.tickMs);
    this.trackFps(time);
    return ticks;
  }

  private trackFps(time: number): void {
    this.fpsFrames++;
    if (time - this.fpsWindowStart >= 500) {
      this.measuredFps = (this.fpsFrames * 1000) / (time - this.fpsWindowStart);
      this.fpsFrames = 0;
      this.fpsWindowStart = time;
    }
  }
}
