/**
 * `useDebounce(value, delay)`
 *
 * Returns a copy of `value` that only updates after `delay` ms have
 * elapsed without further changes. Used by the catalog search input so
 * we don't fire one network request per keystroke.
 */

import { useEffect, useState } from 'react';

export const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export default useDebounce;
