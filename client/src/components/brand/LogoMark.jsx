/**
 * `LogoMark` — icon-only variant of the brand mark.
 * Convenience wrapper around `Logo` so call sites can import a clearly
 * named component instead of remembering `<Logo variant="mark" />`.
 */

import { Logo } from './Logo.jsx';

export function LogoMark(props) {
  return <Logo variant="mark" {...props} />;
}

export default LogoMark;
