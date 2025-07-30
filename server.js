const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;
const path = require('path');


app.use(cors());
app.use(express.json());

const eventsRouter = require('./routes/events');
app.use('/api/events', eventsRouter);

app.use('/static', express.static(path.join(__dirname, 'events')));
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
