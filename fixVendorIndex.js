/**
 * fixVendorIndex.js
 * Run once to ensure the 2dsphere index exists on Vendor.location
 * and verify vendors have correct coordinates.
 * 
 * Usage: node fixVendorIndex.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const vendorCol = db.collection('vendors');

  // 1. Check existing indexes
  console.log('=== Current indexes on vendors collection ===');
  const indexes = await vendorCol.indexes();
  indexes.forEach(idx => console.log(' -', JSON.stringify(idx.key), idx.name));
  console.log('');

  // 2. Check if 2dsphere index exists on location
  const has2dsphere = indexes.some(idx =>
    idx.key && (idx.key['location'] === '2dsphere' || idx.key['location.coordinates'] === '2dsphere')
  );

  if (!has2dsphere) {
    console.log('⚠️  No 2dsphere index found — creating it now...');
    await vendorCol.createIndex({ location: '2dsphere' });
    console.log('✅ 2dsphere index created on vendors.location\n');
  } else {
    console.log('✅ 2dsphere index already exists\n');
  }

  // 3. Verify vendors have correct location structure
  console.log('=== Vendor location check ===');
  const vendors = await vendorCol.find({}).toArray();
  let valid = 0, invalid = 0;

  for (const v of vendors) {
    const loc = v.location;
    const coords = loc?.coordinates;
    const isValid = loc?.type === 'Point' &&
                    Array.isArray(coords) &&
                    coords.length === 2 &&
                    coords[0] !== 0 && coords[1] !== 0 &&
                    !isNaN(coords[0]) && !isNaN(coords[1]);

    if (isValid) {
      console.log(`✅ ${v.businessName} → [${coords[0]}, ${coords[1]}]`);
      valid++;
    } else {
      console.log(`❌ ${v.businessName} → INVALID:`, JSON.stringify(loc));
      // Fix it
      await vendorCol.updateOne(
        { _id: v._id },
        { $set: { location: { type: 'Point', coordinates: [36.8331, 7.6780] } } }
      );
      console.log(`   ↳ Fixed to Jimma center coordinates`);
      invalid++;
    }
  }

  console.log(`\n📊 ${valid} valid, ${invalid} fixed`);

  // 4. Test the $near query directly
  console.log('\n=== Testing $near query (50km from Jimma) ===');
  const nearby = await vendorCol.find({
    location: {
      $near: {
        $geometry: { type:'Point', coordinates:[36.8431, 7.6975] },
        $maxDistance: 50000,
      }
    }
  }).toArray();
  console.log(`🎯 $near query returned ${nearby.length} vendors:`);
  nearby.forEach(v => console.log(` - ${v.businessName} @ [${v.location?.coordinates}]`));

  if (nearby.length === 0) {
    console.log('\n⚠️  Still 0 results. Dropping and recreating the index...');
    await vendorCol.dropIndex('location_2dsphere').catch(() => {});
    await vendorCol.createIndex({ location: '2dsphere' });
    console.log('✅ Index recreated. Try the Near Me search again.');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

fix().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});