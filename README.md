# Events App – Server (Node.js + Express)

This is the backend part of the **Events App**, which I've developed during my internship.  
It works together with the React Native frontend and handles all server-side logic, including reading and writing `.csv` files for event and participant data.

## Features

- RESTful API for:
  - Event listing and details
  - Participant registration, editing, and deletion
- Reads/writes data to `.csv` files (one per event)
- Serves dynamic event data from `events/` directory
- Supports file-based structure:
  - Each event has its own folder with event info and `participants.csv`
 
## Routes
#### Events:
- `GET /api/events` → returns a list of all events with basic info (id, name, date).

- `GET /api/events/:id` → returns detailed information about a specific event (time, place, age limits, description, logo, etc.).

- `POST /api/events` → creates a new event (creates a folder with a CSV file to store event data).

#### Participants:

- `POST /api/events/:id/register` → registers a new participant for the event (saves them in participants.csv).

- `GET /api/events/:id/participants` → returns all participants of the event.

- `PUT /api/events/:eventId/participants/:participantId` → updates participant data.

- `DELETE /api/events/:eventId/participants/:participantId` → removes a participant.

#### Results:

- `POST /api/events/:id/results` → saves race results for participants.

- `GET /api/events/:id/results` → returns results of an event.

- `DELETE /api/events/:id/results/:date` → deletes all results for a given date.

## Tech Stack

- **Node.js**
- **Express**
- **CSV parser (fs, csv-parser/write)**

## Frontend

This repository includes only the server logic.  
The frontend (React Native + Expo) is available here:  
👉 [events-Rnative](https://github.com/krovostcora/events-Rnative)

## Setup

```bash
git clone https://github.com/krovostcora/events_server
cd events_server
npm install
node index.js
