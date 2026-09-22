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
## 6. k6 scripts

- `slo-test.js` - PASS variant. 20 VUs, 1 minute. Thresholds per tag:
  `http_req_duration{name:cart}` p(95)<200, `http_req_duration{name:report}` p(95)<450,
  `http_req_failed{name:pay}` rate<0.08, `checks` rate>0.90.
- `slo-test-fail.js` - FAIL variant. Same as above, but the report threshold is
  tightened to p(95)<100 to force a deterministic failure (the handler sleeps
  200-400 ms, so p95 is always >= 200 ms). The other thresholds keep their real
  SLO values so only the report line crosses.

The thresholds in the scripts are identical to the thresholds in the SLO table
above - the README numbers and the code numbers match exactly.

## 7. Results (full k6 text output)

Every number quoted below is taken verbatim from the files in `results/`.

### 7.1 PASS run - `results/pass.txt` (k6 exit code 0)

| Metric | Value | Gate | Result |
|---|---|---|---|
| http_req_duration{name:cart} p95 | 1.29 ms | < 200 ms | PASS |
| http_req_duration{name:report} p95 | 391.9 ms | < 450 ms | PASS |
| http_req_failed{name:pay} | 4.73% (44/930) | < 8% | PASS |
| checks (availability) | 98.42% (2746/2790) | > 90% | PASS |

Total requests: 2790 at 45.57 req/s. All four thresholds green, exit code 0.

### 7.2 Chaos run - `results/chaos.txt` (2 min, 10 s outage at t+60s)

| Metric | Value | Gate | Result |
|---|---|---|---|
| http_req_duration{name:cart} p95 | 1.33 ms | < 200 ms | PASS |
| http_req_duration{name:report} p95 | 390.08 ms | < 450 ms | PASS |
| http_req_failed{name:pay} | 17.13% (327/1908) | < 8% | FAIL |
| checks (availability) | 85.81% (4912/5724) | > 90% | FAIL |

During the outage k6 logged 729 "connection refused" warnings. The latency
thresholds stayed green because requests that actually reached the server were
served at normal speed - the failure mode was "no server", not "slow server".
k6 exit code 0 (threshold failure does not change the exit code here; see 7.3).

### 7.3 FAIL run - `results/fail.txt` (k6 exit code 99)

| Metric | Value | Gate | Result |
|---|---|---|---|
| http_req_duration{name:cart} p95 | 1.25 ms | < 200 ms | PASS |
| http_req_duration{name:report} p95 | 389.94 ms | < 100 ms | FAIL |
| http_req_failed{name:pay} | 5.35% (50/933) | < 8% | PASS |
| checks (availability) | 98.21% (2749/2799) | > 90% | PASS |

k6 printed `thresholds on metrics 'http_req_duration{name:report}' have been
crossed` and exited with code 99 (recorded at the bottom of `results/fail.txt`).
This is the mechanism a CI pipeline uses to block a build: the report line is
the only one that crossed, so the failure message points at the right metric.

### 7.4 Per-request availability measured during chaos

- Successful requests: 4912
- Total requests: 5724
- Availability = 4912 / 5724 = 85.81%
- Failed requests during outage: 729 connection-refused + the injected 5% 500s
- Server down time (measured): 10 s of the 120 s window = 8.3% of clock time

## 8. Chaos analysis

### Does the chaos run validate the availability SLO?

Partially, and that partial result is the whole point. On a clock-time basis the
10-second outage is 8.3% of the 2-minute window, which is inside the 12-second
error budget, so a clock-based check would call the SLO met. Measured per
request, availability is 85.81%, which is below the 90% gate, so the SLO is
actually breached. The two numbers disagree because k6's `checks` metric counts
per request, not per second. During the outage the 20 VUs keep firing at ~20
requests per second, so roughly 200 requests land in the 10-second hole - far
more than the 10/120 ratio would suggest. In other words, the error budget is a
time budget but the SLI is a request-weighted measure; a short, sharp outage
under a steady load consumes the budget much faster than the clock indicates.

### Why did the reliability threshold also fail?

When the server is down, every /pay request fails with connection-refused, so
the pay error rate jumped from ~5% to 17.13%. One outage therefore breaches
both the availability and the reliability SLO at the same time. The two SLIs can
be separated by measuring them on different populations: the availability SLI
should count every request (including connection-refused), while the
reliability SLI should only count requests that actually reached a live server -
i.e. filter out connection-refused and measure the 500 rate on the survivors.
That way a crash no longer pollutes the reliability number.

## 9. Conclusion

The hardest part of the scenario -> SLO -> threshold chain was choosing thresholds
that are both realistic and meaningful. A p95 < 200 ms gate on /cart/add is
technically trivial on localhost (measured 1.29 ms) and would never fire, yet it is
still worth writing down because it defines what "fast" means for that endpoint -
the value only becomes meaningful when the service is deployed somewhere with
real network latency. The chaos run confirmed the availability SLO is sensitive
to request-weighted measurement: a 10-second outage under 20 VUs drove
availability to 85.81%, below the 90% gate, even though the outage itself was
inside the 12-second clock-time error budget. The same outage also pushed the pay
error rate to 17.13%, proving that a single crash breaches availability and
reliability together. The two SLIs can be separated: the availability SLI should
count every request, including connection-refused, while the reliability SLI should
measure the 500 rate only on requests that actually reached a live server, so a crash
no longer pollutes the reliability number. The intentional FAIL run (report p95 <
100 ms) returned exit code 99 and named the crossed metric, which is exactly how a CI
quality gate blocks an unhealthy build. Finally, a k6 threshold is only as good as
the baseline it is derived from: every number in this report was measured on this
machine, and the chaos run is what proved the SLO is meaningful rather than
arbitrary.
