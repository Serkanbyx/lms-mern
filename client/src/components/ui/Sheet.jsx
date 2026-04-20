/**
 * `Sheet` — bottom-anchored sheet for mobile actions (lesson menu,
 * "more" menus, share). It's a thin convenience wrapper around `Drawer`
 * with `side="bottom"` so call sites read intent ("open a sheet") instead
 * of the geometry ("open a bottom drawer").
 */

import { Drawer } from './Drawer.jsx';

export function Sheet(props) {
  return <Drawer {...props} side="bottom" />;
}

export default Sheet;
