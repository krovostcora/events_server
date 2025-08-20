const fs = require('fs');
const path = require('path');
const db = require('./data/db');

const EVENTS_DIR = path.join(__dirname, 'events');

function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    const [headerLine, ...lines] = content.split('\n');
    const headers = headerLine.split(';').map(h => h.trim());
    return lines.map(line => {
        const values = line.split(';').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] ?? '';
        });
        return obj;
    });
}

function importEvent(folder) {
    const folderPath = path.join(EVENTS_DIR, folder);
    const files = fs.readdirSync(folderPath);

    const eventFile = files.find(f => f.endsWith('.csv') && f !== 'participants.csv' && f !== 'results.csv');
    if (!eventFile) return;

    const eventCSV = parseCSV(path.join(folderPath, eventFile));
    if (!eventCSV.length) return;
    const e = eventCSV[0];

    // вставка в events
    try {
        db.prepare(`
      INSERT OR IGNORE INTO events (
        id, folder, name, date, time, place, is_race, age_limit, max_child_age,
        medical_required, team_event, gender_restriction, description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            e.id,
            folder,
            e.name,
            e.date,
            e.time || null,
            e.place || null,
            e.isRace && e.isRace.toLowerCase() === 'true' ? 1 : 0,
            e.ageLimit || null,
            e.maxChildAge ? Number(e.maxChildAge) : null,
            e.medicalRequired && e.medicalRequired.toLowerCase() === 'yes' ? 1 : 0,
            e.teamEvent && e.teamEvent.toLowerCase() === 'yes' ? 1 : 0,
            e.genderRestriction || null,
            e.description || null
        );
        console.log(`Імпортовано подію: ${e.name}`);
    } catch (err) {
        console.error('Помилка імпорту події:', err.message);
    }

    // учасники
    const participantsPath = path.join(folderPath, 'participants.csv');
    if (fs.existsSync(participantsPath)) {
        const participants = parseCSV(participantsPath);
        const insertP = db.prepare(`
      INSERT OR IGNORE INTO participants
      (id, event_id, name, surname, gender, age, email, phone, race_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        for (const p of participants) {
            insertP.run(
                p.id,
                e.id,
                p.name,
                p.surname,
                p.gender,
                p.age ? Number(p.age) : null,
                p.email,
                p.phone,
                p.raceRole
            );
        }
        console.log(`Імпортовано учасників: ${participants.length}`);
    }

    // результати
    const resultsPath = path.join(folderPath, 'results.csv');
    if (fs.existsSync(resultsPath)) {
        const results = parseCSV(resultsPath);
        const insertR = db.prepare(`
      INSERT INTO results (event_id, date, race_id, participant_id, time)
      VALUES (?, ?, ?, ?, ?)
    `);
        let currentRace = 0;
        let lastDate = null;
        for (const r of results) {
            insertR.run(
                e.id,
                r.date,
                1,
                r.id,
                r.time
            );
        }
        console.log(`Імпортовано результати: ${results.length}`);
    }
}

function main() {
    if (!fs.existsSync(EVENTS_DIR)) {
        console.error('Папка events/ не знайдена');
        process.exit(1);
    }

    const folders = fs.readdirSync(EVENTS_DIR).filter(f => {
        const full = path.join(EVENTS_DIR, f);
        return fs.existsSync(full) && fs.lstatSync(full).isDirectory();
    });
    for (const folder of folders) {
        importEvent(folder);
    }

    console.log('Імпорт завершено.');
}

main();
