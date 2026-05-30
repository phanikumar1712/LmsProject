const router = require('express').Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { createError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Configure Cloudinary only if credentials exist
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const storage = multer.memoryStorage();

const uploadGeneral = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for general uploads (videos)
});

const uploadProfilePhoto = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for profile photos
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for profile photos'), false);
        }
    }
});

const uploadToCloudinary = (fileBuffer, options) => {
    return new Promise((resolve, reject) => {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return reject(new Error('Cloudinary credentials are not configured in the backend .env file. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'));
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        uploadStream.end(fileBuffer);
    });
};

// POST /api/upload/profile-photo — Any authenticated user can upload a profile photo
router.post('/profile-photo', authenticate, uploadProfilePhoto.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw createError('No file uploaded', 400);

    const options = {
        resource_type: 'image',
        folder: 'lms_profile_photos',
        transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
        ]
    };

    const result = await uploadToCloudinary(req.file.buffer, options);

    res.json({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        resource_type: result.resource_type
    });
}));

// POST /api/upload — Instructors / Admins can upload course media
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), uploadGeneral.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw createError('No file uploaded', 400);

    const isVideo = req.file.mimetype.startsWith('video/');

    const options = {
        resource_type: isVideo ? 'video' : 'auto',
        folder: 'lms_uploads'
    };

    const result = await uploadToCloudinary(req.file.buffer, options);

    res.json({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        resource_type: result.resource_type
    });
}));

module.exports = router;
