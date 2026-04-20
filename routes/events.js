const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/events
router.get('/', async (req, res) => {
    try {
        const events = await prisma.event.findMany();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read events' });
    }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const event = await prisma.event.findUnique({
            where: { id }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/events
router.post('/', async (req, res) => {
    const {
        name, date, isRace, time, place,
        ageLimit, maxChildAge, medicalRequired, teamEvent, genderRestriction, description
    } = req.body;

    try {
        const newEvent = await prisma.event.create({
            data: {
                name,
                date,
                time,
                place,
                isRace: isRace === true || isRace === 'true',
                ageLimit: ageLimit?.toString(),
                maxChildAge: maxChildAge?.toString(),
                medicalRequired: medicalRequired === true || medicalRequired === 'true',
                teamEvent: teamEvent === true || teamEvent === 'true',
                genderRestriction,
                description
            }
        });
        res.status(200).json(newEvent);
    } catch (err) {
        res.status(500).send('Failed to save event');
    }
});

// PUT /api/events/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const updatedEvent = await prisma.event.update({
            where: { id },
            data: {
                ...req.body,
                isRace: req.body.isRace === true || req.body.isRace === 'true',
                medicalRequired: req.body.medicalRequired === true || req.body.medicalRequired === 'true',
                teamEvent: req.body.teamEvent === true || req.body.teamEvent === 'true'
            }
        });
        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.event.delete({ where: { id } });
        res.json({ message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// POST /api/events/:id/register
router.post('/:id/register', async (req, res) => {
    const { id } = req.params;
    const { name, surname, gender, age, email, phone, raceRole } = req.body;

    try {
        const participant = await prisma.participant.create({
            data: {
                name,
                surname,
                gender,
                age: parseInt(age),
                email,
                phone,
                raceRole,
                eventId: id
            }
        });
        res.status(200).json(participant);
    } catch (err) {
        res.status(500).json({ error: 'Failed to register participant' });
    }
});

// GET /api/events/:id/participants
router.get('/:id/participants', async (req, res) => {
    const { id } = req.params;
    try {
        const participants = await prisma.participant.findMany({
            where: { eventId: id }
        });
        res.json(participants);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read participants' });
    }
});

// DELETE /api/events/:eventId/participants/:participantId
router.delete('/:eventId/participants/:participantId', async (req, res) => {
    const { participantId } = req.params;
    try {
        await prisma.participant.delete({
            where: { id: participantId }
        });
        res.status(200).json({ message: 'Participant deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete participant' });
    }
});

// PUT /api/events/:eventId/participants/:participantId
router.put('/:eventId/participants/:participantId', async (req, res) => {
    const { participantId } = req.params;
    try {
        const updated = await prisma.participant.update({
            where: { id: participantId },
            data: {
                ...req.body,
                age: req.body.age ? parseInt(req.body.age) : undefined
            }
        });
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update participant' });
    }
});

// POST /api/events/:eventId/results
router.post('/:eventId/results', async (req, res) => {
    const { eventId } = req.params;
    const { results } = req.body;
    try {
        const createdResults = await prisma.$transaction(
            results.map(r => prisma.result.create({
                data: {
                    startTime: r.startTime,
                    finishTime: r.finishTime,
                    participantId: r.id,
                    eventId: eventId
                }
            }))
        );
        res.status(200).json({ message: 'Results saved', added: createdResults.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save results' });
    }
});

// GET /api/events/:id/results
router.get('/:eventId/results', async (req, res) => {
    const { eventId } = req.params;
    try {
        const results = await prisma.result.findMany({
            where: { eventId }
        });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read results' });
    }
});

// DELETE /api/events/:id/results/:id/:startTime
router.delete('/:eventId/results/:id/:startTime', async (req, res) => {
    const { id, startTime } = req.params;
    try {
        await prisma.result.deleteMany({
            where: {
                participantId: id,
                startTime: startTime
            }
        });
        res.status(200).json({ message: 'Result deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete result' });
    }
});

module.exports = router;