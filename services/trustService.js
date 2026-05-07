const User = require('../models/User');

class TrustService {
    async updateTrustScore(userId) {
        const user = await User.findById(userId);
        if (!user) return;

        const metrics = user.reputation?.metrics || {};
        
        // --- Pillar 1: Reliability (Recent Weighted) ---
        const total = (metrics.successfulOrders || 0) + (metrics.cancelledOrders || 0);
        const reliabilityFactor = total > 0 ? (metrics.successfulOrders / total) * 35 : 15;

        // --- Pillar 2: Sentiment ---
        const sentimentFactor = (metrics.totalReviews || 0) > 0 ? (metrics.positiveFeedbackRatio * 35) : 15;

        // --- Pillar 3: Speed (Moving Average) ---
        let speedFactor = 0;
        const avgHours = metrics.averageDeliveryHours || 0;
        if (avgHours > 0) {
            if (avgHours <= 24) speedFactor = 20;
            else if (avgHours <= 72) speedFactor = 10;
            else speedFactor = 5;
        } else {
            speedFactor = 10;
        }

        // --- Pillar 4: Verification ---
        const verificationFactor = user.isEmailVerified ? 10 : 0;

        // --- THE RECENCY BIAS (Performance Decay) ---
        // If the last order was more than 30 days ago, reduce score by 10% 
        // to encourage consistent activity.
        let decayPenalty = 0;
        if (metrics.lastOrderDate) {
            const daysSinceLastOrder = (new Date() - new Date(metrics.lastOrderDate)) / (1000 * 60 * 60 * 24);
            if (daysSinceLastOrder > 30) {
                decayPenalty = 10; 
            }
        }

        let finalScore = reliabilityFactor + sentimentFactor + speedFactor + verificationFactor - decayPenalty;

        // Clamp and Rank
        user.reputation.score = Math.min(Math.max(Math.round(finalScore), 0), 100);
        this._updateRank(user);

        await user.save();
        return user.reputation;
    }

    _updateRank(user) {
        const score = user.reputation.score;
        if (score >= 90) user.reputation.rank = 'Legendary';
        else if (score >= 75) user.reputation.rank = 'Elite';
        else if (score >= 50) user.reputation.rank = 'Trusted';
        else if (score >= 25) user.reputation.rank = 'Starter';
        else user.reputation.rank = 'Unverified';
    }
}

module.exports = new TrustService();