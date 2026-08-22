const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/notesController');

// ── STUDENT BOOKMARKS ────────────────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(ctrl.getBookmarks));
router.post('/toggle', authenticate, asyncHandler(ctrl.toggleBookmark));

module.exports = router;
