const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const EVENTS_DIR = path.join(__dirname, '..', 'events');

if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR);
}

// GET /api/events
router.get('/', (req, res) => {
    try {
        const folders = fs.readdirSync(EVENTS_DIR).filter(name => {
            const fullPath = path.join(EVENTS_DIR, name);
            return fs.statSync(fullPath).isDirectory();
        });

        const events = [];

        folders.forEach(folder => {
            const csvPath = path.join(EVENTS_DIR, folder, `${folder}.csv`);
            if (fs.existsSync(csvPath)) {
                const data = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
                if (data.length > 1) {
                    const firstDataRow = data[1].split(';');
                    const name = firstDataRow[1];
                    const date = firstDataRow[2];
                    events.push({
                        id: folder,
                        name,
                        date,
                        folder
                    });
                }
            }
        });

        res.json(events);
    } catch (err) {
        console.error('Error reading events:', err);
        res.status(500).json({ error: 'Failed to read events' });
    }
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const folderPath = path.join(EVENTS_DIR, id);
    const csvPath = path.join(folderPath, `${id}.csv`);

    if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: 'Event not found' });
    }

    try {
        const data = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
        if (data.length < 2) {
            return res.status(500).json({ error: 'CSV file has no data' });
        }

        const [_, row] = data;
        const [
            eventId, name, date, time, place, isRace,
            ageLimit, maxChildAge, medicalRequired, teamEvent, genderRestriction, description
        ] = row.split(';');

        const logoPath = path.join(folderPath, 'logo.png');
        const hasLogo = fs.existsSync(logoPath);
        const logoUrl = hasLogo
            ? `https://events-server-eu5z.onrender.com/static/${id}/logo.png`
            : null;

        res.json({
            id: eventId,
            name,
            date,
            time,
            place,
            isRace: isRace === 'true',
            ageLimit,
            maxChildAge,
            medicalRequired: medicalRequired === 'true',
            teamEvent: teamEvent === 'true',
            genderRestriction,
            description,
            logo: logoUrl,
            folder: id
        });
    } catch (err) {
        console.error('Failed to read event:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/events
router.post('/', (req, res) => {
    const {
        csvLine, date, name, isRace, time, place,
        ageLimit, maxChildAge, medicalRequired, teamEvent, genderRestriction, description
    } = req.body;

    if (!csvLine || !date || !name || typeof isRace === 'undefined') {
        return res.status(400).send('Missing csvLine, date, name or isRace');
    }

    const folderName = `${date.replace(/-/g, '')}_${name.toLowerCase().replace(/\s+/g, '')}`;
    const dirPath = path.join(EVENTS_DIR, folderName);

    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, `${folderName}.csv`);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, 'id;name;date;time;place;isRace;ageLimit;maxChildAge;medicalRequired;teamEvent;genderRestriction;description\n');
        }

        const participantsPath = path.join(dirPath, 'participants.csv');
        if (!fs.existsSync(participantsPath)) {
            fs.writeFileSync(participantsPath, 'id;name;surname;gender;age;email;phone;raceRole\n');
        }

        const line = [
            req.body.id || '', name, date, time, place, isRace,
            ageLimit, maxChildAge, medicalRequired, teamEvent, genderRestriction, description
        ].join(';');
        fs.appendFileSync(filePath, line + '\n');
        res.status(200).send('Event saved');
    } catch (err) {
        console.error('Error saving event:', err);
        res.status(500).send('Failed to save event');
    }
});

// POST /api/events/:id/register
router.post('/:id/register', (req, res) => {
    const { id } = req.params;
    const folderPath = path.join(EVENTS_DIR, id);
    const participantsPath = path.join(folderPath, 'participants.csv');

    const {
        name, surname, gender, age, email, phone, raceRole
    } = req.body;

    if (!name || !surname || !age) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Якщо participants.csv не існує — створюємо з заголовком
        if (!fs.existsSync(participantsPath)) {
            fs.writeFileSync(participantsPath, 'id;name;surname;gender;age;email;phone;raceRole\n');
        }

        const participantId = Date.now().toString();
        const line = [
            participantId, name, surname, gender, age, email, phone, raceRole || ''
        ].join(';');

        fs.appendFileSync(participantsPath, line + '\n');
        res.status(200).json({ message: 'Participant registered', id: participantId });
    } catch (err) {
        console.error('Error saving participant:', err);
        res.status(500).json({ error: 'Failed to register participant' });
    }
});

// GET /api/events/:id/participants
router.get('/:id/participants', (req, res) => {
    const { id } = req.params;
    const participantsPath = path.join(EVENTS_DIR, id, 'participants.csv');
    if (!fs.existsSync(participantsPath)) {
        return res.json([]); // No participants yet
    }
    try {
        const data = fs.readFileSync(participantsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;
        const fields = header.split(';');
        const participants = rows.map(row => {
            const values = row.split(';');
            return Object.fromEntries(fields.map((f, i) => [f, values[i] || '']));
        });
        res.json(participants);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read participants' });
    }
});

// POST /api/events/:id/results
router.post('/:id/results', (req, res) => {
    const { id } = req.params;
    const results = req.body.results; // [{ id, time }]
    const folderPath = path.join(EVENTS_DIR, id);
    const resultsPath = path.join(folderPath, 'results.csv');
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;

    if (!Array.isArray(results)) {
        return res.status(400).json({ error: 'Results must be an array' });
    }

    try {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        let lines = [];
        if (!fs.existsSync(resultsPath)) {
            lines.push('date;id;time');
        }
        lines = lines.concat(results.map(r => `${dateStr};${r.id};${r.time}`));
        fs.appendFileSync(resultsPath, lines.join('\n') + '\n');
        res.status(200).json({ message: 'Results saved' });
    } catch (err) {
        console.error('Error saving results:', err);
        res.status(500).json({ error: 'Failed to save results' });
    }
});

// GET /api/events/:id/results
router.get('/:id/results', (req, res) => {
    const { id } = req.params;
    const resultsPath = path.join(EVENTS_DIR, id, 'results.csv');
    if (!fs.existsSync(resultsPath)) {
        return res.json([]);
    }
    try {
        const data = fs.readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;
        const fields = header.split(';');
        const results = rows.map(row => {
            const values = row.split(';');
            return Object.fromEntries(fields.map((f, i) => [f, values[i] || '']));
        });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read results' });
    }
});

// DELETE /api/events/:eventId/participants/:participantId
router.delete('/:eventId/participants/:participantId', (req, res) => {
    const { eventId, participantId } = req.params;
    const participantsPath = path.join(EVENTS_DIR, eventId, 'participants.csv');

    if (!fs.existsSync(participantsPath)) {
        return res.status(404).json({ error: 'Participants file not found' });
    }

    try {
        const data = fs.readFileSync(participantsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;
        const filtered = rows.filter(row => !row.startsWith(participantId + ';'));
        fs.writeFileSync(participantsPath, [header, ...filtered].join('\n') + '\n');
        res.status(200).json({ message: 'Participant deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete participant' });
    }
});

// PUT /api/events/:eventId/participants/:participantId
router.put('/:eventId/participants/:participantId', (req, res) => {
    const { eventId, participantId } = req.params;
    const participantsPath = path.join(EVENTS_DIR, eventId, 'participants.csv');

    if (!fs.existsSync(participantsPath)) {
        return res.status(404).json({ error: 'Participants file not found' });
    }

    try {
        const data = fs.readFileSync(participantsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;
        const updatedRows = rows.map(row => {
            if (!row.startsWith(participantId + ';')) return row;
            const {
                name, surname, gender, age, email, phone, raceRole
            } = req.body;
            return [
                participantId, name, surname, gender, age, email, phone, raceRole || ''
            ].join(';');
        });
        fs.writeFileSync(participantsPath, [header, ...updatedRows].join('\n') + '\n');
        res.status(200).json({ message: 'Participant updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update participant' });
    }
});

module.exports = router;
