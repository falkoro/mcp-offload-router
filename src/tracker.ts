export interface ProviderLimits {
  rpm: number;
  tpm: number;
  dailyTokens: number;
  cooldownSeconds: number;
}

export interface ProviderState {
  requestTimestamps: number[];
  tokenEntries: { timestamp: number; tokens: number }[];
  tokensToday: number;
  dayStart: number;
  rateLimitedUntil: number;
}

function validateLimits(name: string, limits: ProviderLimits): void {
  const fields: (keyof ProviderLimits)[] = ["rpm", "tpm", "dailyTokens", "cooldownSeconds"];
  for (const field of fields) {
    if (!Number.isFinite(limits[field]) || limits[field] < 0) {
      throw new Error(`Invalid ${field} for provider ${name}: ${limits[field]}`);
    }
  }
}

export interface UsageTrackerOptions {
  onUsage?: (provider: string, tokensUsed: number, timestamp: number) => void;
}

export class UsageTracker {
  private states: Map<string, ProviderState>;
  private limits: Map<string, ProviderLimits>;
  private onUsage?: UsageTrackerOptions["onUsage"];

  constructor(
    providers: Record<string, ProviderLimits>,
    options: UsageTrackerOptions = {}
  ) {
    this.states = new Map();
    this.limits = new Map();
    this.onUsage = options.onUsage;
    const now = Date.now();
    for (const [name, limits] of Object.entries(providers)) {
      validateLimits(name, limits);
      this.limits.set(name, limits);
      this.states.set(name, {
        requestTimestamps: [],
        tokenEntries: [],
        tokensToday: 0,
        dayStart: now,
        rateLimitedUntil: 0,
      });
    }
  }

  private getState(name: string): ProviderState {
    const state = this.states.get(name);
    if (!state) throw new Error(`Unknown provider: ${name}`);
    return state;
  }

  private getLimits(name: string): ProviderLimits {
    const limits = this.limits.get(name);
    if (!limits) throw new Error(`Unknown provider: ${name}`);
    return limits;
  }

  private prune(state: ProviderState, now: number): void {
    const oneMinuteAgo = now - 60_000;
    state.requestTimestamps = state.requestTimestamps.filter((t) => t > oneMinuteAgo);
    state.tokenEntries = state.tokenEntries.filter((t) => t.timestamp > oneMinuteAgo);

    if (now - state.dayStart > 24 * 60 * 60 * 1000) {
      state.tokensToday = 0;
      state.dayStart = now;
    }
  }

  isAvailable(name: string, now: number = Date.now()): boolean {
    const state = this.getState(name);
    const limits = this.getLimits(name);
    this.prune(state, now);

    if (state.rateLimitedUntil > now) return false;
    if (state.requestTimestamps.length >= limits.rpm) return false;
    if (state.tokenEntries.reduce((sum, e) => sum + e.tokens, 0) >= limits.tpm) return false;
    if (state.tokensToday >= limits.dailyTokens) return false;
    return true;
  }

  recordUsage(name: string, tokensUsed: number, now: number = Date.now()): void {
    if (!Number.isFinite(tokensUsed) || tokensUsed < 0) {
      throw new Error(`Invalid token usage for provider ${name}: ${tokensUsed}`);
    }
    const state = this.getState(name);
    this.prune(state, now);
    state.requestTimestamps.push(now);
    state.tokenEntries.push({ timestamp: now, tokens: tokensUsed });
    state.tokensToday += tokensUsed;
    this.onUsage?.(name, tokensUsed, now);
  }

  markRateLimited(name: string, now: number = Date.now()): void {
    const state = this.getState(name);
    const limits = this.getLimits(name);
    state.rateLimitedUntil = now + limits.cooldownSeconds * 1000;
  }

  getRetryAfter(name: string, now: number = Date.now()): number {
    const state = this.getState(name);
    const remaining = state.rateLimitedUntil - now;
    return Math.max(0, Math.ceil(remaining / 1000));
  }
}
