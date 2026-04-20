/**
 * Whitelist-style object picker used to defend against mass-assignment.
 *
 * Controllers should NEVER spread `req.body` into a model. Instead, call
 * `pickFields(req.body, ['name', 'email'])` to construct a payload that is
 * guaranteed to contain only the fields the route is allowed to mutate.
 *
 * Returns a new object containing only the keys present on the source AND
 * listed in `allowed`. `undefined` values are dropped so we don't accidentally
 * overwrite a stored value with `undefined`.
 */

export const pickFields = (source, allowed) => {
  if (!source || typeof source !== 'object') return {};
  const picked = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return picked;
};

export default pickFields;
