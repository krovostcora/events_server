const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const eventsRouter = require('./routes/events');
app.use('/api/events', eventsRouter);

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
