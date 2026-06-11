const Product = require('../models/Product');
const Vendor  = require('../models/Vendor');
const User    = require('../models/User');

// ─── Helper: build $near stage from coordinates ───────────────────────────────
const buildProximityFilter = (lng, lat, maxDistanceKm = 50) => ({
  $near: {
    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
    $maxDistance: maxDistanceKm * 1000  // convert km → metres
  }
});

// @desc  Save / update the customer's current coordinates
// @route PUT /api/search/location   (protected)
const updateUserLocation = async (req, res) => {
  try {
    const { lng, lat } = req.body;
    if (!lng || !lat) return res.status(400).json({ success:false, message:'lng and lat are required' });

    await User.findByIdAndUpdate(req.user._id || req.user.id, {
      location: { type:'Point', coordinates:[parseFloat(lng), parseFloat(lat)] }
    });

    res.json({ success:true, message:'Location updated' });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

// @desc  Trust + Proximity weighted product search
// @route GET /api/search?q=&category=&minPrice=&maxPrice=&lng=&lat=&radius=&page=&limit=
const trustWeightedSearch = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query;
    const page        = parseInt(req.query.page)   || 1;
    const limit       = parseInt(req.query.limit)  || 12;
    const radiusKm    = parseFloat(req.query.radius) || 50;
    const skip        = (page - 1) * limit;

    // Resolve coordinates — prefer query params, fall back to saved user location
    let lng = req.query.lng ? parseFloat(req.query.lng) : null;
    let lat = req.query.lat ? parseFloat(req.query.lat) : null;

    if ((!lng || !lat) && req.user) {
      const user = await User.findById(req.user._id || req.user.id).select('location');
      if (user?.location?.coordinates?.[0]) {
        [lng, lat] = user.location.coordinates;
      }
    }

    // ── Step 1: find nearby vendors (if coordinates available) ───────────────
    let nearbyVendorIds    = null;   // null = no proximity filter
    let vendorDistanceMap  = {};     // vendorId → distance rank

    if (lng && lat) {
      const nearbyVendors = await Vendor.find({
        location: buildProximityFilter(lng, lat, radiusKm)
      }).select('_id').lean();

      nearbyVendorIds = nearbyVendors.map(v => v._id);

      // Build a rank map so we can sort by distance later
      nearbyVendors.forEach((v, i) => { vendorDistanceMap[v._id.toString()] = i; });
    }

    // ── Step 2: product match stage ──────────────────────────────────────────
    const matchStage = {};
    if (q) matchStage.$text = { $search: q };
    if (category) matchStage.category = require('mongoose').Types.ObjectId.isValid(category)
      ? new (require('mongoose').Types.ObjectId)(category) : category;
    if (minPrice || maxPrice) {
      matchStage.price = {};
      if (minPrice) matchStage.price.$gte = Number(minPrice);
      if (maxPrice) matchStage.price.$lte = Number(maxPrice);
    }
    // Only include products from nearby vendors when proximity is active
    if (nearbyVendorIds !== null) matchStage.vendor = { $in: nearbyVendorIds };

    // ── Step 3: aggregation pipeline ─────────────────────────────────────────
    const pipeline = [
      { $match: matchStage },
      // Join vendor profile for trust score
      {
        $lookup: {
          from:         'vendors',
          localField:   'vendor',
          foreignField: '_id',
          as:           'vendorProfile'
        }
      },
      { $unwind: { path: '$vendorProfile', preserveNullAndEmptyArrays: true } },
      // Join category name
      {
        $lookup: {
          from:         'categories',
          localField:   'category',
          foreignField: '_id',
          as:           'categoryInfo'
        }
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      // Compute composite score
      {
        $addFields: {
          relevanceScore: q ? { $meta:"textScore" } : 1,
          trustScore: {
            $add: [
              { $multiply: [{ $ifNull:["$vendorProfile.reputation.score", 0] }, 0.4] },
              { $cond:[{ $eq:["$vendorProfile.isVerified", true] }, 25, 0] },
              { $multiply:["$averageRating", 2] }
            ]
          },
          // Distance rank from vendorDistanceMap (injected below via $addFields after $lookup)
          vendorId: "$vendor"
        }
      },
      { $sort: { relevanceScore:-1, trustScore:-1 } },
      { $skip: skip },
      { $limit: limit },
      // Shape the response
      {
        $project: {
          _id:1, name:1, description:1, price:1, stock:1,
          image:1, averageRating:1, totalReviews:1, tags:1,
          createdAt:1,
          category: { _id:"$categoryInfo._id", name:"$categoryInfo.name" },
          vendor: {
            _id:  "$vendorProfile._id",
            name: "$vendorProfile.businessName",
            isVerified: "$vendorProfile.isVerified",
            trustScore: "$trustScore",
            rank: "$vendorProfile.reputation.rank",
            city: "$vendorProfile.businessAddress.city"
          }
        }
      }
    ];

    const [products, total] = await Promise.all([
      Product.aggregate(pipeline),
      Product.countDocuments(matchStage),
    ]);

    // ── Step 4: inject distance rank + sort by proximity first ───────────────
    let enriched = products;
    if (nearbyVendorIds !== null && Object.keys(vendorDistanceMap).length > 0) {
      enriched = products
        .map(p => ({
          ...p,
          _distanceRank: vendorDistanceMap[p.vendor?._id?.toString()] ?? 9999
        }))
        .sort((a, b) => a._distanceRank - b._distanceRank)
        .map(({ _distanceRank, ...p }) => p);
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      proximity: lng && lat ? { enabled:true, lng, lat, radiusKm } : { enabled:false },
      pagination: { page, limit, total, pages: totalPages },
      data: enriched
    });

  } catch (err) {
    console.error('[Search Error]', err);
    res.status(500).json({ success:false, message:err.message });
  }
};

module.exports = { trustWeightedSearch, updateUserLocation };