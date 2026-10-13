import { useCallback, useEffect, useState } from "react";

// Runs an async loader once (and again when `reload()` is called).
// const { data, error, reload, setData } = useLoad(() => fetchSomething(), [dep]);
export default function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    loader().then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => { setData(null); setTick((n) => n + 1); }, []);
  return { data, error, reload, setData };
}
