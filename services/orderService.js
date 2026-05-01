const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Wallet = require("../models/Wallet"); // Still needed for the Model reference
const Cart = require("../models/Cart");
const walletService = require("./WalletService"); // New Integration

class OrderService {
    /**
     * Trust Engine Logic - Hardened for Data Integrity
     */
    calculateReputation = async (entity, type = 'user', session = null) => {
        try {
            if (!entity.reputation || !entity.reputation.metrics) {
                entity.reputation = entity.reputation || {};
                entity.reputation.metrics = type === 'user' 
                    ? { successfulOrders: 0, cancelledOrders: 0 }
                    : { successfulFulfillments: 0, cancelledByVendor: 0 };
            }

            const metrics = entity.reputation.metrics;
            const success = type === 'user' ? (metrics.successfulOrders || 0) : (metrics.successfulFulfillments || 0);
            const fail = type === 'user' ? (metrics.cancelledOrders || 0) : (metrics.cancelledByVendor || 0);
            
            const total = success + fail;
            let score = 20; 

            if (total > 0) score += (success / total) * 60;
            if (entity.isVerified || (entity.role === 'admin')) score += 20;

            const finalScore = Math.min(Math.round(score), 100);
            let finalRank = "New";

            if (finalScore >= 85) finalRank = "Legendary";
            else if (finalScore >= 60) finalRank = type === 'user' ? "Elite" : "Top-Rated";
            else if (finalScore >= 35) finalRank = type === 'user' ? "Trusted" : "Verified";

            const Model = type === 'user' ? User : Vendor;

            await Model.findByIdAndUpdate(
                entity._id,
                {
                    $set: {
                        "reputation.score": finalScore,
                        "reputation.rank": finalRank,
                        "reputation.metrics": metrics 
                    }
                },
                { session, new: true }
            );
        } catch (err) {
            console.error(`[TrustEngine Critical Error]: ${err.message}`);
        }
    };

    async createOrder(orderData, userId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { orderItems, shippingAddress, paymentMethod, totalPrice } = orderData;
            const processedItems = [];

            for (const item of orderItems) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.product, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } },
                    { session, new: true }
                );

                if (!product) throw new Error(`Insufficient stock for ${item.name}`);

                const earnings = (item.price * item.quantity) * 0.90; 
                processedItems.push({
                    product: item.product, 
                    name: item.name, 
                    quantity: item.quantity,
                    price: item.price, 
                    vendor: product.vendor, 
                    vendorEarnings: earnings, 
                    commissionAmount: (item.price * item.quantity) * 0.10,
                    image: item.image || "/placeholder.jpg"
                });

                if (paymentMethod !== 'cash') {
                    // Integration: Use WalletService to handle escrow
                    await walletService.addPendingFunds(product.vendor, earnings, 'ETB', session);
                }
            }

            const order = new Order({
                user: userId, 
                orderItems: processedItems, 
                shippingAddress,
                paymentMethod: paymentMethod || "cash", 
                totalPrice,
                status: "pending", 
                isPaid: paymentMethod !== 'cash'
            });

            const savedOrder = await order.save({ session });
            await Cart.findOneAndUpdate({ user: userId }, { items: [] }, { session });

            await session.commitTransaction();
            return { success: true, order: savedOrder };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async updateStatus(orderId, newStatus) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const order = await Order.findById(orderId).session(session);
            if (!order) throw new Error("Order not found");

            const oldStatus = order.status;
            const normalizedNewStatus = newStatus.toLowerCase();

            if (normalizedNewStatus === "delivered" && oldStatus !== "delivered") {
                for (let item of order.orderItems) {
                    // Integration: Release Escrow via WalletService
                    await walletService.releasePendingFunds(
                        item.vendor, 
                        item.vendorEarnings, 
                        'ETB', 
                        order._id, 
                        item.name, 
                        session
                    );
                    
                    // Reputation logic stays the same
                    const vendor = await Vendor.findOne({ 
                        $or: [{ _id: item.vendor }, { user: item.vendor }] 
                    }).session(session);

                    if (vendor) {
                        vendor.reputation = vendor.reputation || { metrics: {} };
                        vendor.reputation.metrics.successfulFulfillments = (vendor.reputation.metrics.successfulFulfillments || 0) + 1;
                        await this.calculateReputation(vendor, 'vendor', session);
                    }
                }

                const buyer = await User.findById(order.user).session(session);
                if (buyer) {
                    buyer.reputation = buyer.reputation || { metrics: {} };
                    buyer.reputation.metrics.successfulOrders = (buyer.reputation.metrics.successfulOrders || 0) + 1;
                    await this.calculateReputation(buyer, 'user', session);
                }
            }

            if (normalizedNewStatus === "cancelled" && oldStatus !== "cancelled") {
                const buyer = await User.findById(order.user).session(session);
                if (buyer) {
                    buyer.reputation = buyer.reputation || { metrics: {} };
                    buyer.reputation.metrics.cancelledOrders = (buyer.reputation.metrics.cancelledOrders || 0) + 1;
                    await this.calculateReputation(buyer, 'user', session);
                }
            }

            order.status = normalizedNewStatus;
            await order.save({ session });
            await session.commitTransaction();
            return order;
        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

module.exports = new OrderService();