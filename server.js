
require("dotenv").config();
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");
const twilio = require("twilio");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "serviceflow.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  estimated_minutes INTEGER DEFAULT 60,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'scheduled',
  review_due_at TEXT,
  review_sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json());
app.use(express.static(__dirname));

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

async function sendSMS(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.log("DEMO SMS:", to, body);
    return { demo: true };
  }

  const client = twilio(sid, token);
  const msg = await client.messages.create({ to, from, body });
  return { demo: false, sid: msg.sid };
}

app.get("/api/jobs", (req, res) => {
  res.json(db.prepare("SELECT * FROM jobs ORDER BY scheduled_date, scheduled_time").all());
});

app.post("/api/jobs", (req, res) => {
  const b = req.body || {};
  if (!b.customerName || !b.phone || !b.address || !b.description || !b.scheduledDate || !b.scheduledTime) {
    return res.status(400).json({error:"Please fill out all required fields."});
  }
  const info = db.prepare(`
    INSERT INTO jobs(customer_name, phone, address, description, scheduled_date, scheduled_time, estimated_minutes, notes)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    b.customerName.trim(), b.phone.trim(), b.address.trim(), b.description.trim(),
    b.scheduledDate, b.scheduledTime, Number(b.estimatedMinutes || 60), b.notes || ""
  );
  res.json(db.prepare("SELECT * FROM jobs WHERE id=?").get(info.lastInsertRowid));
});

app.post("/api/jobs/:id/on-way", async (req, res) => {
  try {
    const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(req.params.id);
    if (!job) return res.status(404).json({error:"Job not found."});
    const eta = Math.max(1, Number(req.body?.etaMinutes || 20));
    const body = `Hi ${firstName(job.customer_name)}, this is ServiceFlow. Your technician is on the way and should arrive in about ${eta} minutes.`;
    const sent = await sendSMS(job.phone, body);
    db.prepare("UPDATE jobs SET status='onway' WHERE id=?").run(job.id);
    res.json({ok:true, sent});
  } catch (e) {
    console.error(e);
    res.status(500).json({error:"Could not send message."});
  }
});

app.post("/api/jobs/:id/arrived", async (req, res) => {
  try {
    const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(req.params.id);
    if (!job) return res.status(404).json({error:"Job not found."});
    const body = `Hi ${firstName(job.customer_name)}, your technician has arrived.`;
    const sent = await sendSMS(job.phone, body);
    db.prepare("UPDATE jobs SET status='arrived' WHERE id=?").run(job.id);
    res.json({ok:true, sent});
  } catch (e) {
    console.error(e);
    res.status(500).json({error:"Could not send message."});
  }
});

app.post("/api/jobs/:id/complete", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(req.params.id);
  if (!job) return res.status(404).json({error:"Job not found."});
  const due = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE jobs SET status='complete', review_due_at=? WHERE id=?").run(due, job.id);
  res.json({ok:true, reviewDueAt:due});
});

setInterval(async () => {
  const due = db.prepare(`
    SELECT * FROM jobs
    WHERE status='complete'
      AND review_due_at IS NOT NULL
      AND review_sent_at IS NULL
      AND review_due_at <= ?
    LIMIT 20
  `).all(new Date().toISOString());

  for (const job of due) {
    try {
      await sendSMS(job.phone, `Hi ${firstName(job.customer_name)}, thanks for choosing us today! If you were happy with the service, we'd really appreciate a review.`);
      db.prepare("UPDATE jobs SET review_sent_at=CURRENT_TIMESTAMP WHERE id=?").run(job.id);
    } catch (e) {
      console.error("Review send failed", job.id, e.message);
    }
  }
}, 60000);

app.use((req, res) => {
res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log(`ServiceFlow running on port ${PORT}`));
