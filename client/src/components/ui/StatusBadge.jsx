/**
 * `StatusBadge` — opinionated `Badge` that maps a course status enum to the
 * right variant + icon. Centralised so a status string never gets painted
 * with the wrong color in some far-flung table cell.
 */

import { Badge } from './Badge.jsx';
import { Icon } from './Icon.jsx';
import { COURSE_STATUS } from '../../utils/constants.js';

const STATUS_META = {
  [COURSE_STATUS.draft]: { variant: 'neutral', icon: 'PencilLine', label: 'Draft' },
  [COURSE_STATUS.pending]: { variant: 'warning', icon: 'Clock', label: 'Pending review' },
  [COURSE_STATUS.published]: { variant: 'success', icon: 'CheckCircle2', label: 'Published' },
  [COURSE_STATUS.rejected]: { variant: 'danger', icon: 'XCircle', label: 'Rejected' },
  [COURSE_STATUS.archived]: { variant: 'neutral', icon: 'Archive', label: 'Archived' },
};

export function StatusBadge({ status, size = 'sm', label, ...rest }) {
  const meta = STATUS_META[status] ?? STATUS_META[COURSE_STATUS.draft];
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

export default StatusBadge;
