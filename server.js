// server.js
const express = require("express");
const app = express();

// Use Railway's assigned port or fallback to 8080 locally
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// init DB
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

// Helper: get current count
function getCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS cnt FROM visitors', (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  });
}

// API endpoint: record visit and return current count
// A GET is fine here since it has no body and is idempotent for repeat visits per browser.
app.get('/api/visit', async (req, res) => {
  try {
    const cookieName = 'visitorId';
    let visitorId = req.cookies[cookieName];

    if (!visitorId) {
      // first time for this browser -- generate a UUID and record it
      visitorId = crypto.randomUUID ? crypto.randomUUID() : crypto.createHash('sha256').update(Date.now() + Math.random().toString()).digest('hex');

      db.run('INSERT OR IGNORE INTO visitors (visitor_id) VALUES (?)', [visitorId], function(err) {
        if (err) {
          console.error('DB insert error:', err);
        }
      });

      // set cookie, httpOnly, long expiry (1 year)
      res.cookie(cookieName, visitorId, {
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year
      });

      // after insertion, fetch updated count
      const cnt = await getCount();
      res.json({ count: cnt, counted: true });
    } else {
      // cookie present -> do not increment; just return current count
      const cnt = await getCount();
      res.json({ count: cnt, counted: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Optional endpoint to get count without trying to set visitor cookie:
app.get('/api/count', async (req, res) => {
  try {
    const cnt = await getCount();
    res.json({ count: cnt });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

