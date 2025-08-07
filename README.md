# Events App – Server (Node.js + Express)

This is the backend part of the **Events App**, which I'm developing during my internship.  
It works together with the React Native frontend and handles all server-side logic, including reading and writing `.csv` files for event and participant data.

## Features

- RESTful API for:
  - Event listing and details
  - Participant registration, editing, and deletion
- Reads/writes data to `.csv` files (one per event)
- Serves dynamic event data from `events/` directory
- Supports file-based structure:
  - Each event has its own folder with event info and `participants.csv`

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
