// Vercel serverless function entry point.
//
// vercel.json rewrites every /api/* request to this function, which re-exports
// the same Express app used by the long-running server (backend/src/index.js).
// Vercel's Node runtime handles Express natively when the app is exported as
// the handler.
module.exports = require('../backend/src/app');