import test from "node:test";
import assert from "node:assert/strict";
import type { AxiosInstance } from "axios";
import { evaluateRankingEligibility } from "../eligibility";
import { cautiousNameMatch, sameRaceResultsIndicateDistinctRunner } from "../runnerMatching";
import { RunSignupClient, RunSignupApiError } from "./client";
import { deduplicateSourceResults, hasNextPage, mapRunSignupResult, parseRunSignupIdentifier, selectPublicResults } from "./ingestion";

test("eligibility accepts fixed 50k and rejects shorter, timed, relay and virtual events", () => {
  assert.equal(evaluateRankingEligibility({ distance: 50, distanceUnits: "K", name: "Trail 50K" }).eligible, true);
  assert.equal(evaluateRankingEligibility({ distance: "100 Miles", name: "Trail 100 Miler" }).normalizedDistanceKm, 160.9344);
  assert.equal(evaluateRankingEligibility({ distance: 49.9, distanceUnits: "K" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: 5000, distanceUnits: "Meters", name: "5000 Metre" }).normalizedDistanceKm, 5);
  assert.equal(evaluateRankingEligibility({ distance: 5000, distanceUnits: "Meters", name: "5000 Metre" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: "5000m", name: "Road 5K" }).normalizedDistanceKm, 5);
  assert.equal(evaluateRankingEligibility({ distance: 50, distanceUnits: "M", name: "50 Mile" }).normalizedDistanceKm, 80.4672);
  assert.equal(evaluateRankingEligibility({ distance: 5000, distanceUnits: "m", name: "Road 5K" }).normalizedDistanceKm, 5);
  assert.equal(evaluateRankingEligibility({ distance: 50, name: "Ambiguous race" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: "10000m", name: "Road 10K" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: "1325m", name: "Trunk Island Swim" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: "100K", eventType: "bike_race", requireRunningEventType: true }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: "100K", eventType: "ultra", requireRunningEventType: true }).eligible, true);
  assert.equal(evaluateRankingEligibility({ distance: "100K", eventType: null, requireRunningEventType: true }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: 100, distanceUnits: "K", name: "24 Hour" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: 50, distanceUnits: "K", eventType: "virtual_race" }).eligible, false);
  assert.equal(evaluateRankingEligibility({ distance: 50, distanceUnits: "K", name: "Relay" }).eligible, false);
});

test("race URL and compound identifiers parse race and event IDs", () => {
  assert.deepEqual(parseRunSignupIdentifier("123:456"), { raceId: "123", eventId: "456" });
  assert.deepEqual(parseRunSignupIdentifier("https://runsignup.com/Race/123?eventId=456"), { raceId: "123", eventId: "456" });
});

test("runner matching normalizes accents and only fuzzes with birth-year evidence", () => {
  assert.equal(cautiousNameMatch("José O'Neil", "Jose O Neil", false), true);
  assert.equal(cautiousNameMatch("Jonathan Smith", "Jonathon Smith", true), true);
  assert.equal(cautiousNameMatch("Jonathan Smith", "Jonathon Smith", false), false);
});

test("same-race name collisions are separated by finish time or stable ID", () => {
  assert.equal(sameRaceResultsIndicateDistinctRunner(2436, 2725), true);
  assert.equal(sameRaceResultsIndicateDistinctRunner(2436, 2436), false);
  assert.equal(sameRaceResultsIndicateDistinctRunner(null, null, "runner-a", "runner-b"), true);
});

test("authentication uses the v2 secret header and never sends the secret as a query parameter", async () => {
  let config: any;
  const http = { get: async (_path: string, supplied: unknown) => { config = supplied; return { data: { races: [] } }; } } as unknown as AxiosInstance;
  const client = new RunSignupClient({ apiKey: "key", apiSecret: "secret", requestDelayMs: 100, http });
  await client.getRaces({ page: 1 });
  assert.equal(config.params.rsu_api_key, "key");
  assert.equal(config.params.api_secret, undefined);
  assert.equal(config.headers["X-RSU-API-SECRET"], "secret");
});

test("permanent API failures stop without an uncontrolled retry loop", async () => {
  let calls = 0;
  const http = { get: async () => { calls++; throw { response: { status: 400, headers: {} } }; } } as unknown as AxiosInstance;
  const client = new RunSignupClient({ apiKey: "key", apiSecret: "secret", requestDelayMs: 100, maxRetries: 5, http });
  await assert.rejects(() => client.getRaces({}), RunSignupApiError);
  assert.equal(calls, 1);
});

test("HTTP 200 API error envelopes are rejected", async () => {
  const http = { get: async () => ({ status: 200, data: { error: { error_code: 6, error_msg: "Key authentication failed" } } }) } as unknown as AxiosInstance;
  const client = new RunSignupClient({ apiKey: "key", apiSecret: "secret", requestDelayMs: 100, http });
  await assert.rejects(() => client.getRaces({}), /Key authentication failed/);
});

test("API Caller authentication uses rsu_api_reg and the caller-secret header", async () => {
  let config: any;
  const http = { get: async (_path: string, supplied: unknown) => { config = supplied; return { data: {} }; } } as unknown as AxiosInstance;
  const client = new RunSignupClient({ apiKey: "caller", apiSecret: "password", authMode: "caller", requestDelayMs: 100, http });
  await client.getRaces({ page: 1 });
  assert.equal(config.params.rsu_api_reg, "caller");
  assert.equal(config.params.rsu_api_key, undefined);
  assert.equal(config.headers["X-RSU-API-REG-SECRET"], "password");
});

test("multiple result sets select public overall results without duplicate age-group rows", () => {
  const overall = [{ result_id: 1 }, { result_id: 2 }];
  const selected = selectPublicResults({ individual_results_sets: [
    { individual_result_set_name: "Age Group", public_results: "T", results: [{ result_id: 1 }] },
    { individual_result_set_name: "Overall Results", public_results: "T", results: overall },
  ] });
  assert.deepEqual(selected, overall);
});

test("pagination continues only after a full page", () => {
  assert.equal(hasNextPage(1000, 1000), true);
  assert.equal(hasNextPage(999, 1000), false);
});

test("missing optional fields are accepted but a missing name is rejected", () => {
  assert.equal(mapRunSignupResult({ result_id: 1 }), null);
  assert.equal(mapRunSignupResult({ result_id: 1, first_name: "Anonymous", last_name: "Anonymous" }), null);
  assert.deepEqual(mapRunSignupResult({ result_id: 2, first_name: "Ada", last_name: "Runner" })?.runnerName, "Ada Runner");
});

test("source result IDs make repeated input idempotent", () => {
  const duplicate = { runnerName: "Ada Runner", sourceResultId: "99" };
  assert.equal(deduplicateSourceResults([duplicate, duplicate]).length, 1);
});

test("incremental result calls send the saved modified timestamp", async () => {
  let config: any;
  const http = { get: async (_path: string, supplied: unknown) => { config = supplied; return { data: {} }; } } as unknown as AxiosInstance;
  const client = new RunSignupClient({ apiKey: "key", apiSecret: "secret", requestDelayMs: 100, http });
  await client.getResults("1", "2", 1, 123456);
  assert.equal(config.params.modified_after_timestamp, 123456);
});

test("client never exceeds the documented two-request concurrency ceiling", async () => {
  let active = 0;
  let peak = 0;
  const http = { get: async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 250));
    active--;
    return { data: {} };
  } } as unknown as AxiosInstance;
  const client = new RunSignupClient({ apiKey: "key", apiSecret: "secret", requestDelayMs: 100, maxConcurrency: 99, http });
  await Promise.all(Array.from({ length: 6 }, () => client.getRaces({})));
  assert.equal(peak, 2);
});
