import { AppError } from '../utils/errors.js';

/** validate(zodSchema, 'body' | 'query' | 'params') */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const fields = {};
    for (const i of result.error.issues) fields[i.path.join('.') || '_'] = i.message;
    return next(new AppError(400, 'Please check the highlighted fields.', 'VALIDATION_ERROR', fields));
  }
  if (source === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
  else req[source] = result.data;
  next();
};
