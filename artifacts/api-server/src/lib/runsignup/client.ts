import axios, { type AxiosInstance, type AxiosError } from "axios";

export interface RunSignupClientOptions {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  requestDelayMs?: number;
  maxRetries?: number;
  maxConcurrency?: number;
  http?: AxiosInstance;
  authMode?: "v2" | "caller" | "legacy";
}

export class RunSignupApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class RunSignupClient {
  private readonly http: AxiosInstance;
  private readonly key: string;
  private readonly secret: string;
  private readonly authMode: "v2" | "caller" | "legacy";
  private readonly delay: number;
  private readonly retries: number;
  private nextRequestAt = 0;
  private throttleQueue: Promise<void> = Promise.resolve();
  private readonly maxConcurrency: number;
  private activeRequests = 0;
  private readonly slotWaiters: Array<() => void> = [];

  constructor(options: RunSignupClientOptions = {}) {
    this.key = options.apiKey ?? process.env.RUNSIGNUP_API_KEY ?? "";
    const secret = options.apiSecret ?? process.env.RUNSIGNUP_API_SECRET ?? "";
    if (!this.key || !secret) throw new Error("RUNSIGNUP_API_KEY and RUNSIGNUP_API_SECRET are required");
    this.delay = Math.max(100, options.requestDelayMs ?? Number(process.env.RUNSIGNUP_REQUEST_DELAY_MS ?? 1000));
    this.secret = secret;
    this.authMode = options.authMode ?? (process.env.RUNSIGNUP_AUTH_MODE as "v2" | "caller" | "legacy" | undefined) ?? "v2";
    if (!["v2", "caller", "legacy"].includes(this.authMode)) throw new Error("RUNSIGNUP_AUTH_MODE must be v2, caller, or legacy");
    this.retries = Math.min(8, Math.max(0, options.maxRetries ?? Number(process.env.RUNSIGNUP_MAX_RETRIES ?? 5)));
    const configuredConcurrency = options.maxConcurrency ?? Number(process.env.RUNSIGNUP_MAX_CONCURRENCY ?? 2);
    this.maxConcurrency = Math.min(2, Math.max(1, Number.isFinite(configuredConcurrency) ? Math.floor(configuredConcurrency) : 2));
    this.http = options.http ?? axios.create({
      baseURL: options.baseUrl ?? process.env.RUNSIGNUP_API_BASE_URL ?? "https://api.runsignup.com/rest",
      timeout: 30_000,
      headers: { "X-RSU-API-SECRET": secret, Accept: "application/json" },
    });
  }

  private async acquireSlot() {
    if (this.activeRequests >= this.maxConcurrency) {
      await new Promise<void>(resolve => this.slotWaiters.push(resolve));
    }
    this.activeRequests++;
  }

  private releaseSlot() {
    this.activeRequests--;
    this.slotWaiters.shift()?.();
  }

  private async throttle() {
    const turn = this.throttleQueue.then(async () => {
      const wait = Math.max(0, this.nextRequestAt - Date.now());
      if (wait > 0) await sleep(wait);
      this.nextRequestAt = Date.now() + this.delay;
    });
    this.throttleQueue = turn.catch(() => undefined);
    await turn;
  }

  async get<T = unknown>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      await this.acquireSlot();
      let slotReleased = false;
      try {
        const auth = this.authMode === "caller"
          ? { headers: { "X-RSU-API-REG-SECRET": this.secret }, params: { rsu_api_reg: this.key } }
          : this.authMode === "legacy"
            ? { headers: {}, params: { api_key: this.key, api_secret: this.secret } }
            : { headers: { "X-RSU-API-SECRET": this.secret }, params: { rsu_api_key: this.key } };
        const response = await this.http.get<T>(path, { headers: auth.headers, params: { format: "json", ...auth.params, ...params } });
        const payload = response.data as unknown;
        if (payload && typeof payload === "object" && "error" in payload) {
          const error = (payload as { error?: unknown }).error;
          const detail = error && typeof error === "object"
            ? String((error as { error_msg?: unknown }).error_msg ?? "API error")
            : String(error ?? "API error");
          throw new RunSignupApiError(`RunSignup API error: ${detail}`, response.status);
        }
        return response.data;
      } catch (error) {
        this.releaseSlot();
        slotReleased = true;
        if (error instanceof RunSignupApiError) throw error;
        const err = error as AxiosError;
        const status = err.response?.status;
        const temporary = status === 429 || status === 408 || (status != null && status >= 500);
        if (!temporary || attempt >= this.retries) {
          throw new RunSignupApiError(`RunSignup request failed (${status ?? "network"})`, status);
        }
        const retryAfter = Number(err.response?.headers?.["retry-after"]);
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(60_000, 1000 * 2 ** attempt + Math.floor(Math.random() * 250));
        await sleep(backoff);
      } finally {
        if (!slotReleased) this.releaseSlot();
      }
    }
  }

  getRaces(params: Record<string, unknown>) { return this.get<Record<string, unknown>>("/races", params); }
  getRace(raceId: string) { return this.get<Record<string, unknown>>(`/race/${raceId}`, { events: "T", include_event_days: "T" }); }
  getUpdatedPublicResultSets(page: number, modifiedSince?: number) {
    return this.get<Record<string, unknown>>("/v2/results/updated-result-sets.json", {
      page, num_per_page: 1000, ...(modifiedSince ? { modified_since_timestamp: modifiedSince } : {}),
    });
  }
  getResults(raceId: string, eventId: string, page: number, modifiedAfter?: number) {
    return this.get<Record<string, unknown>>(`/race/${raceId}/results/get-results`, {
      event_id: eventId, page, results_per_page: 1000, include_total_finishers: "T",
      supports_nb: "T", ...(modifiedAfter ? { modified_after_timestamp: modifiedAfter } : {}),
    });
  }
}
