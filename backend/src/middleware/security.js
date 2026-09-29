import AppError from '../utils/AppError.js';

// NoSQL injection and basic XSS mitigation helper
const sanitizeInput = (val) => {
  if (typeof val === 'string') {
    // Basic XSS mitigation: strip HTML tags
    return val.replace(/<[^>]*>/g, '');
  }
  if (val && typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(sanitizeInput);
    }
    const cleanObj = {};
    for (const key of Object.keys(val)) {
      // Prevent NoSQL injection: omit keys starting with $ or containing .
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      cleanObj[key] = sanitizeInput(val[key]);
    }
    return cleanObj;
  }
  return val;
};

export const sanitizeMiddleware = (req, _res, next) => {
  req.body = sanitizeInput(req.body);

  if (req.query) {
    const cleanQuery = sanitizeInput(req.query);
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, cleanQuery);
  }

  if (req.params) {
    const cleanParams = sanitizeInput(req.params);
    for (const key of Object.keys(req.params)) {
      delete req.params[key];
    }
    Object.assign(req.params, cleanParams);
  }

  next();
};
