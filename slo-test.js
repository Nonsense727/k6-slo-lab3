import http from 'k6/http';
import { check, sleep } from 'k6';

// SLO босгуудыг бодит суурь хэмжилт дээр тулгуурлан тогтоосон (20 VU, 1 мин):
//   cart    p95 = 1.29 ms  -> SLO p(95) < 200 ms (сагсанд нэмэх нь хурдан байх ёстой)
//   report  p95 = 391.9 ms -> SLO p(95) < 450 ms (код 200-400 мс унтдаг;
//          450 ms нь 20 VU ачаалалтай үеийн дараалалд ~15% нөөц үлдээнэ)
//   pay     алдааны хувь = 4.73% (сервер 5% алдаа суулгадаг) -> SLO rate < 8%
//   checks  амжилт = 98.42% -> SLO rate > 90% (availability)
export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    'http_req_duration{name:cart}': ['p(95)<200'],   // Performance SLO
    'http_req_duration{name:report}': ['p(95)<450'], // 4 дэх сценарио: report latency
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
