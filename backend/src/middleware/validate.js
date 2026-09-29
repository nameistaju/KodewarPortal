import AppError from '../utils/AppError.js';

const parse = (schema, source) => {
  const result = schema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message
  }));

  throw new AppError('Validation failed', 400, details);
};

export const validate = (schemas = {}) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = parse(schemas.body, req.body);
    if (schemas.params) req.params = parse(schemas.params, req.params);
    if (schemas.query) req.validatedQuery = parse(schemas.query, req.query);

    next();
  } catch (error) {
    next(error);
  }
};
