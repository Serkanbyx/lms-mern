/**
 * Backwards-compatible JWT signing facade.
 *
 * STEP 46 introduced split access/refresh tokens in `utils/tokens.js`.
 * This file is kept so the seeder and any pre-46 callers continue to
 * work unchanged — it now delegates to the canonical signer.
 */

import { generateAccessToken, verifyAccessToken } from './tokens.js';

export const signAccessToken = (user) => generateAccessToken(user);
export { verifyAccessToken };

export const generateToken = (user) => generateAccessToken(user);

export default generateToken;
