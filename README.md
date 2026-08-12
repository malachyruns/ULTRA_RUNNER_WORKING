# UltraRanker
Repository for https://replit.com/@SamuelMSG/Ultra-Ranker

## RunSignup synchronization

Apply `lib/db/migrations/0001_runsignup_ingestion.sql`, then configure the API server:

```dotenv
RUNSIGNUP_API_KEY=your_v2_api_key
RUNSIGNUP_API_SECRET=your_v2_api_secret
RUNSIGNUP_AUTH_MODE=v2
RUNSIGNUP_REQUEST_DELAY_MS=1000
RUNSIGNUP_MAX_CONCURRENCY=2
RUNSIGNUP_MAX_RETRIES=5
# Optional for testing against another RunSignup environment:
RUNSIGNUP_API_BASE_URL=https://api.runsignup.com/rest
```

Use `RUNSIGNUP_AUTH_MODE=caller` for API Caller credentials (`rsu_api_reg` /
`X-RSU-API-REG-SECRET`) or `legacy` only for legacy query-parameter credentials.

Credentials stay on the API server. The organizer portal can import a RunSignup race URL/ID,
start a historical public-results sync, or run an incremental sync. Only individual,
fixed-distance events of at least 50 km are eligible. Jobs and checkpoints are stored in
PostgreSQL and may be paused and resumed.

`RUNSIGNUP_MAX_CONCURRENCY` is hard-capped at 2 in the API client, even if a
higher value is configured. Historical imports cache race metadata, batch database
writes, and recalculate global ranks once after the job completes. Lower
`RUNSIGNUP_REQUEST_DELAY_MS` only changes the spacing between request starts; it
does not bypass the two-request ceiling.
