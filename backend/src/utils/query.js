export const getPagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const getSort = (sort = '-createdAt') => {
  if (!sort) return { createdAt: -1 };

  return String(sort)
    .split(',')
    .filter(Boolean)
    .reduce((acc, item) => {
      const field = item.startsWith('-') ? item.slice(1) : item;
      acc[field] = item.startsWith('-') ? -1 : 1;
      return acc;
    }, {});
};

export const paginated = async (model, filter, query, options = {}) => {
  const { page, limit, skip } = getPagination(query);
  const sort = getSort(query.sort || options.defaultSort);
  const projection = options.projection || null;
  const populate = options.populate || [];

  let findQuery = model.find(filter, projection).sort(sort).skip(skip).limit(limit);

  populate.forEach((item) => {
    findQuery = findQuery.populate(item);
  });

  const [items, total] = await Promise.all([findQuery, model.countDocuments(filter)]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
