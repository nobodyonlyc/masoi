import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';

export default function Chat({ messages, wolfMessages, onSend, myRole, phase, height = 280 }) {
  const [input, setInput]     = useState('');
  const [channel, setChannel] = useState('public');
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const isWolf   = ['WOLF','WOLF_KING'].includes(myRole);
  const canChat  = phase !== 'night' || (isWolf && channel === 'wolf');
  const displayMsgs = channel === 'wolf' ? wolfMessages : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, wolfMessages]);

  const send = () => {
    if (!input.trim() || !canChat) return;
    onSend(input.trim(), channel);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: height >= 999 ? '100%' : height, minHeight: 0,
      background: 'var(--surface)', border: '1.5px solid var(--b1)',
      borderRadius: 12, overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', flexShrink: 0,
        borderBottom: '1px solid var(--b0)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <span className="label">CHAT</span>
        {isWolf && (
          <div style={{ display:'flex', gap:4 }}>
            {[['public','Chung'], ['wolf','🐺 Sói']].map(([ch, label]) => (
              <button key={ch} onClick={() => setChannel(ch)}
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11,
                  fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                  fontFamily: 'var(--font-body)',
                  ...(channel === ch
                    ? ch === 'wolf'
                      ? { background:'rgba(185,28,28,0.3)', color:'#fca5a5', border:'1px solid rgba(248,113,113,0.45)' }
                      : { background:'var(--card)', color:'var(--tp)', border:'1px solid var(--b1)' }
                    : { background:'transparent', color:'var(--tm)', border:'1px solid transparent' }
                  ),
                }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 0,
      }}>
        {displayMsgs.length === 0 && (
          <p style={{ fontSize:12, textAlign:'center', color:'var(--tf)', fontStyle:'italic', paddingTop:16 }}>
            Chưa có tin nhắn...
          </p>
        )}
        {displayMsgs.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            {msg.system ? (
              <p style={{ fontSize:11, textAlign:'center', color:'var(--tf)', fontStyle:'italic' }}>
                {msg.text}
              </p>
            ) : (
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <Avatar name={msg.username} size="sm" />
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--tp)',
                    marginRight: 6,
                  }}>
                    {msg.username}
                  </span>
                  <span style={{
                    fontSize: 13,
                    color: 'var(--ts)',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {msg.text}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px', flexShrink: 0,
        borderTop: '1px solid var(--b0)',
        background: 'rgba(255,255,255,0.02)',
        alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={canChat ? 'Nhập tin nhắn...' : 'Không thể chat ban đêm'}
          disabled={!canChat}
          style={{
            flex: 1, minWidth: 0,
            padding: '8px 12px', fontSize: 13,
            opacity: canChat ? 1 : 0.5,
          }}
        />
        <button
          onClick={send}
          disabled={!canChat || !input.trim()}
          style={{
            flexShrink: 0,
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, border: '1.5px solid rgba(139,92,246,0.45)',
            background: input.trim() && canChat ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)',
            color: input.trim() && canChat ? '#c4b5fd' : 'var(--tf)',
            fontSize: 16, cursor: input.trim() && canChat ? 'pointer' : 'default',
            transition: 'all .15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (input.trim() && canChat) e.currentTarget.style.background = 'rgba(139,92,246,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = input.trim() && canChat ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)'; }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
