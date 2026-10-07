import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  app,
  verifyAdminToken,
  setRealtimeBroadcaster,
  buildGameStateSnapshot,
  handlePlayerJoinAction,
  handleStartGameAction,
  handleSubmitAnswerAction,
  handleTogglePauseAction,
  endCurrentQuestionAndReveal,
  showLeaderboardForGame,
  advanceToNextQuestionOrFinish,
  finishGame,
} from './app';
import {
  getGameByCode,
  updateGameState,
  setPlayerConnected,
} from './db';
import type { GameStateSnapshot, OptionColor } from '../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const socketPlayerMap = new Map<string, { playerId: string; gameId: string; gameCode: string }>();

setRealtimeBroadcaster((gameId: string, eventName?: string) => {
  const publicSnapshot = buildGameStateSnapshot(gameId, false);
  const adminSnapshot = buildGameStateSnapshot(gameId, true);
  if (!publicSnapshot || !adminSnapshot) return;

  const roomPlayer = `game:${publicSnapshot.game.gameCode}:players`;
  const roomAdmin = `game:${publicSnapshot.game.gameCode}:admins`;

  io.to(roomPlayer).emit('game_state_sync', publicSnapshot);
  io.to(roomAdmin).emit('game_state_sync', adminSnapshot);

  if (eventName) {
    io.to(roomPlayer).emit(eventName, publicSnapshot);
    io.to(roomAdmin).emit(eventName, adminSnapshot);
  }
});

io.on('connection', (socket: Socket) => {
  socket.on(
    'admin_join_game',
    (
      payload: { gameCode: string; token: string },
      callback?: (res: { ok: boolean; error?: string; snapshot?: GameStateSnapshot }) => void
    ) => {
      const admin = verifyAdminToken(payload?.token);
      if (!admin) {
        callback?.({ ok: false, error: 'Yetkisiz yönetici erişimi.' });
        return;
      }
      const game = getGameByCode(payload.gameCode || '');
      if (!game) {
        callback?.({ ok: false, error: 'Oyun bulunamadı.' });
        return;
      }
      socket.join(`game:${game.gameCode}:admins`);
      const snapshot = buildGameStateSnapshot(game.id, true)!;
      socket.emit('game_state_sync', snapshot);
      callback?.({ ok: true, snapshot });
    }
  );

  socket.on(
    'join_game',
    (
      payload: { gameCode: string; name: string; playerId?: string },
      callback?: (res: any) => void
    ) => {
      const result = handlePlayerJoinAction(payload);
      if (result.ok && result.player && result.snapshot) {
        socketPlayerMap.set(socket.id, {
          playerId: result.player.id,
          gameId: result.snapshot.game.id,
          gameCode: result.snapshot.game.gameCode,
        });
        socket.join(`game:${result.snapshot.game.gameCode}:players`);
      }
      callback?.(result);
    }
  );

  socket.on(
    'admin_start_game',
    (payload: { gameCode: string; token: string }, callback?: (res: any) => void) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      callback?.(handleStartGameAction(payload.gameCode));
    }
  );

  socket.on(
    'submit_answer',
    (
      payload: { gameCode: string; playerId: string; selectedColor: OptionColor },
      callback?: (res: any) => void
    ) => {
      callback?.(handleSubmitAnswerAction(payload));
    }
  );

  socket.on(
    'admin_end_question',
    (payload: { gameCode: string; token: string }, callback?: (res: any) => void) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      const game = getGameByCode(payload.gameCode);
      if (!game) {
        callback?.({ ok: false, error: 'Oyun bulunamadı.' });
        return;
      }
      endCurrentQuestionAndReveal(game.id);
      callback?.({ ok: true });
    }
  );

  socket.on(
    'admin_show_leaderboard',
    (payload: { gameCode: string; token: string }, callback?: (res: any) => void) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      const game = getGameByCode(payload.gameCode);
      if (!game) {
        callback?.({ ok: false, error: 'Oyun bulunamadı.' });
        return;
      }
      showLeaderboardForGame(game.id);
      callback?.({ ok: true });
    }
  );

  socket.on(
    'admin_next_question',
    (payload: { gameCode: string; token: string }, callback?: (res: any) => void) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      const game = getGameByCode(payload.gameCode);
      if (!game) {
        callback?.({ ok: false, error: 'Oyun bulunamadı.' });
        return;
      }
      advanceToNextQuestionOrFinish(game.id);
      callback?.({ ok: true });
    }
  );

  socket.on(
    'admin_toggle_pause',
    (payload: { gameCode: string; token: string }, callback?: (res: any) => void) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      callback?.(handleTogglePauseAction(payload.gameCode));
    }
  );

  socket.on(
    'admin_toggle_auto_advance',
    (
      payload: { gameCode: string; token: string; autoAdvance: boolean },
      callback?: (res: any) => void
    ) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      const game = getGameByCode(payload.gameCode);
      if (!game) {
        callback?.({ ok: false, error: 'Oyun bulunamadı.' });
        return;
      }
      updateGameState(game.id, { autoAdvance: Boolean(payload.autoAdvance) });
      callback?.({ ok: true });
    }
  );

  socket.on(
    'admin_finish_game',
    (payload: { gameCode: string; token: string }, callback?: (res: any) => void) => {
      if (!verifyAdminToken(payload?.token)) {
        callback?.({ ok: false, error: 'Yetkisiz işlem.' });
        return;
      }
      const game = getGameByCode(payload.gameCode);
      if (!game) {
        callback?.({ ok: false, error: 'Oyun bulunamadı.' });
        return;
      }
      finishGame(game.id);
      callback?.({ ok: true });
    }
  );

  socket.on('disconnect', () => {
    const info = socketPlayerMap.get(socket.id);
    if (info) {
      socketPlayerMap.delete(socket.id);
      setPlayerConnected(info.playerId, false);
    }
  });
});

const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`🚀 BilgiArena Sunucusu çalışıyor: http://localhost:${PORT}`);
});
