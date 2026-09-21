const express = require('express');

const app = express();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1) Fast endpoint --- add to cart
app.post('/cart/add', (req, res) => res.json({ ok: true, items: 1 }));

// 2) Slow endpoint --- report (200-400ms random)
app.get('/report', async (req, res) => {
  await sleep(200 + Math.random() * 200);
  res.json({ rows: 20000 });
});

// 3) Unreliable endpoint --- payment (~5% of requests return 500)
app.post('/pay', (req, res) => {
  if (Math.random() < 0.05) return res.status(500).json({ error: 'gateway timeout' });
  res.json({ paid: true });
});

app.listen(3000, () => console.log('API: http://localhost:3000'));