import { useEffect, useState } from "react";

// Returns `value` only after it has stopped changing for `delay` ms (so we do not call the API on every key press).
export default function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
