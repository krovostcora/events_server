const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../data/db');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

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

function ensureEventFolder(folder) {
    const p = path.join(EVENTS_DIR, folder);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
}

function saveLogoBuffer(folder, buffer) {
    ensureEventFolder(folder);
    const filePath = path.join(EVENTS_DIR, folder, 'logo.png');
    fs.writeFileSync(filePath, buffer);
}

function logoUrl(req, folder) {
    const base = `${req.protocol}://${req.get('host')}`;
    const file = path.join(EVENTS_DIR, folder, 'logo.png');
    return fs.existsSync(file) ? `${base}/static/${folder}/logo.png` : null;
}

function getEventByFolder(folder) {
    return db.prepare('SELECT * FROM events WHERE folder = ?').get(folder);
}

function getEventById(id) {
    return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

function getEventByParam(param) {
    return getEventByFolder(param) || getEventById(param);
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
        const ev = getEventByParam(req.params.id);
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

router.post('/', upload.single('logo'), (req, res) => {
    const body = req.body || {};
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
        description,
        logoBase64
    } = body;

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

        if (req.file && req.file.buffer) {
            saveLogoBuffer(folderName, req.file.buffer);
        } else if (logoBase64) {
            const m = String(logoBase64).match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/i);
            const data = m ? m[2] : String(logoBase64);
            const buf = Buffer.from(data, 'base64');
            saveLogoBuffer(folderName, buf);
        }

        res.status(200).send('Event saved');
    } catch (e) {
        if (String(e.message || '').includes('UNIQUE constraint failed: events.folder')) {
            return res.status(400).send('Event with this folder already exists');
        }
        res.status(500).send('Failed to save event');
    }
});

router.post('/:id/logo', upload.single('logo'), (req, res) => {
    try {
        const ev = getEventByParam(req.params.id);
        if (!ev) return res.status(404).json({ error: 'Event not found' });
        if (!(req.file && req.file.buffer)) return res.status(400).json({ error: 'Logo file is required' });
        saveLogoBuffer(ev.folder, req.file.buffer);
        res.status(200).json({ message: 'Logo saved', url: logoUrl(req, ev.folder) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save logo' });
    }
});

router.post('/:id/register', (req, res) => {
    const ev = getEventByParam(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    const { name, surname, gender, age, email, phone, raceRole } = req.body || {};
    if (!name || !surname || typeof age === 'undefined') {
        return res.status(400).json({ error: 'Missing required fields' });
    }

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
    const ev = getEventByParam(req.params.id);
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

router.delete('/:eventId/participants/:participantId', (req, res) => {
    const ev = getEventByParam(req.params.eventId);
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    try {
        const info = db
            .prepare('DELETE FROM participants WHERE event_id = ? AND id = ?')
            .run(ev.id, String(req.params.participantId));

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        res.status(200).json({ message: 'Participant deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete participant' });
    }
});

router.put('/:eventId/participants/:participantId', (req, res) => {
    const ev = getEventByParam(req.params.eventId);
    if (!ev) return res.status(404).json({ error: 'Participants table not found' });

    const { name, surname, gender, age, email, phone, raceRole } = req.body || {};

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
            String(req.params.participantId)
        );

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Participant not found' });
        }

        res.status(200).json({ message: 'Participant updated' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update participant' });
    }
});

router.post('/:id/results', (req, res) => {
    const ev = getEventByParam(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    if (!ev.is_race) return res.status(400).json({ error: 'Event is not a race' });

    const body = req.body || {};
    const items = Array.isArray(body.results) ? body.results : [];
    if (!items.length) return res.status(400).json({ error: 'Results must be a non-empty array' });

    const providedDate = body.date ? String(body.date).replace(/\D/g, '') : null;
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${now.getFullYear()}`;
    const dateStr = providedDate && providedDate.length === 8 ? providedDate : today;

    try {
        let raceId = body.raceId ? Number(body.raceId) : null;
        if (!raceId || Number.isNaN(raceId)) {
            const row = db
                .prepare('SELECT COALESCE(MAX(race_id),0) AS maxRace FROM results WHERE event_id = ? AND date = ?')
                .get(ev.id, dateStr);
            raceId = Number(row.maxRace) + 1;
        }

        const insert = db.prepare(`
            INSERT INTO results (event_id, date, race_id, participant_id, time)
            VALUES (?, ?, ?, ?, ?)
        `);

        const tx = db.transaction((arr) => {
            for (const r of arr) {
                insert.run(
                    ev.id,
                    dateStr,
                    raceId,
                    Number(r.id),   // 🔑 зберігаємо як число
                    String(r.time)
                );
            }
        });
        tx(items);

        res.status(200).json({ message: 'Results saved', date: dateStr, raceId });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save results' });
    }
});

router.get('/:id/results', (req, res) => {
    const ev = getEventByParam(req.params.id);
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
    const ev = getEventByParam(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Results not found' });
    const date = String(req.params.date).replace(/\D/g, '');
    if (date.length !== 8) return res.status(400).json({ error: 'Invalid date' });
    try {
        const info = db.prepare('DELETE FROM results WHERE event_id = ? AND date = ?').run(ev.id, date);
        if (info.changes === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.status(200).json({ message: 'Group deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete result group' });
    }
});

module.exports = router;
