const express = require('express');
const router = express.Router();
const { trustWeightedSearch } = require('../controller/searchController');
/**
 * @openapi
 * tags:
 *   name: Search
 *   description: Advanced discovery using trust-weighted algorithms
 */

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Perform a trust-weighted product search
 *     description: Returns products ranked by relevance and vendor credibility/trust scores.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         description: Search keyword
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
// Public route - anyone can search
router.get('/', trustWeightedSearch);

module.exports = router;