const GRADIENTS = [
  ['#6d28d9','#a78bfa'], ['#0e7490','#22d3ee'], ['#be185d','#f472b6'],
  ['#b45309','#fcd34d'], ['#065f46','#34d399'], ['#991b1b','#f87171'],
  ['#1e40af','#60a5fa'], ['#4d7c0f','#a3e635'],
];

function pick(name='') {
  let h=0; for(let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export default function Avatar({ name='?', size='md', dead=false }) {
  const [a, b] = pick(name);
  const initials = name.slice(0,2).toUpperCase();
  const sz = { sm:'w-7 h-7 text-xs', md:'w-9 h-9 text-sm', lg:'w-12 h-12 text-base', xl:'w-16 h-16 text-xl' }[size] || 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${dead?'opacity-40 grayscale':''}`}
         style={{ background:`linear-gradient(135deg,${a},${b})`, color:'#fff', textShadow:'0 1px 2px rgba(0,0,0,0.4)' }}>
      {initials}
    </div>
  );
}
