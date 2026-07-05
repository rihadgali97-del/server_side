require('dotenv').config();
const mongoose = require('mongoose');
const Vendor   = require('./models/Vendor'); 

// ── Coordinates near Jimma, Ethiopia (customer's location) ──────────────
// Each vendor gets a slightly different position within 30km of Jimma city center
const JIMMA_CENTER = { lng: 36.8331, lat: 7.6780 };

// Small offsets in degrees (~1° ≈ 111km, so 0.05° ≈ 5.5km)
const OFFSETS = [
  { lng:  0.000, lat:  0.000 },  // Jimma center
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
  console.log('Connected to MongoDB');

  const vendors = await Vendor.find({});
  console.log(`Found ${vendors.length} vendors`);

  let updated = 0;
  for (let i = 0; i < vendors.length; i++) {
    const offset = OFFSETS[i % OFFSETS.length];
    const coords = [
      JIMMA_CENTER.lng + offset.lng,
      JIMMA_CENTER.lat + offset.lat,
    ];

    await Vendor.findByIdAndUpdate(vendors[i]._id, {
      location: {
        type: 'Point',
        coordinates: coords,
      }
    });

    console.log(`✓ Updated vendor "${vendors[i].businessName}" → [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}]`);
    updated++;
  }

  console.log(`\n✅ Done — updated ${updated} vendors with Jimma-area coordinates`);
  console.log('Now reload the Near Me section — products should appear within 50km');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});