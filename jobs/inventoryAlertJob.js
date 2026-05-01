const cron = require('node-cron');
const Product = require('../models/Product');
const notificationService = require('../services/notificationService');

// Function to check for low inventory and send alerts
async function checkInventoryAlerts() {
    try {
        const products = await Product.find().populate({
            path: 'vendor',
            populate: {
                path: 'user',
                model: 'User'
            }
        }).populate('variants');

        const alerts = [];

        for (const product of products) {
            if (product.variants && product.variants.length > 0) {
                for (const variant of product.variants) {
                    if (variant.stock <= product.lowStockThreshold) {
                        if (product.vendor && product.vendor.user && product.vendor.user.role === 'vendor') {
                            await notificationService.createNotification({
                                userId: product.vendor.user._id,
                                title: 'Low Stock Alert',
                                message: `Variant of product "${product.name}" (${variant.size}, ${variant.color}) is running low on stock. Current stock: ${variant.stock}. Threshold: ${product.lowStockThreshold}. Please restock soon.`,
                                type: 'alert'
                            });
                            alerts.push(`${product.name} (${variant.size}, ${variant.color})`);
                        }
                    }
                }
            } else {
                if (product.stock <= product.lowStockThreshold) {
                    if (product.vendor && product.vendor.user && product.vendor.user.role === 'vendor') {
                        await notificationService.createNotification({
                            userId: product.vendor.user._id,
                            title: 'Low Stock Alert',
                            message: `Product "${product.name}" is running low on stock. Current stock: ${product.stock}. Threshold: ${product.lowStockThreshold}. Please restock soon.`,
                            type: 'alert'
                        });
                        alerts.push(product.name);
                    }
                }
            }
        }

        if (alerts.length > 0) {
            console.log(`Inventory alerts sent for: ${alerts.join(', ')}`);
        } else {
            console.log('No low stock products found.');
        }
    } catch (error) {
        console.error('Error in inventory alert job:', error);
    }
}

cron.schedule('0 9 * * *', () => {
    console.log('Running inventory alert job...');
    checkInventoryAlerts();
});

module.exports = { checkInventoryAlerts };
