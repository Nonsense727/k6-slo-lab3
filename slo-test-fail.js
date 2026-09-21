import http from 'k6/http';
import { check, sleep } from 'k6';

// FAIL variant used to prove the Quality Gate works in CI.
// Only the /report threshold is intentionally tightened to p(95)<100 ms.
// The server handler sleeps 200-400 ms, so p95 is always >= 200 ms and this
// threshold ALWAYS fails on any machine -> reliable FAIL + non-zero exit code.
// The other thresholds keep their real SLO values, so only the report line
// crosses and the failure message points at the right metric.
export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    'http_req_duration{name:cart}': ['p(95)<200'],   // PASS: cart p95 ~1.5 ms
    'http_req_duration{name:report}': ['p(95)<100'], // FAIL: report p95 ~392 ms
    'http_req_failed{name:pay}': ['rate<0.08'],      // PASS: ~5.5% < 8%
    'checks': ['rate>0.90'],                         // PASS: ~98.7% > 90%
  },
};

export default function () {
  const base = 'http://localhost:3000';

  const c = http.post(`${base}/cart/add`, null, { tags: { name: 'cart' } });
  const r = http.get(`${base}/report`, { tags: { name: 'report' } });
  const p = http.post(`${base}/pay`, null, { tags: { name: 'pay' } });

  check(c, { 'cart 200': (x) => x.status === 200 });
  check(r, { 'report 200': (x) => x.status === 200 });
  check(p, { 'pay 200': (x) => x.status === 200 });

  sleep(1);
}