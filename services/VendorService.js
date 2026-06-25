const Product = require('../models/Product');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const notificationService = require('./notificationService');

class VendorService {
    /**
     * Updates Vendor Rank based on performance stats and notifies the user.
     * This uses the specialized notification function created in the notificationService.
     */
    async updateVendorRank(vendorInstance, io) {
        const stats = await this.getStats(vendorInstance._id);
        const currentRank = vendorInstance.rank || 'Bronze';
        let newRank = currentRank;

        // Logic: Thresholds for rank progression
        if (stats.totalRevenue >= 10000 || stats.totalItemsSold >= 500) {
            newRank = 'Platinum';
        } else if (stats.totalRevenue >= 5000 || stats.totalItemsSold >= 100) {
            newRank = 'Gold Seller';
        } else if (stats.totalRevenue >= 1000) {
            newRank = 'Silver';
        }

        // Only update and notify if a rank-up occurred
        if (newRank !== currentRank) {
            vendorInstance.rank = newRank;
            await vendorInstance.save();

            await notificationService.sendVendorRankNotification({
                io: io,
                vendorEmail: vendorInstance.contactEmail,
                userId: vendorInstance.user, // The owner's user ID
                newRank: newRank
            });

            return { updated: true, rank: newRank };
        }

        return { updated: false, rank: currentRank };
    }

async getStats(vendorId) {
    // 1. Keep your existing aggregation exactly as it is
    const stats = await Order.aggregate([
        { $unwind: "$orderItems" },
        { $match: { "orderItems.vendor": new mongoose.Types.ObjectId(vendorId) } },
        {
            $group: {
                _id: vendorId,
                totalOrders: { $sum: 1 },
                totalItemsSold: { $sum: "$orderItems.quantity" },
                totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
                netEarnings: { $sum: "$orderItems.vendorEarnings" },
                pendingEarnings: {
                    $sum: { $cond: [{ $ne: ["$status", "delivered"] }, "$orderItems.vendorEarnings", 0] }
                }
            }
        }
    ]);

    // 2. Add this specific line to count your products
    const totalProducts = await Product.countDocuments({ vendor: vendorId });

    // 3. Merge the product count into  existing return object
    const result = stats[0] || { 
        totalOrders: 0, 
        totalItemsSold: 0, 
        totalRevenue: 0, 
        netEarnings: 0, 
        pendingEarnings: 0 
    };

    return {
        ...result,
        totalProducts 
    };
}

async updateProfile(vendorInstance, updateData, files) {
        // 1. Added taxId, faydaNumber, and licenseNumber to the allowed fields array
        const fields = [
            'businessName', 'description', 'businessAddress', 'contactEmail', 
            'contactPhone', 'logo', 'taxId', 'faydaNumber', 'licenseNumber'
        ];
        
        fields.forEach(field => { 
            if (updateData[field] !== undefined) vendorInstance[field] = updateData[field]; 
        });

        // 2. Process newly uploaded verification documents
        if (files) {
            const newDocs = [];
            
            if (files.faydaDoc && files.faydaDoc[0]) {
                newDocs.push({ type: 'fayda_card', fileUrl: files.faydaDoc[0].path });
            }
            if (files.taxDoc && files.taxDoc[0]) {
                newDocs.push({ type: 'tin_certificate', fileUrl: files.taxDoc[0].path });
            }
            if (files.licenseDoc && files.licenseDoc[0]) {
                newDocs.push({ type: 'trade_license', fileUrl: files.licenseDoc[0].path });
            }

            if (newDocs.length > 0) {
                // Ensure the documents array exists, then push new documents
                if (!vendorInstance.verification.documents) {
                    vendorInstance.verification.documents = [];
                }
                vendorInstance.verification.documents.push(...newDocs);
                
                // Automatically set status to pending review when new docs are uploaded
                vendorInstance.verification.status = 'pending';
            }
        }

        return await vendorInstance.save();
    }

    async getProducts(vendorId, { skip, pageSize }) {
        const filter = { vendor: vendorId };
        const products = await Product.find(filter)
            .populate('category', 'name')
            .skip(skip)
            .limit(pageSize)
            .sort({ createdAt: -1 });
        const total = await Product.countDocuments(filter);
        return { products, total };
    }

    async addProduct(vendorUserId, data, filePath) {
        const vendor = await Vendor.findOne({ user: vendorUserId });
        if (!vendor) throw new Error('Vendor profile not found.');
        const productData = { ...data, vendor: vendor._id };
        if (filePath) productData.image = filePath;
        return await Product.create(productData);
    }

    async updateProduct(productId, vendorId, data) {
        const product = await Product.findOneAndUpdate(
            { _id: productId, vendor: vendorId }, 
            data, 
            { new: true }
        );
        if (!product) throw new Error('Product not found or unauthorized');
        return product;
    }

    async deleteProduct(productId, vendorId) {
        return await Product.findOneAndDelete({ _id: productId, vendor: vendorId });
    }

    async getOrders(vendorId, { skip, pageSize }) {
        const orders = await Order.find({ 'orderItems.vendor': vendorId })
            .populate('user', 'name')
            .skip(skip)
            .limit(pageSize)
            .sort({ createdAt: -1 });
        
        const total = await Order.countDocuments({ 'orderItems.vendor': vendorId });
        
        const ordersWithVendorTotals = orders.map(order => ({
            ...order.toObject(),
            vendorItems: order.orderItems.filter(i => i.vendor.toString() === vendorId.toString()),
            myTotalEarnings: order.orderItems
                .filter(i => i.vendor.toString() === vendorId.toString())
                .reduce((a, b) => a + b.vendorEarnings, 0)
        }));

        return { orders: ordersWithVendorTotals, total };
    }

    async getTransactions(walletId, { skip, pageSize }) {
        const transactions = await Transaction.find({ wallet: walletId })
            .skip(skip)
            .limit(pageSize)
            .sort({ createdAt: -1 });
        const total = await Transaction.countDocuments({ wallet: walletId });
        return { transactions, total };
    }
}

module.exports = new VendorService();