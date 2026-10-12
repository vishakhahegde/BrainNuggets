import { useEffect, useState } from 'react';

// Whether the left sidebar is hidden on the study and assignment pages. One setting for both, kept across visits.
const KEY = 'bn-sidebar-collapsed';

function read() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read);
  useEffect(() => {
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* storage blocked */ }
  }, [collapsed]);
  return [collapsed, () => setCollapsed((c) => !c)];
}
