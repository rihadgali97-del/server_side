/**
 * seedVendorLocations.js
 * Seeds all vendors with coordinates near Bahir Dar
 * (Bahir Dar area — lat: 11.5936, lng: 37.3908)
 * 
 * Usage: node seedVendorLocations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

// ── Bahir Dar GPS Location ─────────────────────────────────────────────────────
const CENTER = { lng: 37.3908, lat: 11.5936 }; // Bahir Dar

// Small offsets — each vendor within 2–10km of Bahir Dar center
const OFFSETS = [
  { lng:  0.000, lat:  0.000 },  // Center (Bahir Dar)
  { lng:  0.015, lat:  0.010 },  // ~1.5km NE
  { lng: -0.010, lat:  0.018 },  // ~2km N
  { lng:  0.025, lat: -0.008 },  // ~2.5km E
  { lng: -0.018, lat: -0.015 },  // ~2km SW
  { lng:  0.035, lat:  0.028 },  // ~4km NE
  { lng: -0.028, lat:  0.022 },  // ~3.5km NW
  { lng:  0.042, lat: -0.035 },  // ~5km SE
  { lng: -0.045, lat: -0.028 },  // ~5km SW
  { lng:  0.055, lat:  0.048 },  // ~7km NE
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

  console.log(`\n✅ Done — all vendors now within Bahir Dar area`);
  console.log(`   Bahir Dar center location: [${CENTER.lng}, ${CENTER.lat}]`);
  console.log('   Reload Near Me — products will appear now!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });