const User = require('../models/User');

class TrustService {
    /**
     * Recalculates trust score based on multiple pillars
     * @param {String} userId - The ID of the user/vendor
     */
    async updateTrustScore(userId) {
        const user = await User.findById(userId);
        if (!user) return;

        const { successfulOrders, cancelledOrders, totalReviews, positiveFeedbackRatio } = user.reputation.metrics;

        // Pillar 1: Reliability (Orders completed vs Cancelled)
        const totalAttempts = successfulOrders + cancelledOrders;
        const reliabilityFactor = totalAttempts > 0 ? (successfulOrders / totalAttempts) * 40 : 10;

        // Pillar 2: Community Sentiment (Reviews)
        const sentimentFactor = totalReviews > 0 ? (positiveFeedbackRatio * 40) : 0;

        // Pillar 3: Verification Bonus
        const verificationFactor = user.isEmailVerified ? 20 : 0;

        // Final Calculation
        let finalScore = reliabilityFactor + sentimentFactor + verificationFactor;

        // Penalty for high cancellation
        if (cancelledOrders > 5) finalScore -= 10;

        // Clamp score between 0 and 100
        user.reputation.score = Math.min(Math.max(Math.round(finalScore), 0), 100);
        
        // Update Rank based on Score
        this._updateRank(user);

        await user.save();
        return user.reputation;
    }

    _updateRank(user) {
        const score = user.reputation.score;
        if (score >= 90) user.reputation.rank = 'Legendary';
        else if (score >= 75) user.reputation.rank = 'Elite';
        else if (score >= 50) user.reputation.rank = 'Trusted';
        else if (score >= 20) user.reputation.rank = 'Starter';
        else user.reputation.rank = 'Unverified';
    }
}

module.exports = new TrustService();