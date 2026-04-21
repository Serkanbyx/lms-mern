/**
 * `CommandMenu` — ⌘K (Ctrl+K) command palette. Lazy-loaded by callers
 * (`React.lazy(() => import('./CommandMenu.jsx'))`) so its weight never
 * lands on the critical path; the keyboard listener that opens it is
 * mounted by the navbar at near-zero cost.
 *
 * Items are filtered by a case-insensitive substring match against
 * `label` + `keywords`. ↑/↓ to move, Enter to run, Esc to close.
 *
 * Items shape: `{ id, label, hint, icon, keywords, onSelect, group }`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Input } from './Input.jsx';
import { Icon } from './Icon.jsx';
import { KBD } from './KBD.jsx';
import { cn } from '../../utils/cn.js';

export function CommandMenu({ open, onClose, items = [] }) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const haystack = `${it.label} ${(it.keywords || []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((it) => {
      const key = it.group ?? 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    setActiveId(filtered[0]?.id ?? null);
  }, [filtered]);

  const handleKeyDown = (event) => {
    if (filtered.length === 0) return;
    const idx = filtered.findIndex((it) => it.id === activeId);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveId(filtered[(idx + 1) % filtered.length].id);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveId(filtered[(idx - 1 + filtered.length) % filtered.length].id);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[idx];
      item?.onSelect?.();
      onClose?.();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      className="!bg-bg-subtle"
    >
      <div className="-mx-6 -my-4">
        <div className="px-4 py-3 border-b border-border">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            leadingIcon={<Icon name="Search" size={16} />}
            trailingIcon={<KBD>Esc</KBD>}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {groups.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map(([groupName, groupItems]) => (
              <div key={groupName} className="mb-2 last:mb-0">
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  {groupName}
                </div>
                <ul
                  role="listbox"
                  tabIndex={-1}
                  aria-activedescendant={activeId ?? undefined}
                >
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        id={item.id}
                        role="option"
                        aria-selected={activeId === item.id}
                        onMouseEnter={() => setActiveId(item.id)}
                        onClick={() => {
                          item.onSelect?.();
                          onClose?.();
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2 text-sm text-left',
                          activeId === item.id
                            ? 'bg-primary/10 text-text'
                            : 'text-text-muted hover:bg-bg-muted',
                        )}
                      >
                        {item.icon && (
                          <Icon name={item.icon} size={16} className="shrink-0" />
                        )}
                        <span className="flex-1 text-text">{item.label}</span>
                        {item.hint && (
                          <span className="text-xs text-text-subtle">
                            {item.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export default CommandMenu;
