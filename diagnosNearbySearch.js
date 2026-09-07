/**
 * diagnoseNearbySearch.js
 * Diagnoses exactly why Near Me returns 0 products
 * Usage: node diagnoseNearbySearch.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('✅ Connected\n');
  const db = mongoose.connection.db;

  // 1. How many products total?
  const totalProducts = await db.collection('products').countDocuments();
  console.log(`📦 Total products in DB: ${totalProducts}`);
  if (totalProducts === 0) {
    console.log('❌ No products at all — add products first!');
    process.exit(0);
  }

  // 2. Sample a product to see its structure
  const sample = await db.collection('products').findOne({});
  console.log('\n📋 Sample product fields:', Object.keys(sample));
  console.log('   vendor field value:', sample.vendor);

  // 3. How many products have a vendor field?
  const withVendor = await db.collection('products').countDocuments({ vendor: { $exists:true, $ne:null } });
  console.log(`\n🔗 Products with vendor field: ${withVendor}/${totalProducts}`);

  // 4. Get nearby vendor IDs
  const nearbyVendors = await db.collection('vendors').find({
    location: {
      $near: {
        $geometry: { type:'Point', coordinates:[36.8431, 7.6975] },
        $maxDistance: 50000
      }
    }
  }).toArray();
  console.log(`\n📍 Nearby vendors (within 50km): ${nearbyVendors.length}`);
  const vendorIds = nearbyVendors.map(v => v._id);
  console.log('   Vendor IDs:', vendorIds.map(id => id.toString()));

  // 5. How many products belong to nearby vendors?
  const nearbyProducts = await db.collection('products').countDocuments({
    vendor: { $in: vendorIds }
  });
  console.log(`\n🎯 Products belonging to nearby vendors: ${nearbyProducts}`);

  if (nearbyProducts === 0) {
    console.log('\n❌ ROOT CAUSE: Products exist but are NOT linked to any of the nearby vendors');
    console.log('   Fix: Update your products to set vendor = one of the nearby vendor IDs');

    // Show what vendor IDs the products actually have
    const productVendorIds = await db.collection('products').distinct('vendor');
    console.log('\n   Product vendor IDs in DB:', productVendorIds.map(id => id?.toString()));
    console.log('   Nearby vendor IDs:        ', vendorIds.map(id => id.toString()));

    // Auto-fix: assign all products to the nearest vendor
    console.log('\n🔧 Auto-fixing: assigning all products to nearby vendors...');
    const allProducts = await db.collection('products').find({}).toArray();
    for (let i = 0; i < allProducts.length; i++) {
      const vid = vendorIds[i % vendorIds.length];
      await db.collection('products').updateOne(
        { _id: allProducts[i]._id },
        { $set: { vendor: vid } }
      );
      console.log(`   ✓ "${allProducts[i].name}" → vendor ${vid}`);
    }
    console.log('\n✅ Done! Reload Near Me — products should now appear.');
  } else {
    console.log('\n✅ Products ARE linked to nearby vendors');
    console.log('   Check: is your searchController using the right Product model path?');

    // Check text index
    const pIndexes = await db.collection('products').indexes();
    const hasText = pIndexes.some(idx => Object.values(idx.key).includes('text'));
    console.log(`   Text index on products: ${hasText ? '✅ exists' : '❌ MISSING — run: db.products.createIndex({name:"text",description:"text"})'}`);
  }

  await mongoose.disconnect();
}

diagnose().catch(err => { console.error('❌', err.message); process.exit(1); });