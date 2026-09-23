const express = require('express');

const app = express();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1) Хурдан endpoint --- сагсанд нэмэх
app.post('/cart/add', (req, res) => res.json({ ok: true, items: 1 }));

// 2) Удаан endpoint --- тайлан (200-400мс санамсаргүй)
app.get('/report', async (req, res) => {
  await sleep(200 + Math.random() * 200);
  res.json({ rows: 20000 });
});

// 3) Найдваргүй endpoint --- төлбөр (хүсэлтийн ~5% нь 500 алдаа)
app.post('/pay', (req, res) => {
  if (Math.random() < 0.05) return res.status(500).json({ error: 'gateway timeout' });
  res.json({ paid: true });
});

app.listen(3000, () => console.log('API: http://localhost:3000'));
