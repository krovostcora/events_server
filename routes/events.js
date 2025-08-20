const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../data/db');

const router = express.Router();

const EVENTS_DIR = path.join(__dirname, '..', 'events');
if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

function toBool(x) {
    if (typeof x === 'boolean') return x;
    if (typeof x === 'number') return x !== 0;
    if (typeof x === 'string') return x.toLowerCase() === 'true' || x.toLowerCase() === 'yes' || x === '1';
    return false;
}

function logoUrl(req, folder) {
    const base = `${req.protocol}://${req.get('host')}`;
    const file = path.join(EVENTS_DIR, folder, 'logo.png');
    return fs.existsSync(file) ? `${base}/static/${folder}/logo.png` : null;
}

function getEventByFolder(folder) {
    return db.prepare('SELECT * FROM events WHERE folder = ?').get(folder);
}

function ensureEventFolder(folder) {
    const p = path.join(EVENTS_DIR, folder);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
}

router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT folder AS id, name, date, folder FROM events ORDER BY date ASC').all();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read events' });
    }
});

router.get('/:id', (req, res) => {
    try {
        const folder = req.params.id;
        const ev = getEventByFolder(folder);
        if (!ev) return res.status(404).json({ error: 'Event not found' });
        res.json({
            id: ev.id,
            name: ev.name,
            date: ev.date,
            time: ev.time,
            place: ev.place,
            isRace: !!ev.is_race,
            ageLimit: ev.age_limit,
            maxChildAge: ev.max_child_age,
            medicalRequired: !!ev.medical_required,
            teamEvent: !!ev.team_event,
            genderRestriction: ev.gender_restriction,
            description: ev.description,
            logo: logoUrl(req, ev.folder),
            folder: ev.folder
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', (req, res) => {
    const {
        id,
        date,
        name,
        isRace,
        time,
        place,
        ageLimit,
        maxChildAge,
        medicalRequired,
        teamEvent,
        genderRestriction,
        description
    } = req.body;

    if (!date || !name || typeof isRace === 'undefined') {
        return res.status(400).send('Missing date, name or isRace');
    }

    const folderName = `${String(date).replace(/-/g, '')}_${String(name).toLowerCase().replace(/\s+/g, '')}`;
    try {
        ensureEventFolder(folderName);

        const eventId = id && String(id).trim() ? String(id).trim() : (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());

        db.prepare(`
      INSERT INTO events (
        id, folder, name, date, time, place, is_race, age_limit, max_child_age, medical_required, team_event, gender_restriction, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            eventId,
            folderName,
            name,
            date,
            time || null,
            place || null,
            toBool(isRace) ? 1 : 0,
            typeof ageLimit === 'undefined' ? null : String(ageLimit),
            typeof maxChildAge === 'undefined' || maxChildAge === '' ? null : Number(maxChildAge),
            toBool(medicalRequired) ? 1 : 0,
            toBool(teamEvent) ? 1 : 0,
            typeof genderRestriction === 'undefined' ? null : String(genderRestriction),
            typeof description === 'undefined' ? null : String(description)
        );

        res.status(200).send('Event saved');
    } catch (e) {
        if (String(e.message || '').includes('UNIQUE constraint failed: events.folder')) {
            return res.status(400).send('Event with this folder already exists');
        }
        res.status(500).send('Failed to save event');
    }
});

router.post('/:id/register', (req, res) => {
    const folder = req.params.id;
    const { name, surname, gender, age, email, phone, raceRole } = req.body;
    if (!name || !surname || typeof age === 'undefined') {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const ev = getEventByFolder(folder);
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    try {
        const participantId = Date.now().toString();
        db.prepare(`
      INSERT INTO participants (id, event_id, name, surname, gender, age, email, phone, race_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            participantId,
            ev.id,
            name || null,
            surname || null,
            gender || null,
            typeof age === 'undefined' || age === '' ? null : Number(age),
            email || null,
            phone || null,
            raceRole || null
        );
        res.status(200).json({ message: 'Participant registered', id: participantId });
    } catch (e) {
        res.status(500).json({ error: 'Failed to register participant' });
    }
});

router.get('/:id/participants', (req, res) => {
    const folder = req.params.id;
    const ev = getEventByFolder(folder);
    if (!ev) return res.json([]);
    try {
        const rows = db
            .prepare('SELECT id, name, surname, gender, age, email, phone, race_role FROM participants WHERE event_id = ? ORDER BY id')
            .all(ev.id);
        const participants = rows.map(r => ({
            id: String(r.id),
            name: r.name || '',
            surname: r.surname || '',
            gender: r.gender || '',
            age: r.age === null || typeof r.age === 'undefined' ? '' : String(r.age),
            email: r.email || '',
            phone: r.phone || '',
            raceRole: r.race_role || ''
        }));
        res.json(participants);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read participants' });
    }
});

router.post('/:id/results', (req, res) => {
    const folder = req.params.id;
    const { results } = req.body;
    if (!Array.isArray(results)) {
        return res.status(400).json({ error: 'Results must be an array' });
    }
    const ev = getEventByFolder(folder);
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;

    try {
        const row = db.prepare('SELECT MAX(race_id) AS maxRace FROM results WHERE event_id = ? AND date = ?').get(ev.id, dateStr);
        const nextRace = (row && row.maxRace ? Number(row.maxRace) : 0) + 1;

        const insert = db.prepare(`
      INSERT INTO results (event_id, date, race_id, participant_id, time)
      VALUES (?, ?, ?, ?, ?)
    `);
        const tx = db.transaction((items) => {
            for (const r of items) {
                insert.run(ev.id, dateStr, nextRace, String(r.id), String(r.time));
            }
        });
        tx(results);

        res.status(200).json({ message: 'Results saved' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save results' });
    }
});

router.get('/:id/results', (req, res) => {
    const folder = req.params.id;
    const ev = getEventByFolder(folder);
    if (!ev) return res.json([]);
    try {
        const rows = db
            .prepare('SELECT date, race_id AS raceId, participant_id AS id, time FROM results WHERE event_id = ? ORDER BY date, race_id, id')
            .all(ev.id);
        const out = rows.map(r => ({
            date: String(r.date),
            raceId: String(r.raceId),
            id: String(r.id),
            time: String(r.time)
        }));
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read results' });
    }
});

router.delete('/:id/results/:date', (req, res) => {
    const folder = req.params.id;
    const date = req.params.date;
    const ev = getEventByFolder(folder);
    if (!ev) return res.status(404).json({ error: 'Results file not found' });
    try {
        const info = db.prepare('DELETE FROM results WHERE event_id = ? AND date = ?').run(ev.id, String(date));
        if (info.changes === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.status(200).json({ message: 'Group deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete result group' });
    }
});

router.delete('/:eventId/participants/:participantId', (req, res) => {
    const folder = req.params.eventId;
    const participantId = req.params.participantId;
    const ev = getEventByFolder(folder);
    if (!ev) return res.status(404).json({ error: 'Participants file not found' });
    try {
        const info = db.prepare('DELETE FROM participants WHERE event_id = ? AND id = ?').run(ev.id, String(participantId));
        if (info.changes === 0) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        res.status(200).json({ message: 'Participant deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete participant' });
    }
});

router.put('/:eventId/participants/:participantId', (req, res) => {
    const folder = req.params.eventId;
    const participantId = req.params.participantId;
    const { name, surname, gender, age, email, phone, raceRole } = req.body;
    const ev = getEventByFolder(folder);
    if (!ev) return res.status(404).json({ error: 'Participants file not found' });

    try {
        const info = db.prepare(`
      UPDATE participants
      SET name = ?, surname = ?, gender = ?, age = ?, email = ?, phone = ?, race_role = ?
      WHERE event_id = ? AND id = ?
    `).run(
            name || null,
            surname || null,
            gender || null,
            typeof age === 'undefined' || age === '' ? null : Number(age),
            email || null,
            phone || null,
            raceRole || null,
            ev.id,
            String(participantId)
        );

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Participant not found' });
        }

        res.status(200).json({ message: 'Participant updated' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update participant' });
    }
});

module.exports = router;
