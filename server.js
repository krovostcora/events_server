const express = require('express');
const cors = require('cors');
const path = require('path');



require('./data/db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const eventsRouter = require('./routes/events');
app.use('/api/events', eventsRouter);

app.use('/static', express.static(path.join(__dirname, 'events')));

app.listen(PORT, () => {
    console.log(`This server is listening on http://localhost:${PORT}`);
});
