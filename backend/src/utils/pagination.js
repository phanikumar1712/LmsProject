/**
 * Formats pagination response
 * @param {number} total - Total items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object} Pagination object
 */
const getPagination = (total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    return {
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
};

module.exports = { getPagination };
