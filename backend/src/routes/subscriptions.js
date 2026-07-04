const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/subscriptionsController');

// Subscription plans
router.get('/plans', asyncHandler(ctrl.getPlans));
router.post('/upgrade', authenticate, asyncHandler(ctrl.upgrade));
router.post('/plans', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createPlan));
router.put('/plans/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updatePlan));
router.delete('/plans/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deletePlan));

// Categories (nested here for convenience)
router.get('/categories', asyncHandler(ctrl.getCategories));
router.post('/categories', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createCategory));
router.delete('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteCategory));

module.exports = router;
