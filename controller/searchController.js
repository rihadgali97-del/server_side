const Product = require('../models/Product');
const Vendor = require('../models/Vendor');

// @desc    Dedicated Trust-Weighted & Proximity Search
// @route   GET /api/search
const trustWeightedSearch = async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, sort, lng, lat, maxDistanceKm } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // 1. Check if Geospatial parameters are present
        const hasCoords = lng && lat;

        let pipeline = [];

        if (hasCoords) {
            // Geospatial search must start from Vendor collection because it holds the 2dsphere index
            const maxDistanceMeters = maxDistanceKm ? parseFloat(maxDistanceKm) * 1000 : 50000; // Default 50km radius
            
            // Build matching parameters for the geoNear query filter
            let geoQuery = { isVerified: true }; // Target vendors verified by administration
            if (category) geoQuery.category = category;

            pipeline.push({
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    distanceField: "distanceFromCustomer", // Outbound distance in meters
                    spherical: true,
                    maxDistance: maxDistanceMeters,
                    query: geoQuery
                }
            });

            // Join with Products owned by these nearby vendors
            pipeline.push({
                $lookup: {
                    from: 'products',
                    localField: 'user', // Vendor.user holds the product's owner ID
                    foreignField: 'vendor',
                    as: 'productDetails'
                }
            });
            
            pipeline.push({ $unwind: '$productDetails' });
            
            // Project into product-first layout to maintain consistency with standard search responses
            pipeline.push({
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: ["$productDetails", { 
                            vendorProfile: {
                                isVerified: "$isVerified",
                                reputation: "$reputation"
                            },
                            distanceInKm: { $divide: ["$distanceFromCustomer", 1000] }
                        }]
                    }
                }
            });

            // If a text search string 'q' exists during proximity filtering, handle it via a text match regex stage
            if (q) {
                pipeline.push({
                    $match: {
                        $or: [
                            { name: { $regex: q, $options: "i" } },
                            { description: { $regex: q, $options: "i" } }
                        ]
                    }
                });
            }

        } else {
            // Standard Text / Non-Geospatial Product-First Search Fallback
            let matchStage = {};
            if (q) matchStage.$text = { $search: q };
            if (category) matchStage.category = category;

            pipeline.push({ $match: matchStage });

            pipeline.push({
                $lookup: {
                    from: 'vendors',
                    localField: 'vendor',
                    foreignField: 'user',
                    as: 'vendorProfile'
                }
            });
            pipeline.push({ $unwind: { path: '$vendorProfile', preserveNullAndEmptyArrays: true } });
        }

        // 2. Dynamic Price Filtering Stage
        if (minPrice || maxPrice) {
            let priceFilter = {};
            if (minPrice) priceFilter.$gte = parseFloat(minPrice);
            if (maxPrice) priceFilter.$lte = parseFloat(maxPrice);
            pipeline.push({ $match: { price: priceFilter } });
        }

        // 3. Calculate Trust, Relevance, and Proximity Penalties/Boosts
        pipeline.push({
            $addFields: {
                relevanceScore: (q && !hasCoords) ? { $meta: "textScore" } : 1,
                // Proximity weight factor calculation
                proximityBoost: hasCoords 
                    ? { $multiply: [{ $max: [0, { $subtract: [50, "$distanceInKm"] }] }, 0.5] } // Closer vendors get up to 25 extra points
                    : 0,
                trustScore: {
                    $add: [
                        { $multiply: [{ $ifNull: ["$vendorProfile.reputation.score", 0] }, 0.4] },
                        { $cond: [{ $eq: ["$vendorProfile.isVerified", true] }, 25, 0] },
                        { $multiply: [{ $ifNull: ["$averageRating", 0] }, 2] }
                    ]
                }
            }
        });

        // 4. Incorporate Proximity into sorting strategy if active
        pipeline.push({
            $addFields: {
                finalRankScore: { $add: ["$trustScore", "$relevanceScore", "$proximityBoost"] }
            }
        });

        pipeline.push({ $sort: { finalRankScore: -1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        // Cleanup response array payload to preserve distance metric for UI layout tags
        pipeline.push({
            $project: {
                vendorProfile: 0,
                relevanceScore: 0,
                proximityBoost: 0,
                trustScore: 0,
                finalRankScore: 0
            }
        });

        const products = await Product.aggregate(pipeline);

        res.json({
            success: true,
            pagination: { page, limit },
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { trustWeightedSearch };