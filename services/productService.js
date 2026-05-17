const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const notificationService = require("../services/notificationService");

const createProduct = async (userId, body, filePath, io) => {
    const vendor = await Vendor.findOne({ user: userId }).populate('user');
    if (!vendor) throw new Error("Vendor profile not found.");

    const productData = { ...body, vendor: vendor._id };
    if (filePath) productData.image = filePath;

    const product = await Product.create(productData);

    // REAL-TIME CHECK: Low Stock
    if (product.stock <= (product.lowStockThreshold || 5)) {
        await notificationService.sendLowStockAlert({
            io,
            vendorEmail: vendor.user.email,
            userId: vendor.user._id,
            product
        });
    }
    return product;
};

const fetchProducts = async (filters, user) => {
    let query = {};
    const { name, category, minPrice, maxPrice, all, lng, lat } = filters;

    if (name) query.name = { $regex: name, $options: "i" };
    if (category) query.category = category;
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Role-based filtering logic
    if (user && user.role === 'vendor') {
        const vendor = await Vendor.findOne({ user: user.id });
        if (vendor) query.vendor = vendor._id;
        else return []; // Return empty if vendor profile missing
    }

    // Geospatial filter for standard customer views
    let nearbyVendorIds = [];
    if (lng && lat && !(user && user.role === 'vendor')) {
        const sortedVendors = await Vendor.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }
                }
            }
        }).select('_id').lean();
        
        nearbyVendorIds = sortedVendors.map(v => v._id);
        query.vendor = { $in: nearbyVendorIds };
    }

    if (all === 'true' && user && user.role === 'admin') {
        query = {};
    }

    let products = await Product.find(query)
        .populate("category", "name")
        .populate("vendor", "businessName");

    // Preserve physical proximity sort order for basic find results
    if (nearbyVendorIds.length > 0) {
        const idOrder = nearbyVendorIds.map(id => id.toString());
        products.sort((a, b) => {
            const indexA = a.vendor ? idOrder.indexOf(a.vendor._id.toString()) : -1;
            const indexB = b.vendor ? idOrder.indexOf(b.vendor._id.toString()) : -1;
            return (indexA === -1 ? Infinity : indexA) - (indexB === -1 ? Infinity : indexB);
        });
    }

    return products;
};

const updateProductData = async (id, body, io) => {
    const product = await Product.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!product) throw new Error("Product not found");

    // REAL-TIME CHECK: Low Stock during update
    if (product.stock <= (product.lowStockThreshold || 5)) {
        const vendor = await Vendor.findById(product.vendor).populate('user');
        await notificationService.sendLowStockAlert({
            io,
            vendorEmail: vendor.user.email,
            userId: vendor.user._id,
            product
        });
    }
    return product;
};

const fetchProductById = async (id) => {
    return await Product.findById(id).populate("category", "name");
};

const removeProduct = async (id) => {
    return await Product.findByIdAndDelete(id);
};

const executeTrustSearch = async (searchParams) => {
    const { q, category, minPrice, maxPrice, lng, lat } = searchParams;
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 12;
    const skip = (page - 1) * limit;

    let queryFilter = {};
    if (q) queryFilter.$text = { $search: q };
    if (category) queryFilter.category = category;
    if (minPrice || maxPrice) {
        queryFilter.price = {};
        if (minPrice) queryFilter.price.$gte = Number(minPrice);
        if (maxPrice) queryFilter.price.$lte = Number(maxPrice);
    }

    // 1. Fetch vendors ordered by proximity if coordinates are supplied
    let nearbyVendorIds = [];
    if (lng && lat) {
        const vendors = await Vendor.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }
                }
            }
        }).select('_id').lean();
        
        nearbyVendorIds = vendors.map(v => v._id);
        queryFilter.vendor = { $in: nearbyVendorIds };
    }

    // 2. Formulate aggregation steps
    const pipeline = [
        { $match: queryFilter },
        {
            $lookup: {
                from: 'vendors',
                localField: 'vendor',
                foreignField: '_id',
                as: 'vendorDetails'
            }
        },
        { $unwind: '$vendorDetails' }
    ];

    // 3. Inject dynamic fields (Trust, Text matching score, and Proximity rankings)
    const addFieldsData = {
        trustWeight: {
            $add: [
                { $multiply: [{ $ifNull: ["$vendorDetails.reputation.score", 0] }, 0.5] },
                { $cond: ["$vendorDetails.isVerified", 20, 0] },
                { $multiply: ["$averageRating", 5] }
            ]
        }
    };

    if (q) {
        addFieldsData.searchScore = { $meta: "textScore" };
    }

    if (nearbyVendorIds.length > 0) {
        addFieldsData.distanceRank = { $indexOfArray: [nearbyVendorIds, "$vendor"] };
    }

    pipeline.push({ $addFields: addFieldsData });

    // 4. Multi-layered Sorting
    const sortCriteria = {};
    if (nearbyVendorIds.length > 0) {
        sortCriteria.distanceRank = 1; 
    }
    if (q) {
        sortCriteria.searchScore = { $meta: "textScore" };
    }
    sortCriteria.trustWeight = -1;

    pipeline.push({ $sort: sortCriteria });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    pipeline.push({ $project: { vendorDetails: 0, searchScore: 0, distanceRank: 0 } });

    const products = await Product.aggregate(pipeline);
    const total = await Product.countDocuments(queryFilter);

    return { products, total, page, limit };
};

module.exports = {
    createProduct,
    fetchProducts,
    updateProductData,
    fetchProductById,
    removeProduct,
    executeTrustSearch
};