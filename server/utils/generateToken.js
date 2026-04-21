/**
 * Backwards-compatible JWT signing facade.
 *
 * The canonical access/refresh signers live in `utils/tokens.js`. This
 * file is kept so the seeder and any legacy callers continue to work
 * unchanged — it now delegates to the canonical signer.
 */

import { generateAccessToken, verifyAccessToken } from './tokens.js';

export const signAccessToken = (user) => generateAccessToken(user);
export { verifyAccessToken };

export const generateToken = (user) => generateAccessToken(user);

export default generateToken;
