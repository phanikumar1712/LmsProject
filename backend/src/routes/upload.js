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
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for general uploads (videos)
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

router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw createError('No file uploaded', 400);

    const isVideo = req.file.mimetype.startsWith('video/');

    // Cloudinary resource_type: 'auto' is generally best
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
