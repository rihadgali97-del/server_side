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
    const { name, category, minPrice, maxPrice, all } = filters;

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

    if (all === 'true' && user && user.role === 'admin') {
        query = {};
    }

    return await Product.find(query)
        .populate("category", "name")
        .populate("vendor", "businessName");
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
    const { q, category, minPrice, maxPrice } = searchParams;
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

    const products = await Product.aggregate([
        { $match: queryFilter },
        {
            $lookup: {
                from: 'vendors',
                localField: 'vendor',
                foreignField: '_id',
                as: 'vendorDetails'
            }
        },
        { $unwind: '$vendorDetails' },
        {
            $addFields: {
                trustWeight: {
                    $add: [
                        { $multiply: ["$vendorDetails.reputation.score", 0.5] },
                        { $cond: ["$vendorDetails.isVerified", 20, 0] },
                        { $multiply: ["$averageRating", 5] }
                    ]
                },
                searchScore: { $meta: "textScore" }
            }
        },
        { $sort: { searchScore: { $meta: "textScore" }, trustWeight: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { vendorDetails: 0, searchScore: 0 } }
    ]);

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