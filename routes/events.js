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
                    events.push({
                        id: folder,
                        name,
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
    const folder = req.params.id;
    const csvPath = path.join(EVENTS_DIR, folder, `${folder}.csv`);
    const logoPath = path.join(folderPath, 'logo.png');
    const hasLogo = fs.existsSync(logoPath);
    const logoUrl = hasLogo ? `https://events-server-eu5z.onrender.com/static/${id}/logo.png` : null;


    if (!fs.existsSync(csvPath)) {
        return res.status(404).send('Event not found');
    }

    try {
        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
        if (lines.length <= 1) return res.status(404).send('No data found');

        const row = lines[1].split(';');
        const [id, name, date, time, place] = row;

        res.json({
            id: eventId,
            name,
            date,
            time,
            place,
            folder: id,
            logo: logoUrl,
        });
    } catch (err) {
        console.error('Failed to read event:', err);
        res.status(500).send('Server error');
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

    const data = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
    if (data.length < 2) {
        return res.status(500).json({ error: 'CSV file has no data' });
    }

    const [_, row] = data;
    const [eventId, name, date, time, place] = row.split(';');

    res.json({
        id: eventId,
        name,
        date,
        time,
        place,
        folder: id,
    });
});


// POST /api/events
router.post('/', (req, res) => {
    const { csvLine, date, name } = req.body;
    if (!csvLine || !date || !name) {
        return res.status(400).send('Missing csvLine, date or name');
    }

    const folderName = `${date.replace(/-/g, '')}_${name.toLowerCase().replace(/\s+/g, '')}`;
    const dirPath = path.join(EVENTS_DIR, folderName);

    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, `${folderName}.csv`);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, 'id;name;date;time;place\n');
        }

        fs.appendFileSync(filePath, csvLine);
        res.status(200).send('Event saved');
    } catch (err) {
        console.error('Error saving event:', err);
        res.status(500).send('Failed to save event');
    }
});

module.exports = router;
