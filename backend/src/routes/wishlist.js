const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/wishlistController');

router.get('/', authenticate, asyncHandler(ctrl.getWishlist));
router.post('/toggle', authenticate, asyncHandler(ctrl.toggle));

module.exports = router;
