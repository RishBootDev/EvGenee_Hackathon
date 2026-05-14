require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Station = require('./src/models/station.model');
const { MONGO_URI } = require('./src/config/config');

const MOCK_MECHANICS = [
  { name: 'Kapil EV Rescue', phone: '+91-9811234567', rating: 4.8, speciality: 'EV Battery & Drivetrain' },
  { name: 'Delhi EV Care Hub', phone: '+91-9911223344', rating: 4.6, speciality: 'EV Charging & Breakdown' },
  { name: 'Shankar EV Workshop', phone: '+91-9820012345', rating: 4.9, speciality: 'Full EV Diagnostics' },
  { name: 'Mumbai Quick EV Fix', phone: '+91-9819876543', rating: 4.5, speciality: 'Towing & Recovery' },
  { name: 'TechServe EV Solutions', phone: '+91-9845012345', rating: 4.9, speciality: 'Software & EV Battery' },
  { name: 'HiTech EV Assist', phone: '+91-9848012345', rating: 4.7, speciality: 'EV Breakdown & Recovery' },
  { name: 'Pune EV Garage', phone: '+91-9881234567', rating: 4.6, speciality: 'Battery & Tyre Services' },
  { name: 'Chennai EV Masters', phone: '+91-9841234567', rating: 4.8, speciality: 'Full EV Servicing' },
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const stations = await Station.find({});
    let updated = 0;

    for (const station of stations) {
      if (!station.mechanic || !station.mechanic.name || station.mechanic.name === "Station Auto Care") {
        const randomMechanic = MOCK_MECHANICS[Math.floor(Math.random() * MOCK_MECHANICS.length)];
        station.mechanic = randomMechanic;
        await station.save();
        updated++;
      }
    }

    console.log(`Updated ${updated} stations with mechanic data.`);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
