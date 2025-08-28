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

// PUT /api/events/:id (Edit event)
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const {
        name, date, time, place, isRace,
        ageLimit, maxChildAge, medicalRequired, teamEvent, genderRestriction, description
    } = req.body;

    const folderPath = path.join(EVENTS_DIR, id);
    const csvPath = path.join(folderPath, `${id}.csv`);

    if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: 'Event not found' });
    }

    try {
        // Overwrite the CSV with new data
        const header = 'id;name;date;time;place;isRace;ageLimit;maxChildAge;medicalRequired;teamEvent;genderRestriction;description\n';
        const line = [
            id, name, date, time, place, isRace,
            ageLimit, maxChildAge, medicalRequired, teamEvent, genderRestriction, description
        ].join(';');
        fs.writeFileSync(csvPath, header + line + '\n');
        res.json({ message: 'Event updated' });
    } catch (err) {
        console.error('Error updating event:', err);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// DELETE /api/events/:id (Delete event)
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const folderPath = path.join(EVENTS_DIR, id);

    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: 'Event not found' });
    }

    try {
        fs.rmSync(folderPath, { recursive: true, force: true });
        res.json({ message: 'Event deleted' });
    } catch (err) {
        console.error('Error deleting event:', err);
        res.status(500).json({ error: 'Failed to delete event' });
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

// DELETE /api/events/:eventId/participants/:participantId
router.delete('/:eventId/participants/:participantId', (req, res) => {
    const { eventId, participantId } = req.params;
    console.log('DELETE request received:', eventId, participantId); // <-- лог
    const participantsPath = path.join(EVENTS_DIR, eventId, 'participants.csv');

    if (!fs.existsSync(participantsPath)) {
        console.log('Participants file not found'); // <-- лог
        return res.status(404).json({ error: 'Participants file not found' });
    }

    try {
        const data = fs.readFileSync(participantsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;

        const filtered = rows.filter(row => {
            const [id] = row.split(';');
            console.log('Checking row id:', id);
            return id !== participantId;
        });

        fs.writeFileSync(participantsPath, [header, ...filtered].join('\n') + '\n');
        console.log('Participant deleted successfully');
        res.status(200).json({ message: 'Participant deleted' });
    } catch (err) {
        console.error('Failed to delete participant:', err);
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

// POST /api/events/:id/results
router.post('/:eventId/results', (req, res) => {
    const { eventId } = req.params;
    const results = req.body.results; // [{ id, startTime, finishTime }]
    const folderPath = path.join(EVENTS_DIR, eventId);
    const resultsPath = path.join(folderPath, 'results.csv');

    if (!Array.isArray(results)) {
        return res.status(400).json({ error: 'Results must be an array' });
    }

    try {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        let lines = [];
        if (fs.existsSync(resultsPath)) {
            const data = fs.readFileSync(resultsPath, 'utf8')
                .split('\n')
                .filter(Boolean);
            const [header, ...rows] = data;
            if (header) lines.push(header);
            lines = lines.concat(rows);
        } else {
            lines.push('startTime;finishTime;id');
        }

        // Додаємо всі результати, незалежно від id
        const newLines = results.map(r => `${r.startTime};${r.finishTime};${r.id}`);
        lines = lines.concat(newLines);

        fs.writeFileSync(resultsPath, lines.join('\n') + '\n', 'utf8');

        res.status(200).json({ message: 'Results saved', added: results.length });
    } catch (err) {
        console.error('Error saving results:', err);
        res.status(500).json({ error: 'Failed to save results' });
    }
});

// GET /api/events/:id/results
router.get('/:eventId/results', (req, res) => {
    const { eventId } = req.params;
    const resultsPath = path.join(EVENTS_DIR, eventId, 'results.csv');
    if (!fs.existsSync(resultsPath)) return res.json([]);

    try {
        const data = fs.readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;
        const fields = header.split(';');
        const results = rows.map(row => {
            const values = row.split(';');
            return Object.fromEntries(fields.map((f, i) => [f, values[i] || '']));
        });
        res.json(results); // [{ startTime, finishTime, id }]
    } catch (err) {
        res.status(500).json({ error: 'Failed to read results' });
    }
});

// DELETE /api/events/:id/results/:id/:startTime
router.delete('/:eventId/results/:id/:startTime', (req, res) => {
    const { eventId, id, startTime } = req.params;
    const resultsPath = path.join(EVENTS_DIR, eventId, 'results.csv');

    if (!fs.existsSync(resultsPath))
        return res.status(404).json({ error: 'Results file not found' });

    try {
        const data = fs.readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean);
        const [header, ...rows] = data;

        const updatedRows = rows.filter(row => {
            const [rowStartTime, , rowId] = row.split(';');
            return !(rowId === id && rowStartTime === startTime);
        });

        fs.writeFileSync(resultsPath, [header, ...updatedRows].join('\n') + '\n', 'utf8');
        res.status(200).json({ message: `Result with id=${id} and startTime=${startTime} deleted` });
    } catch (err) {
        console.error('Error deleting result:', err);
        res.status(500).json({ error: 'Failed to delete result' });
    }
});

module.exports = router;
