const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/notesController');

// ── STUDENT NOTES ────────────────────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(ctrl.getNotes));
router.post('/', authenticate, asyncHandler(ctrl.createNote));
router.put('/:id', authenticate, asyncHandler(ctrl.updateNote));
router.delete('/:id', authenticate, asyncHandler(ctrl.deleteNote));

module.exports = router;
