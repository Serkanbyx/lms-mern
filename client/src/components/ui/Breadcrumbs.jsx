/**
 * `Breadcrumbs` — semantic navigation trail. Renders an `<ol>` inside a
 * `<nav aria-label="Breadcrumb">` per the WAI-ARIA Breadcrumbs Pattern.
 *
 * Items: `[{ label, to }]`. The last item is rendered as plain text
 * (current page) and gets `aria-current="page"`.
 *
 * `to` may be a string href or a function — callers using react-router
 * pass the path string and wrap it in a router-aware Link by overriding
 * the `linkAs` prop (defaults to a plain anchor so this primitive stays
 * router-agnostic).
 */

import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export function Breadcrumbs({
  items = [],
  linkAs: LinkComponent = 'a',
  separator,
  className,
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-text-subtle">
                  {separator ?? <Icon name="ChevronRight" size={14} />}
                </span>
              )}
              {isLast || !item.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(isLast && 'text-text font-medium')}
                >
                  {item.label}
                </span>
              ) : (
                <LinkComponent
                  href={LinkComponent === 'a' ? item.to : undefined}
                  to={LinkComponent !== 'a' ? item.to : undefined}
                  className="hover:text-text hover:underline underline-offset-4"
                >
                  {item.label}
                </LinkComponent>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
