const express = require('express');
const path = require('path');
const db = require('../db'); // підключення до SQLite (events.db)

const router = express.Router();

// ------------------------- EVENTS -------------------------

// GET /api/events – список всіх подій
router.get('/', (req, res) => {
    db.all('SELECT * FROM events', (err, rows) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).json({ error: 'Failed to fetch events' });
        }
        res.json(rows);
    });
});

// GET /api/events/:id – деталі однієї події
router.get('/:id', (req, res) => {
    const eventId = req.params.id;

    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
        if (err) {
            console.error('Error fetching event:', err);
            return res.status(500).json({ error: 'Failed to fetch event' });
        }
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // logo зберігати будемо в папці /static, тому лишаємо поле
        const logoUrl = `https://events-server-eu5z.onrender.com/static/${eventId}/logo.png`;
        res.json({ ...event, logo: logoUrl });
    });
});

// POST /api/events – створити нову подію
router.post('/', (req, res) => {
    const {
        name, date, time, place, isRace,
        ageLimit, maxChildAge, medicalRequired, teamEvent,
        genderRestriction, description
    } = req.body;

    if (!name || !date) {
        return res.status(400).json({ error: 'Missing required fields: name, date' });
    }

    const sql = `
    INSERT INTO events (name, date, time, place, isRace, ageLimit, maxChildAge,
                        medicalRequired, teamEvent, genderRestriction, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    db.run(sql,
        [name, date, time, place, isRace ? 1 : 0, ageLimit, maxChildAge,
            medicalRequired ? 1 : 0, teamEvent ? 1 : 0, genderRestriction, description],
        function (err) {
            if (err) {
                console.error('Error inserting event:', err);
                return res.status(500).json({ error: 'Failed to create event' });
            }
            res.status(201).json({ id: this.lastID, name, date });
        }
    );
});

// ------------------------- PARTICIPANTS -------------------------

// POST /api/events/:id/register – зареєструвати учасника
router.post('/:id/register', (req, res) => {
    const eventId = req.params.id;
    const { name, surname, gender, age, email, phone, raceRole } = req.body;

    if (!name || !surname || !age) {
        return res.status(400).json({ error: 'Missing required fields: name, surname, age' });
    }

    const sql = `
        INSERT INTO participants (event_id, name, surname, gender, age, email, phone, raceRole)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql,
        [eventId, name, surname, gender, age, email, phone, raceRole || ''],
        function (err) {
            if (err) {
                console.error('Error inserting participant:', err);
                return res.status(500).json({ error: 'Failed to register participant' });
            }
            res.status(201).json({
                id: this.lastID,
                event_id: eventId,
                name, surname, gender, age, email, phone, raceRole
            });
        }
    );
});

// GET /api/events/:id/participants – список учасників події
router.get('/:id/participants', (req, res) => {
    const eventId = req.params.id;

    db.all('SELECT * FROM participants WHERE event_id = ?', [eventId], (err, rows) => {
        if (err) {
            console.error('Error fetching participants:', err);
            return res.status(500).json({ error: 'Failed to fetch participants' });
        }
        res.json(rows);
    });
});

// DELETE /api/events/:eventId/participants/:participantId – видалити учасника
router.delete('/:eventId/participants/:participantId', (req, res) => {
    const { eventId, participantId } = req.params;

    db.run('DELETE FROM participants WHERE id = ? AND event_id = ?', [participantId, eventId], function (err) {
        if (err) {
            console.error('Error deleting participant:', err);
            return res.status(500).json({ error: 'Failed to delete participant' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        res.json({ message: 'Participant deleted' });
    });
});

// PUT /api/events/:eventId/participants/:participantId – оновити учасника
router.put('/:eventId/participants/:participantId', (req, res) => {
    const { eventId, participantId } = req.params;
    const { name, surname, gender, age, email, phone, raceRole } = req.body;

    const sql = `
    UPDATE participants
    SET name = ?, surname = ?, gender = ?, age = ?, email = ?, phone = ?, raceRole = ?
    WHERE id = ? AND event_id = ?
  `;

    db.run(sql,
        [name, surname, gender, age, email, phone, raceRole, participantId, eventId],
        function (err) {
            if (err) {
                console.error('Error updating participant:', err);
                return res.status(500).json({ error: 'Failed to update participant' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Participant not found' });
            }
            res.json({ message: 'Participant updated' });
        }
    );
});


module.exports = router;
