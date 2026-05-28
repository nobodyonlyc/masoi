import { useEffect, useState, useCallback, useRef } from 'react';
import { sounds } from '../utils/sounds';

export function useGame(socket, user) {
  const [room, setRoom]                   = useState(null);
  const [phase, setPhase]                 = useState('waiting');
  const [myRole, setMyRole]               = useState(null);
  const [myRoleInfo, setMyRoleInfo]       = useState(null);
  const [wolfTeam, setWolfTeam]           = useState([]);
  const [players, setPlayers]             = useState([]);
  const [votes, setVotes]                 = useState({});
  const [events, setEvents]               = useState([]);
  const [messages, setMessages]           = useState([]);
  const [wolfMessages, setWolfMessages]   = useState([]);
  const [timer, setTimer]                 = useState(0);
  const [gameResult, setGameResult]       = useState(null);
  const [seerResult, setSeerResult]       = useState(null);
  const [witchPeekResult, setWitchPeekResult] = useState(null);
  const [wolfTarget, setWolfTarget]       = useState(null);
  const [nightDeaths, setNightDeaths]     = useState([]);
  const [phaseInfo, setPhaseInfo]         = useState(null);
  const [toast, setToast]                 = useState(null);
  // BUG1 FIX: hunter/wolfking state
  const [hunterMustShoot, setHunterMustShoot]       = useState(false);
  const [wolfKingMustChoose, setWolfKingMustChoose] = useState(false);
  // #3: track offline players
  const [offlineIds, setOfflineIds] = useState([]);

  const roomRef  = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => { roomRef.current = room; }, [room]);

  const showToast = useCallback((msg, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  }, []);

  const resetGameState = useCallback(() => {
    setRoom(null); setPlayers([]); setPhase('waiting');
    setMyRole(null); setMyRoleInfo(null); setWolfTeam([]);
    setMessages([]); setWolfMessages([]); setEvents([]);
    setVotes({}); setGameResult(null); setSeerResult(null);
    setWitchPeekResult(null); setWolfTarget(null); setNightDeaths([]);
    setPhaseInfo(null); setTimer(0);
    setHunterMustShoot(false); setWolfKingMustChoose(false);
    setOfflineIds([]);
    clearInterval(timerRef.current);
    sounds.stopAmbience();
  }, []);

  const startTimer = useCallback((seconds) => {
    if (!seconds) return;
    setTimer(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        if (prev <= 5) sounds.tickUrgent();
        else if (prev <= 10 && prev % 2 === 0) sounds.tick();
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('room_created', ({ room }) => {
      setRoom(room); setPlayers(room.players);
      setEvents(room.events || []); setPhase('waiting'); setMessages([]);
    });
    socket.on('room_joined', ({ room }) => {
      setRoom(room); setPlayers(room.players);
      setEvents(room.events || []); setPhase(room.phase || 'waiting');
      if (room.phase === 'waiting') setMessages([]);
    });
    socket.on('room_updated', (room) => {
      setRoom(room); setPlayers(room.players);
    });
    socket.on('player_left',  ({ username }) => showToast(`${username} đã rời phòng`));
    socket.on('host_changed', ({ newHostName }) => showToast(`${newHostName} trở thành host mới`));

    socket.on('role_assigned', ({ role, roleInfo, wolves }) => {
      setMyRole(role); setMyRoleInfo(roleInfo); setWolfTeam(wolves);
      setSeerResult(null); setWitchPeekResult(null); setWolfTarget(null);
      setTimeout(() => sounds.roleReveal(), 300);
    });

    socket.on('game_started', ({ players }) => {
      setPlayers(players); setVotes({}); setNightDeaths([]);
      setGameResult(null); setSeerResult(null); setWitchPeekResult(null);
      setWolfTarget(null);
      setHunterMustShoot(false); setWolfKingMustChoose(false);
      sounds.gameStart();
    });

    socket.on('phase_changed', ({ phase, round, duration }) => {
      setPhase(phase);
      setPhaseInfo({ phase, round, duration });
      setVotes({});
      // BUG16 FIX: reset witch peek khi đêm mới
      if (phase === 'night') { setWitchPeekResult(null); setWolfTarget(null); }
      startTimer(duration);
      if (phase === 'night')    sounds.nightFall();
      else if (phase === 'discuss') sounds.dayBreak();
      else if (phase === 'vote')    sounds.votePhase();
    });

    socket.on('night_resolved', ({ deaths, events, players }) => {
      setNightDeaths(deaths || []);
      setEvents(events || []);
      setPlayers(players);
      if (deaths?.length) setTimeout(() => sounds.death(), 500);
    });

    socket.on('seer_result',       result  => setSeerResult(result));
    socket.on('witch_peek_result', result  => setWitchPeekResult(result));
    socket.on('wolf_target_updated', target => setWolfTarget(target));
    socket.on('votes_updated',     ({ votes }) => setVotes(votes));

    socket.on('vote_resolved', ({ executed, events, players }) => {
      setEvents(events || []);
      setPlayers(players);
      if (executed && !executed.spared) setTimeout(() => sounds.hang(), 300);
    });

    // BUG1 FIX
    socket.on('hunter_must_shoot', () => {
      setHunterMustShoot(true);
      showToast('🏹 Bạn là Thợ Săn — hãy chọn người để bắn!', 5000);
    });
    socket.on('hunter_shot', ({ events, players }) => {
      setHunterMustShoot(false);
      setEvents(events || []);
      setPlayers(players);
      sounds.death();
    });

    // BUG2 FIX
    socket.on('wolf_king_must_choose', () => {
      setWolfKingMustChoose(true);
      showToast('👑 Bạn là Sói Chúa — hãy kéo 1 người chết theo!', 5000);
    });
    socket.on('wolf_king_dragged', ({ events, players }) => {
      setWolfKingMustChoose(false);
      setEvents(events || []);
      setPlayers(players);
      sounds.death();
    });

    socket.on('player_offline', ({ userId }) => {
      setOfflineIds(prev => prev.includes(userId) ? prev : [...prev, userId]);
    });
    socket.on('player_online', ({ userId, username }) => {
      setOfflineIds(prev => prev.filter(id => id !== userId));
      showToast(`✅ ${username} đã kết nối lại`, 2000);
    });

    socket.on('game_ended', ({ winner, reason, players, events }) => {
      setPlayers(players); setEvents(events || []);
      setGameResult({ winner, reason });
      sounds.stopAmbience();
      clearInterval(timerRef.current);
      setTimeout(() => winner === 'wolf' ? sounds.wolfWin() : sounds.villageWin(), 600);
    });

    socket.on('room_reset', (room) => {
      // Cập nhật room state nhưng KHÔNG xóa gameResult
      // Server confirm xong mới clear result để cả phòng về waiting đồng bộ.
      setRoom(room); setPlayers(room.players);
      setPhase('waiting'); setMyRole(null); setMyRoleInfo(null);
      setVotes({}); setEvents([]); setMessages([]);
      setGameResult(null);
      setNightDeaths([]); setSeerResult(null); setWitchPeekResult(null); setWolfTarget(null);
      setHunterMustShoot(false); setWolfKingMustChoose(false);
      sounds.stopAmbience();
    });

    socket.on('chat_message', msg => {
      setMessages(prev => [...prev.slice(-100), msg]);
      if (!msg.system) sounds.chat();
    });
    socket.on('wolf_message', msg => {
      setWolfMessages(prev => [...prev.slice(-100), msg]);
      sounds.chat();
    });
    socket.on('kicked', ({ reason }) => {
      showToast(reason, 4000);
      resetGameState();
      sounds.error();
    });
    socket.on('room_closed', ({ reason }) => {
      showToast(reason || 'Phòng đã bị đóng', 4000);
      resetGameState();
      sounds.error();
    });
    socket.on('error', ({ msg }) => {
      showToast(`⚠️ ${msg}`, 3000);
      sounds.error();
    });

    return () => {
      [
        'room_created','room_joined','room_updated','player_left','host_changed',
        'role_assigned','game_started','phase_changed','night_resolved',
        'seer_result','witch_peek_result','wolf_target_updated','votes_updated','vote_resolved',
        'hunter_must_shoot','hunter_shot','wolf_king_must_choose','wolf_king_dragged',
        'game_ended','room_reset','chat_message','wolf_message','kicked','room_closed','error',
        'player_offline','player_online',
      ].forEach(e => socket.off(e));
      clearInterval(timerRef.current);
    };
  }, [socket, showToast, startTimer, resetGameState]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const createRoom = useCallback((cfg) => {
    if (!socket || !user) return;
    socket.emit('auth', { userId:user.id, username:user.username });
    socket.emit('create_room', {
      userId:   user.id,
      username: user.username,
      roomName: cfg.roomName,
      isPrivate: cfg.isPrivate,
      config: {
        maxPlayers:  cfg.maxPlayers,
        discussTime: cfg.discussTime,
        nightTime:   cfg.nightTime,
        voteTime:    cfg.voteTime,
      },
    });
  }, [socket, user]);

  const joinRoom = useCallback((code) => {
    if (!socket || !user) return;
    socket.emit('auth', { userId:user.id, username:user.username });
    socket.emit('join_room', { code:code.toUpperCase(), userId:user.id, username:user.username });
  }, [socket, user]);

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    const cur = roomRef.current;
    if (cur) socket.emit('leave_room', { code:cur.code, userId:user.id });
    resetGameState();
  }, [socket, user, resetGameState]);

  const toggleReady = useCallback(() => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('toggle_ready', { code:r.code, userId:user.id });
    sounds.click();
  }, [socket, user]);

  const startGame = useCallback(() => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('start_game', { code:r.code, userId:user.id });
  }, [socket, user]);

  const sendNightAction = useCallback((targetId, action = null) => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('night_action', { code:r.code, userId:user.id, targetId, action });
    sounds.click();
  }, [socket, user]);

  const witchPeek = useCallback(() => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('witch_peek', { code:r.code, userId:user.id });
  }, [socket, user]);

  const skipNight = useCallback(() => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('night_skip', { code:r.code, userId:user.id });
  }, [socket, user]);

  const castVote = useCallback((targetId) => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('cast_vote', { code:r.code, userId:user.id, targetId });
    sounds.voteBell();
  }, [socket, user]);

  const sendMessage = useCallback((text, channel = 'public') => {
    const r = roomRef.current;
    if (!socket || !r || !text.trim()) return;
    socket.emit('send_message', { code:r.code, userId:user.id, username:user.username, text, channel });
  }, [socket, user]);

  const kickPlayer = useCallback((targetId) => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('kick_player', { code:r.code, userId:user.id, targetId });
  }, [socket, user]);

  const closeRoom = useCallback(() => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('close_room', { code:r.code, userId:user.id });
  }, [socket, user]);

  const updateConfig = useCallback((config) => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('update_config', { code:r.code, userId:user.id, config });
  }, [socket, user]);

  const playAgain = useCallback(() => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('play_again', { code:r.code, userId:user.id });
  }, [socket, user]);

  // BUG1 FIX
  const hunterShoot = useCallback((targetId) => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('hunter_shoot', { code:r.code, userId:user.id, targetId });
  }, [socket, user]);

  // BUG2 FIX
  const wolfKingTarget = useCallback((targetId) => {
    const r = roomRef.current;
    if (!socket || !r) return;
    socket.emit('wolf_king_target', { code:r.code, userId:user.id, targetId });
  }, [socket, user]);

  return {
    room, phase, myRole, myRoleInfo, wolfTeam, players, votes,
    events, messages, wolfMessages, timer, gameResult, seerResult,
    wolfTarget,
    witchPeekResult, nightDeaths, phaseInfo, toast,
    hunterMustShoot, wolfKingMustChoose, offlineIds,
    createRoom, joinRoom, leaveRoom, toggleReady, startGame,
    sendNightAction, witchPeek, skipNight, castVote,
    sendMessage, kickPlayer, closeRoom, hunterShoot, wolfKingTarget, updateConfig, playAgain,
    isHost: room?.hostId === user?.id,
    me: players.find(p => p.userId === user?.id),
  };
}
