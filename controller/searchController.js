const Product = require('../models/Product');

// @desc    Dedicated Trust-Weighted Search
// @route   GET /api/search
const trustWeightedSearch = async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, sort } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // Base search filter
        let matchStage = {};
        if (q) {
            matchStage.$text = { $search: q };
        }
        if (category) {
            matchStage.category = category;
        }

        const products = await Product.aggregate([
            { $match: matchStage },
            // Join with Vendor collection (User role check)
            {
                $lookup: {
                    from: 'vendors', 
                    localField: 'vendor',
                    foreignField: 'user', // Mapping Product.vendor (User ID) to Vendor.user
                    as: 'vendorProfile'
                }
            },
            { $unwind: { path: '$vendorProfile', preserveNullAndEmptyArrays: true } },
            // Calculate Trust & Relevance Score
            {
                $addFields: {
                    relevanceScore: q ? { $meta: "textScore" } : 1,
                    trustScore: {
                        $add: [
                            { $multiply: [{ $ifNull: ["$vendorProfile.reputation.score", 0] }, 0.4] }, // 40% weight to reputation
                            { $cond: [{ $eq: ["$vendorProfile.isVerified", true] }, 25, 0] },        // Verification boost
                            { $multiply: ["$averageRating", 2] }                                    // Product quality boost
                        ]
                    }
                }
            },
            // Sort by Relevance first, then Trust Score
            { $sort: { relevanceScore: -1, trustScore: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    vendorProfile: 0, // Keep response lean
                    relevanceScore: 0
                }
            }
        ]);

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