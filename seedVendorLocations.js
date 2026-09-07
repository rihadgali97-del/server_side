/**
 * seedVendorLocations.js
 * Seeds all vendors with coordinates near YOUR actual location
 * (Addis Ababa area — lat: 8.98, lng: 38.75)
 * 
 * Usage: node seedVendorLocations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

// ── Your actual GPS location from the browser ──────────────────────────────────
const CENTER = { lng: 38.75, lat: 8.98 }; // Addis Ababa

// Small offsets — each vendor within 5–15km of center
const OFFSETS = [
  { lng:  0.000, lat:  0.000 },  // center
  { lng:  0.020, lat:  0.015 },  // ~2km NE
  { lng: -0.015, lat:  0.025 },  // ~3km N
  { lng:  0.035, lat: -0.010 },  // ~4km E
  { lng: -0.025, lat: -0.020 },  // ~3km SW
  { lng:  0.050, lat:  0.040 },  // ~6km NE
  { lng: -0.040, lat:  0.030 },  // ~5km NW
  { lng:  0.060, lat: -0.050 },  // ~8km SE
  { lng: -0.060, lat: -0.040 },  // ~7km SW
  { lng:  0.080, lat:  0.070 },  // ~10km NE
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('✅ Connected\n');

  const db      = mongoose.connection.db;
  const vendors = await db.collection('vendors').find({}).toArray();
  console.log(`Found ${vendors.length} vendors\n`);

  for (let i = 0; i < vendors.length; i++) {
    const offset = OFFSETS[i % OFFSETS.length];
    const coords = [
      +(CENTER.lng + offset.lng).toFixed(6),
      +(CENTER.lat + offset.lat).toFixed(6),
    ];
    await db.collection('vendors').updateOne(
      { _id: vendors[i]._id },
      { $set: { location: { type: 'Point', coordinates: coords } } }
    );
    console.log(`✓ "${vendors[i].businessName}" → [${coords[0]}, ${coords[1]}]`);
  }

  console.log(`\n✅ Done — all vendors now within 15km of your location`);
  console.log(`   Your location: [${CENTER.lng}, ${CENTER.lat}]`);
  console.log('   Reload Near Me — products will appear now!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });