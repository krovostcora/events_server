// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// створюємо / відкриваємо файл бази даних
const db = new sqlite3.Database(path.resolve(__dirname, 'events.db'));

// ініціалізація таблиць
db.serialize(() => {
  // таблиця подій
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL,
                                        date TEXT NOT NULL,
                                        time TEXT,
                                        place TEXT,
                                        isRace INTEGER,
                                        ageLimit INTEGER,
                                        maxChildAge INTEGER,
                                        medicalRequired INTEGER,
                                        teamEvent INTEGER,
                                        genderRestriction TEXT,
                                        description TEXT
    )
  `);

  // таблиця учасників
  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
                                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                                              event_id INTEGER NOT NULL,
                                              name TEXT NOT NULL,
                                              surname TEXT NOT NULL,
                                              gender TEXT,
                                              age INTEGER,
                                              email TEXT,
                                              phone TEXT,
                                              raceRole TEXT,
                                              FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);

  // таблиця результатів
  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      raceId INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      time TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )
  `);
});

module.exports = db;
