import http from 'k6/http';
import { check, sleep } from 'k6';

// SLO thresholds are derived from the real baseline measurement (20 VU, 1 min):
//   cart    p95 = 1.5 ms   -> SLO p(95) < 200 ms  (cart add must stay fast)
//   report  p95 = 392.3 ms -> SLO p(95) < 450 ms  (handler sleeps 200-400 ms;
//          450 ms leaves ~15% headroom above measured p95 for queueing under 20 VU)
//   pay     error rate = 5.47% (server injects 5% errors) -> SLO rate < 8%
//   checks  success = 98.7% -> SLO rate > 90% (availability)
export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    'http_req_duration{name:cart}': ['p(95)<200'],   // Performance SLO
    'http_req_duration{name:report}': ['p(95)<450'], // 4th scenario: report latency
    'http_req_failed{name:pay}': ['rate<0.08'],      // Reliability SLO
    'checks': ['rate>0.90'],                         // Availability SLO
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