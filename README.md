# Lab 3: SLO k6 threshold

## Student info

- Name: Amarmend Tuvshinbayr
- Student code: B222270036
- GitHub: Nonsense727

## 1. Environment and tool versions

- OS: Ubuntu Linux (x86_64)
- Node.js: v22.22.3 / npm 10.9.8 / Express 5.2.1
- k6: v2.2.0 (commit/00a9a1b7f5, go1.26.5, linux/amd64)

## 2. Ethics

All load tests in this lab run exclusively against the local API at http://localhost:3000 (own machine). No load testing was performed against any third-party server.

## 3. Local API (server.js)

Three endpoints, each with a different behaviour:

- POST /cart/add - fast, returns immediately (200)
- GET /report - slow, sleeps 200-400 ms before responding (200)
- POST /pay - unreliable, ~5% of requests return HTTP 500 "gateway timeout"

## 4. Scenarios (6-part format)

### Scenario 1 - Performance

- Summary: Under a steady load the /cart/add endpoint must answer fast enough that a shopper never perceives a lag when adding an item to the cart.
- System state: 20 VUs running for 1 minute, each iteration posts to /cart/add then sleeps 1s.
- Environment: localhost:3000, Node.js/Express, no other load on the machine.
- External disturbance: none - only the k6 load itself.
- Required response: HTTP 200 with {"ok":true,"items":1}.
- Metric: p95 of http_req_duration tagged name=cart.

### Scenario 2 - Reliability

- Summary: The /pay endpoint fails (HTTP 500) on ~5% of requests by design; a real payment gateway must not be worse than that, so the failure rate must stay below a realistic bound.
- System state: 20 VUs for 1 minute, each iteration posts to /pay then sleeps 1s.
- Environment: localhost:3000, the payment handler randomly returns 500 on 5% of calls.
- External disturbance: none.
- Required response: HTTP 200 {"paid":true}; HTTP 500 is the injected fault.
- Metric: error rate of http_req_failed tagged name=pay (POFOD).

### Scenario 3 - Availability

- Summary: If the server crashes and is restarted, what fraction of requests still succeed, and how long is the downtime?
- System state: 20 VUs for 2 minutes; the server is killed for 10 seconds at t+60s and then restarted.
- Environment: localhost:3000, the server process is SIGTERM'd and relaunched with node server.js.
- External disturbance: the 10-second outage is the injected chaos.
- Required response: a successful HTTP response (200) counts as available; connection-refused and 500 count as unavailable.
- Metric: availability = successful requests / total requests, plus the measured recovery time.

### Scenario 4 - Report latency (added threshold)

- Summary: The /report endpoint must stay responsive even though it intentionally sleeps 200-400 ms.
- System state: 20 VUs for 1 minute, each iteration also calls GET /report.
- Environment: localhost:3000, handler sleeps 200-400 ms.
- External disturbance: none.
- Required response: HTTP 200 with {"rows":20000}.
- Metric: p95 of http_req_duration tagged name=report.

## 5. SLO table

| Scenario | SLI (what is measured) | Threshold | Window / condition |
|---|---|---|---|
| Performance | /cart/add latency | p95 < 200 ms | 20 VU steady, 1 min |
| Reliability | /pay error rate | < 8% | 1 min, 20 VU |
| Availability | share of successful requests | >= 90% | 2 min, 10 s outage inside |
| Report latency | /report latency | p95 < 450 ms | 20 VU steady, 1 min |

### Why these thresholds

- p95 < 200 ms for /cart/add: the measured baseline p95 was 1.5 ms. The handler returns immediately, so even with 20 VUs queueing the p95 stays around 1-2 ms. A 200 ms gate is generous enough to never fire on this machine while still catching a genuinely slow cart service.
- p95 < 450 ms for /report: the handler sleeps 200-400 ms, so the measured p95 was 392 ms. The 450 ms gate leaves ~15% headroom above the measured p95 for request queueing under 20 VUs, and it is still far below the 1-second mark a user would notice.
- < 8% for /pay: the server injects 5% errors, and the measured error rate was 5.5%. An 8% gate accepts the injected fault plus normal variance; anything above it means the payment path is worse than designed.
- >= 90% for availability: measured success in the healthy run was 98.4%. A 90% gate tolerates a short outage while still requiring the service to be up the vast majority of the time.

### Error budget

With an availability SLO of 90% over a 2-minute window, the allowed downtime is 10% of 120 s = 12 seconds. That is the "budget" of time the service may be unavailable inside the window. In the chaos run the server was actually down for 10 seconds, i.e. within the budget on a time basis. The measured availability was still only 85.81%, below the 90% gate. The reason is explained in section 8: the budget is counted by clock time, but the impact is counted per request, and during the outage far more requests land in the down window than the clock ratio suggests.
