/**
 * `RoleBadge` — `Badge` mapped to a user role. Mirrors `StatusBadge` so
 * navbars, dropdowns, admin tables all paint a role consistently.
 */

import { Badge } from './Badge.jsx';
import { Icon } from './Icon.jsx';
import { ROLES } from '../../utils/constants.js';

const ROLE_META = {
  [ROLES.student]: { variant: 'info', icon: 'GraduationCap', label: 'Student' },
  [ROLES.instructor]: { variant: 'primary', icon: 'BookOpen', label: 'Instructor' },
  [ROLES.admin]: { variant: 'danger', icon: 'ShieldCheck', label: 'Admin' },
};

export function RoleBadge({ role, size = 'sm', label, ...rest }) {
  const meta = ROLE_META[role] ?? ROLE_META[ROLES.student];
  return (
    <Badge
      variant={meta.variant}
      size={size}
      leftIcon={<Icon name={meta.icon} size={size === 'md' ? 14 : 12} />}
      {...rest}
    >
      {label ?? meta.label}
    </Badge>
  );
}

export default RoleBadge;
