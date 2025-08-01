const express = require('express');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const router = express.Router();
const EVENTS_DIR = path.join(__dirname, '..', 'events');

// Promisify file system methods
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);
const accessAsync = promisify(fs.access);

// Ensure events directory exists
async function ensureEventsDir() {
    try {
        await accessAsync(EVENTS_DIR);
    } catch (err) {
        await mkdirAsync(EVENTS_DIR, { recursive: true });
    }
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
router.post('/:id/register', async (req, res) => {
    const { id } = req.params;
    const {
        name = '',
        surname = '',
        gender = '',
        age = '',
        email = '',
        phone = '',
        raceRole = 'spectator',
    } = req.body;

    // Validate required fields
    if (!name.trim() || !surname.trim() || !age) {
        return res.status(400).json({
            error: 'Missing required fields: name, surname, and age are required'
        });
    }

    const ageNum = Number(age);
    if (isNaN(ageNum) || ageNum <= 0) {
        return res.status(400).json({
            error: 'Age must be a positive number'
        });
    }

    const folderPath = path.join(EVENTS_DIR, id);
    const participantsPath = path.join(folderPath, 'participants.csv');

    try {
        await ensureEventsDir();

        // Check if event folder exists
        try {
            await accessAsync(folderPath);
        } catch (err) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }

        // Create participants file if it doesn't exist
        try {
            await accessAsync(participantsPath);
        } catch (err) {
            await writeFileAsync(
                participantsPath,
                'id;name;surname;gender;age;email;phone;raceRole\n'
            );
        }

        const participantId = Date.now().toString();
        const csvLine = [
            participantId,
            name.trim(),
            surname.trim(),
            gender,
            age,
            email.trim(),
            phone,
            raceRole,
        ].join(';');

        await appendFileAsync(participantsPath, csvLine + '\n');

        res.json({
            message: 'Participant registered successfully',
            id: participantId,
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            error: 'Failed to register participant',
            details: err.message,
        });
    }
});

module.exports = router;
