// backend/seedProducts.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product'); 

dotenv.config();

// Helper to safely generate or reuse a mock Vendor ObjectId
// Replace this with a real vendor ID from your database if you have one!
const fallbackVendorId = new mongoose.Types.ObjectId();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🌱 Connected to MongoDB successfully...");

    // 1. Find or create a dummy vendor so validation passes
    // If your User/Vendor model is named differently, we can just pass a valid ObjectId
    const vendorId = fallbackVendorId; 

    // 2. We need to handle the Category collection. 
    // Since Mongoose expects ObjectIds, let's look up your Category model or mock them inline.
    // If you have a Category model, we find or create them:
    let Category;
    try {
      Category = mongoose.model('Category');
    } catch {
      // If not registered, let's create a minimal inline schema definition just to fetch IDs
      Category = mongoose.model('Category', new mongoose.Schema({ name: String }));
    }

    const categoriesMap = {};
    const categoryNames = ["Electronics", "Automotive", "Apparel"];

    for (const name of categoryNames) {
      let cat = await Category.findOne({ name });
      if (!cat) {
        cat = await Category.create({ name });
      }
      categoriesMap[name] = cat._id;
    }

    // 3. Define the presentation products using the resolved ObjectIds and correct fields
    const presentationProducts = [
      {
        name: "MacBook Pro 16\" M3 Max",
        description: "Ultimate workstation for developers and creators. Liquid Retina XDR display, 36GB Unified Memory, Space Black finish.",
        price: 145000.00,
        category: categoriesMap["Electronics"], // Now a valid ObjectId!
        subCategory: "Laptops",
        brand: "Apple",
        stock: 8, // Fixed from countInStock
        vendor: vendorId, // Added required field
        images: [
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80"
        ],
        colors: ["Space Black", "Silver"],
        features: ["M3 Max Chip", "120Hz ProMotion Display"]
      },
      {
        name: "iPhone 15 Pro Max",
        description: "Titanium design, A17 Pro chip, customizable Action button, and the most powerful iPhone camera system ever.",
        price: 95000.00,
        category: categoriesMap["Electronics"],
        subCategory: "Phones",
        brand: "Apple",
        stock: 15,
        vendor: vendorId,
        images: [
          "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=800&auto=format&fit=crop&q=80"
        ],
        colors: ["Natural Titanium", "Black Titanium"],
        features: ["Titanium Frame", "5x Telephoto Camera"]
      },
      {
        name: "Tesla Model S Plaid",
        description: "Beyond Ludicrous. 1,020 horsepower electric supercar lifestyle luxury sedan. Ultra-low drag coefficient styling.",
        price: 4500000.00,
        category: categoriesMap["Automotive"],
        subCategory: "Electric Vehicles",
        brand: "Tesla",
        stock: 2,
        vendor: vendorId,
        images: [
          "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1536700503338-e5ba96e9440e?w=800&auto=format&fit=crop&q=80"
        ],
        colors: ["Solid Black", "Ultra Red"],
        features: ["0-60 mph in 1.99s", "Tri-Motor AWD"]
      },
      {
        name: "BMW M4 Competition Coupe",
        description: "High-performance sports coupe featuring aggressive styling, precision engineering, and twin-turbo track power.",
        price: 5200000.00,
        category: categoriesMap["Automotive"],
        subCategory: "Sports Cars",
        brand: "BMW",
        stock: 3,
        vendor: vendorId,
        images: [
          "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&auto=format&fit=crop&q=80"
        ],
        colors: ["Isle of Man Green", "Alpine White"],
        features: ["503 HP Twin-Turbo", "Carbon Fiber Roof"]
      },
      {
        name: "Premium Oversized Heavyweight Tee",
        description: "Crafted from 280GSM luxurious long-staple cotton. Perfect minimalist boxy drape built to survive endless washes.",
        price: 1200.00,
        category: categoriesMap["Apparel"],
        subCategory: "T-Shirts",
        brand: "NextCart Studio",
        stock: 50,
        vendor: vendorId,
        images: [
          "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80"
        ],
        colors: ["Vintage Off-White", "Midnight Black"],
        features: ["100% Organic Cotton", "280GSM Heavyweight Knit"]
      },
      {
        name: "Classic Wool Blend Tailored Overcoat",
        description: "Timeless cold-weather layering essential. Structured shoulder line, deep interior chest pockets, premium satin inner lining.",
        price: 8500.00,
        category: categoriesMap["Apparel"],
        subCategory: "Coats & Jackets",
        brand: "UrbanThread",
        stock: 12,
        vendor: vendorId,
        images: [
          "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&auto=format&fit=crop&q=80"
        ],
        colors: ["Classic Camel", "Charcoal Grey"],
        features: ["70% Virgin Wool Blend", "Insulated Satin Lining"]
      }
    ];

    // Clear old sample data if needed, then seed
    // await Product.deleteMany({}); 

    await Product.insertMany(presentationProducts);
    console.log("🎉 Database seeded perfectly with beautiful presentation items!");
    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedDB();