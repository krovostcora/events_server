const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('./db'); // твій db.js з підключенням до SQLite

const eventsDir = path.resolve(__dirname, 'events');

function migrateEvent(eventFolder) {
  const eventName = path.basename(eventFolder);
  const participantsPath = path.join(eventFolder, 'participants.csv');

  db.run(`INSERT INTO events (name) VALUES (?)`, [eventName], function(err) {
    if (err) throw err;
    const eventId = this.lastID;

    fs.createReadStream(participantsPath)
      .pipe(csv())
      .on('data', row => {
        db.run(
          `INSERT INTO participants (event_id, name, email) VALUES (?, ?, ?)`,
          [eventId, row.name, row.email]
        );
      })
      .on('end', () => {
        console.log(`✅ Міграція завершена для події: ${eventName}`);
      });
  });
}

fs.readdirSync(eventsDir).forEach(eventFolder => {
  const fullPath = path.join(eventsDir, eventFolder);
  if (fs.lstatSync(fullPath).isDirectory()) {
    migrateEvent(fullPath);
  }
});
