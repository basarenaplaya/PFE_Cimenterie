function buildPaginationMeta({ page, limit, totalItems, itemCount }) {
  const safeTotal = Number.isFinite(totalItems) ? totalItems : 0;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const pages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    itemCount: Number.isFinite(itemCount) ? itemCount : 0,
    totalItems: safeTotal,
    totalPages: pages,
    hasPrevPage: safePage > 1,
    hasNextPage: pages > 0 && safePage < pages,
    prevPage: safePage > 1 ? safePage - 1 : null,
    nextPage: pages > 0 && safePage < pages ? safePage + 1 : null,
  };
}

module.exports = {
  buildPaginationMeta,
};
