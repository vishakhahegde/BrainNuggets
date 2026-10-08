import { useEffect, useState } from 'react';

const HEIGHT = 64;

// A clear band that follows the pointer and gently dims the rest of the page.
export default function ReadingRuler() {
  const [y, setY] = useState(window.innerHeight / 2);
  useEffect(() => {
    const move = (e) => setY(e.clientY);
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const top = Math.max(0, y - HEIGHT / 2);
  return (
    <div className="ruler" aria-hidden="true">
      <div className="ruler-dim" style={{ top: 0, height: top }} />
      <div className="ruler-band" style={{ top, height: HEIGHT }} />
      <div className="ruler-dim" style={{ top: top + HEIGHT, bottom: 0 }} />
    </div>
  );
}
