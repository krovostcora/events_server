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
const readFileAsync = promisify(fs.readFile); // Added this line

// Ensure events directory exists
async function ensureEventsDir() {
    try {
        await accessAsync(EVENTS_DIR);
    } catch (err) {
        await mkdirAsync(EVENTS_DIR, { recursive: true });
    }
}

// Helper function to read event info
async function readEventInfo(filePath) {
    const data = await readFileAsync(filePath, 'utf8');
    const lines = data.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
        throw new Error('Invalid event info file');
    }

    const headers = lines[0].split(';');
    const values = lines[1].split(';');

    const eventInfo = {};
    headers.forEach((header, index) => {
        if (values[index]) {
            eventInfo[header] = values[index];
        }
    });

    // Normalize boolean values
    if ('isRace' in eventInfo) {
        eventInfo.isRace = eventInfo.isRace === 'true';
    }

    return eventInfo;
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

    // Validate event ID format
    if (!id || typeof id !== 'string' || id.length < 3) {
        return res.status(400).json({
            success: false,
            error: 'Invalid event ID format'
        });
    }

    // Extract and validate participant data
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
    const validationErrors = [];

    if (!name.trim()) validationErrors.push('Name is required');
    if (!surname.trim()) validationErrors.push('Surname is required');
    if (!age) validationErrors.push('Age is required');

    if (validationErrors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: validationErrors
        });
    }

    // Validate age format
    const ageNum = Number(age);
    if (isNaN(ageNum) {
        return res.status(400).json({
            success: false,
            error: 'Invalid age',
            details: 'Age must be a number'
        });
    }
    if (ageNum <= 0 || ageNum > 150) {
        return res.status(400).json({
            success: false,
            error: 'Invalid age',
            details: 'Age must be between 1 and 150'
        });
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email format'
        });
    }

    // Prepare file paths
    const folderPath = path.join(EVENTS_DIR, id);
    const participantsPath = path.join(folderPath, 'participants.csv');
    const eventInfoPath = path.join(folderPath, `${id}.csv`);

    try {
        // Check if event exists and is valid
        try {
            await accessAsync(folderPath);
            await accessAsync(eventInfoPath);
        } catch (err) {
            return res.status(404).json({
                success: false,
                error: 'Event not found or inaccessible',
                details: `Event folder ${id} does not exist or is corrupted`
            });
        }

        // Read event info to validate restrictions
        const eventInfo = await readEventInfo(eventInfoPath);

        // Validate against event restrictions
        if (eventInfo.ageLimit === '18+' && ageNum < 18) {
            return res.status(403).json({
                success: false,
                error: 'Age restriction',
                details: 'This event is for participants 18+ only'
            });
        }

        if (eventInfo.genderRestriction &&
            eventInfo.genderRestriction !== 'any' &&
            gender !== eventInfo.genderRestriction) {
            return res.status(403).json({
                success: false,
                error: 'Gender restriction',
                details: `This event is for ${eventInfo.genderRestriction} only`
            });
        }

        // Create participants file if it doesn't exist
        try {
            await accessAsync(participantsPath);
        } catch (err) {
            await writeFileAsync(
                participantsPath,
                'id;name;surname;gender;age;email;phone;raceRole;registrationDate\n'
            );
        }

        // Prepare participant data
        const participantId = Date.now().toString();
        const registrationDate = new Date().toISOString();

        const csvLine = [
            participantId,
            name.trim(),
            surname.trim(),
            gender,
            age,
            email.trim(),
            phone,
            eventInfo.isRace ? raceRole : '', // Only include raceRole for race events
            registrationDate
        ].join(';');

        // Append participant to file
        await appendFileAsync(participantsPath, csvLine + '\n');

        // Log successful registration
        console.log(`New registration for event ${id}: ${name} ${surname}`);

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Participant registered successfully',
            data: {
                id: participantId,
                name: name.trim(),
                surname: surname.trim(),
                eventId: id,
                registrationDate
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;