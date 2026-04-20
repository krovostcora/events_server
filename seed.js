const fs = require('fs');
const path = require('path');
const prisma = require('./prismaClient');

async function main() {
    const eventsDir = path.join(__dirname, 'events');
    const folders = fs.readdirSync(eventsDir);

    for (const folder of folders) {
        const folderPath = path.join(eventsDir, folder);
        if (!fs.lstatSync(folderPath).isDirectory()) continue;

        // 1. Search for the event file (ex., 20251014_birdthday.csv)
        const eventFile = fs.readdirSync(folderPath).find(f => f.endsWith('.csv') && f !== 'participants.csv' && f !== 'results.csv');

        if (eventFile) {
            const eventData = fs.readFileSync(path.join(folderPath, eventFile), 'utf-8').split('\n')[1].split(';');

            // Create event in bd
            const event = await prisma.event.create({
                data: {
                    name: eventData[1],
                    date: eventData[2],
                    time: eventData[3],
                    place: eventData[4],
                    isRace: eventData[5] === 'true',
                    description: eventData[11] || eventData[eventData.length - 1],
                }
            });

            console.log(`✅ "${event.name}" migrated!`);

            // 2. Search the participants file (participants.csv)
            const partPath = path.join(folderPath, 'participants.csv');
            if (fs.existsSync(partPath)) {
                const partLines = fs.readFileSync(partPath, 'utf-8').split('\n').slice(1);

                for (const line of partLines) {
                    if (!line.trim()) continue;
                    const [id, name, surname, gender, age, email] = line.split(';');

                    await prisma.participant.create({
                        data: {
                            name,
                            surname,
                            email,
                            age: parseInt(age) || null,
                            gender,
                            eventId: event.id
                        }
                    });
                }
                console.log(`   👥 Participations ${event.name} added`);
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());