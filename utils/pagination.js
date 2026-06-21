function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginatedResponse(data, total, page, limit, extra = {}) {
  return {
    success: true,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    count: data.length,
    data,
    ...extra,
  };
}

module.exports = { parsePagination, buildPaginatedResponse };
