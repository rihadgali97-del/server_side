const express  = require('express');
const router   = express.Router();
const { trustWeightedSearch, updateUserLocation } = require('../controller/searchController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Trust + Proximity weighted product search
 *     tags: [Search]
 *     parameters:
 *       - { in: query, name: q,        schema: { type: string  }, description: "Keyword" }
 *       - { in: query, name: category,  schema: { type: string  }, description: "Category ID" }
 *       - { in: query, name: lng,       schema: { type: number  }, description: "Customer longitude" }
 *       - { in: query, name: lat,       schema: { type: number  }, description: "Customer latitude"  }
 *       - { in: query, name: radius,    schema: { type: number  }, description: "Search radius in km (default 50)" }
 *       - { in: query, name: minPrice,  schema: { type: number  } }
 *       - { in: query, name: maxPrice,  schema: { type: number  } }
 *       - { in: query, name: page,      schema: { type: integer } }
 *       - { in: query, name: limit,     schema: { type: integer } }
 *     responses:
 *       200: { description: Ranked product list }
 */
router.get('/', trustWeightedSearch);

/**
 * @openapi
 * /api/search/location:
 *   put:
 *     summary: Save customer's current GPS coordinates for proximity search
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lng, lat]
 *             properties:
 *               lng: { type: number, example: 38.7636 }
 *               lat: { type: number, example:  9.0054 }
 *     responses:
 *       200: { description: Location saved }
 */
router.put('/location', protect, updateUserLocation);

module.exports = router;