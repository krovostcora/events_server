const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const eventsDir = path.join(__dirname, '../events');

if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir);
}

router.post('/', (req, res) => {
    const { csvLine, date } = req.body;
    if (!csvLine || !date) {
        return res.status(400).send('Missing csvLine or date');
    }

    const fileName = `${date.replace(/-/g, '')}_event.csv`;
    const filePath = path.join(eventsDir, fileName);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'id;name;date;time;place\n');
    }

    fs.appendFileSync(filePath, csvLine);
    res.status(200).send('Event saved');
});

module.exports = router;
