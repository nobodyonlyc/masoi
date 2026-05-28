import { useMemo } from 'react';

export default function Stars({ count = 80 }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    dur: (2 + Math.random() * 3).toFixed(1),
    delay: (Math.random() * 3).toFixed(1),
  })), [count]);

  return (
    <div className="stars-bg">
      {stars.map(s => (
        <div key={s.id} className="star" style={{
          top: `${s.top}%`, left: `${s.left}%`,
          width: `${s.size}px`, height: `${s.size}px`,
          '--dur': `${s.dur}s`, '--delay': `${s.delay}s`,
          opacity: 0.4,
        }} />
      ))}
    </div>
  );
}
