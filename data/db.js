const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'events.sqlite'));
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  folder TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  place TEXT,
  is_race INTEGER NOT NULL DEFAULT 0,
  age_limit TEXT,
  max_child_age INTEGER,
  medical_required INTEGER DEFAULT 0,
  team_event INTEGER DEFAULT 0,
  gender_restriction TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT,
  surname TEXT,
  gender TEXT,
  age INTEGER,
  email TEXT,
  phone TEXT,
  race_role TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);

CREATE TABLE IF NOT EXISTS results (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     event_id TEXT NOT NULL,
                                     date TEXT NOT NULL,
                                     race_id INTEGER NOT NULL,
                                     participant_id TEXT NOT NULL,
                                     time TEXT NOT NULL,
                                     FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_results_event_date ON results(event_id, date);
`);

module.exports = db;
