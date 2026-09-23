import http from 'k6/http';
import { check, sleep } from 'k6';

// CI дээр Quality Gate ажиллаж байгааг батлах зориудын FAIL хувилбар.
// Зөвхөн /report-ийн босгыг зориудаар p(95)<100 ms болгон чангаруулсан.
// Сервер 200-400 мс унтдаг тул p95 нь үргэлж >= 200 мс байх бөгөөд энэ босго
// ямар ч машин дээр заавал FAIL болж, 0-ээс өөр exit code буцаана.
// Бусад босгууд бодит SLO утгаа хадгалах тул зөвхөн report босго давж,
// алдааны мэдэгдэл нь зөв хэмжүүрийг заана.
export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    'http_req_duration{name:cart}': ['p(95)<200'],   // PASS: cart p95 ~1.25 ms
    'http_req_duration{name:report}': ['p(95)<100'], // FAIL: report p95 ~390 ms
    'http_req_failed{name:pay}': ['rate<0.08'],      // PASS: ~5.35% < 8%
    'checks': ['rate>0.90'],                         // PASS: ~98.21% > 90%
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
