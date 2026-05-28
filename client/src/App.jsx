import { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './hooks/useSocket';
import { useGame } from './hooks/useGame';
import Stars from './components/Stars';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GuidePage from './pages/GuidePage';
import HistoryPage from './pages/HistoryPage';
import WaitingRoom from './pages/WaitingRoom';
import NightPhase from './pages/NightPhase';
import DayPhase from './pages/DayPhase';
import ResultScreen from './pages/ResultScreen';
import SpectatorView from './pages/SpectatorView';
import GameTimeline from './components/GameTimeline';
import { API_BASE } from './utils/api';

function Game() {
  const { socket, connected } = useSocket();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('masoi_user')) || null; } catch { return null; }
  });
  const [page, setPage] = useState('lobby');
  const [spectateRoom, setSpectateRoom] = useState(null); // { code, data }
  const game = useGame(socket, user);

  useEffect(() => {
    if (user && socket && connected)
      socket.emit('auth', { userId:user.id, username:user.username });
  }, [user, socket, connected]);

  // Poll spectated room data every 3s
  useEffect(() => {
    if (!spectateRoom) return;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/room/${spectateRoom.code}`);
        if (r.ok) {
          const data = await r.json();
          setSpectateRoom(prev => ({ ...prev, data }));
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [spectateRoom?.code]);

  const handleLogin  = u => { setUser(u); localStorage.setItem('masoi_user', JSON.stringify(u)); };
  const handleLogout = () => {
    if (game.room) game.leaveRoom();
    setUser(null); localStorage.removeItem('masoi_user');
  };

  const handleSpectate = async (code) => {
    try {
      const r = await fetch(`${API_BASE}/api/room/${code}`);
      if (r.ok) {
        const data = await r.json();
        setSpectateRoom({ code, data });
      } else {
        setSpectateRoom({ code, data: null });
      }
    } catch {
      setSpectateRoom({ code, data: null });
    }
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  // ── Spectator mode ─────────────────────────────────────────────────────────
  if (spectateRoom) return (
    <>
      <Stars count={40} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
        <SpectatorView
          roomCode={spectateRoom.code}
          roomData={spectateRoom.data}
          onBack={() => setSpectateRoom(null)}
        />
      </div>
    </>
  );

  // ── Game result ──────────────────────────────────────────────────────────────
  if (game.gameResult) return (
    <>
      <Stars count={40} />
      <ResultScreen
        gameResult={game.gameResult}
        players={game.players}
        events={game.events}
        user={user}
        room={game.room}
        isHost={game.isHost}
        onPlayAgain={() => {
          game.playAgain();
          // Server emit room_reset rồi client mới rời ResultScreen.
        }}
        onLeave={() => {
          game.leaveRoom();
          setPage('lobby');
        }}
      />
      {game.toast && <div className="toast">{game.toast}</div>}
    </>
  );

  // ── Night phase ──────────────────────────────────────────────────────────────
  if (game.room && game.phase === 'night') return (
    <>
      <Stars count={100} />
      <NightPhase
        players={game.players} myRole={game.myRole} myRoleInfo={game.myRoleInfo}
        wolfTeam={game.wolfTeam} wolfTarget={game.wolfTarget}
        timer={game.timer} seerResult={game.seerResult}
        witchPeekResult={game.witchPeekResult} onWitchPeek={game.witchPeek}
        hunterMustShoot={game.hunterMustShoot}   onHunterShoot={game.hunterShoot}
        wolfKingMustChoose={game.wolfKingMustChoose} onWolfKingTarget={game.wolfKingTarget}
        onNightAction={game.sendNightAction} onSkip={game.skipNight}
        phaseInfo={game.phaseInfo} myId={user?.id}
        isHost={game.isHost} onCloseRoom={game.closeRoom}
      />
      {/* Timeline nổi - chỉ show nếu có events */}
      {game.events.length > 0 && (
        <div style={{ position:'fixed', bottom:16, left:'50%', transform:'translateX(-50%)', width:'min(400px, calc(100vw - 32px))', zIndex:20 }}>
          <GameTimeline events={game.events} currentPhase={game.phase} currentRound={game.phaseInfo?.round} />
        </div>
      )}
      {game.toast && <div className="toast">{game.toast}</div>}
    </>
  );

  // ── Day phase ────────────────────────────────────────────────────────────────
  if (game.room && (game.phase === 'discuss' || game.phase === 'vote')) return (
    <>
      <Stars count={30} />
      <DayPhase
        phase={game.phase} players={game.players} myRole={game.myRole}
        myRoleInfo={game.myRoleInfo} timer={game.timer} votes={game.votes}
        events={game.events} messages={game.messages} wolfMessages={game.wolfMessages}
        user={user} round={game.phaseInfo?.round||1} nightDeaths={game.nightDeaths}
        phaseInfo={game.phaseInfo} onCastVote={game.castVote} onSend={game.sendMessage}
        offlineIds={game.offlineIds} wolfTeam={game.wolfTeam}
        isHost={game.isHost} onCloseRoom={game.closeRoom}
      />
      {game.toast && <div className="toast">{game.toast}</div>}
    </>
  );

  // ── Waiting room ─────────────────────────────────────────────────────────────
  if (game.room && game.phase === 'waiting') return (
    <>
      <Stars count={50} />
      <WaitingRoom
        room={game.room} players={game.players} user={user}
        isHost={game.isHost} messages={game.messages}
        onLeave={() => { game.leaveRoom(); setPage('lobby'); }}
        onToggleReady={game.toggleReady} onStart={game.startGame}
        onSend={game.sendMessage} onKick={game.kickPlayer}
        onCloseRoom={game.closeRoom}
        onUpdateConfig={game.updateConfig}
      />
      {game.toast && <div className="toast">{game.toast}</div>}
    </>
  );

  // ── Lobby / Guide / History ──────────────────────────────────────────────────
  return (
    <AppShell user={user} page={page} onNavigate={setPage} onLogout={handleLogout} connected={connected}>
      {page === 'lobby'   && <LobbyPage user={user} onCreateRoom={game.createRoom} onJoinRoom={game.joinRoom} onSpectate={handleSpectate} />}
      {page === 'guide'   && <GuidePage />}
      {page === 'history' && <HistoryPage user={user} />}
      {game.toast && <div className="toast">{game.toast}</div>}
    </AppShell>
  );
}

export default function App() {
  return <SocketProvider><Game /></SocketProvider>;
}
