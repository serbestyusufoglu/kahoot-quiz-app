import { io, Socket } from 'socket.io-client';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitAsync<T = any>(socket: Socket, event: string, payload: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 8000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function runE2E() {
  console.log('==========================================================');
  console.log('🧪 BİLGİARENA UÇTAN UCA (E2E) SENARYO TESTİ BAŞLIYOR...');
  console.log('==========================================================');

  // 1. Admin giriş yapar
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && loginData.token, '1. Admin girişi başarısız!');
  const token = loginData.token as string;
  console.log('✅ 1. Admin başarıyla giriş yaptı.');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. 3 soru oluşturur
  const qPayloads = [
    {
      text: "Türkiye'nin başkenti neresidir?",
      redOption: 'Ankara',
      blueOption: 'İstanbul',
      yellowOption: 'İzmir',
      greenOption: 'Bursa',
      correctColor: 'RED',
      duration: 20,
    },
    {
      text: "Dünya'nın doğal uydusu hangisidir?",
      redOption: 'Mars',
      blueOption: 'Ay',
      yellowOption: 'Venüs',
      greenOption: 'Jüpiter',
      correctColor: 'BLUE',
      duration: 20,
    },
    {
      text: 'Suyun deniz seviyesinde kaynama sıcaklığı kaç derecedir?',
      redOption: '50 °C',
      blueOption: '80 °C',
      yellowOption: '90 °C',
      greenOption: '100 °C',
      correctColor: 'GREEN',
      duration: 10,
    },
  ];

  const createdQuestionIds: string[] = [];
  for (const qp of qPayloads) {
    const r = await fetch(`${BASE_URL}/api/admin/questions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(qp),
    });
    const d = await r.json();
    assert(r.ok && d.question?.id, 'Soru oluşturulamadı!');
    createdQuestionIds.push(d.question.id);
  }
  console.log(`✅ 2. Admin 3 yeni soru oluşturdu: ${createdQuestionIds.join(', ')}`);

  // 3. Quiz oluşturur
  const quizRes = await fetch(`${BASE_URL}/api/admin/quizzes`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'E2E Test Quizi – Genel Kültür & Fen',
      description: 'Otomatik senaryo testi quizi',
      questionIds: createdQuestionIds,
    }),
  });
  const quizData = await quizRes.json();
  assert(quizRes.ok && quizData.quiz?.id, 'Quiz oluşturulamadı!');
  const quizId = quizData.quiz.id;
  console.log(`✅ 3. Quiz oluşturuldu: "${quizData.quiz.title}" (${quizData.quiz.totalQuestions} soru)`);

  // 4, 5, 6. Oyunu başlatır, sistem oyun kodu ve QR kod oluşturur
  const gameRes = await fetch(`${BASE_URL}/api/admin/games`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ quizId }),
  });
  const gameData = await gameRes.json();
  assert(gameRes.ok && gameData.game?.gameCode, 'Oyun başlatılamadı!');
  assert(
    gameData.qrDataUrl && gameData.qrDataUrl.startsWith('data:image/png;base64,'),
    'QR kod oluşturulamadı!'
  );
  const gameCode = gameData.game.gameCode as string;
  console.log(`✅ 4-5-6. Oyun oluşturuldu! Oyun Kodu: ${gameCode} | QR Kod üretildi (${gameData.joinUrl})`);

  // Connect sockets for Admin + 3 Players (Ahmet, Zeynep, Mehmet)
  const adminSocket = io(BASE_URL, { transports: ['websocket'], forceNew: true });
  const player1Socket = io(BASE_URL, { transports: ['websocket'], forceNew: true });
  const player2Socket = io(BASE_URL, { transports: ['websocket'], forceNew: true });
  const player3Socket = io(BASE_URL, { transports: ['websocket'], forceNew: true });

  let latestPlayer1Snap: any = null;
  let latestPlayer2Snap: any = null;
  let latestAdminSnap: any = null;

  adminSocket.on('game_state_sync', (s) => (latestAdminSnap = s));
  player1Socket.on('game_state_sync', (s) => (latestPlayer1Snap = s));
  player2Socket.on('game_state_sync', (s) => (latestPlayer2Snap = s));

  const adminJoin = await emitAsync(adminSocket, 'admin_join_game', { gameCode, token });
  assert(adminJoin.ok, 'Admin oyun odasına katılamadı!');

  // 7. İki veya daha fazla oyuncu oyuna katılır
  const p1Join = await emitAsync(player1Socket, 'join_game', { gameCode, name: 'Ahmet' });
  const p2Join = await emitAsync(player2Socket, 'join_game', { gameCode, name: 'Zeynep' });
  const p3Join = await emitAsync(player3Socket, 'join_game', { gameCode, name: 'Mehmet' });

  assert(p1Join.ok && p2Join.ok && p3Join.ok, 'Oyuncular katılamadı!');
  const p1Id = p1Join.player.id;
  const p2Id = p2Join.player.id;
  const p3Id = p3Join.player.id;
  console.log(`✅ 7. 3 Oyuncu gerçek zamanlı katıldı: Ahmet (${p1Id.slice(0, 6)}), Zeynep (${p2Id.slice(0, 6)}), Mehmet (${p3Id.slice(0, 6)})`);

  // 8. Admin oyunu başlatır
  const startRes = await emitAsync(adminSocket, 'admin_start_game', { gameCode, token });
  assert(startRes.ok, 'Oyun başlatılamadı!');
  console.log('✅ 8. Admin yarışmayı başlattı (STARTING -> QUESTION 1)...');

  // Wait for 2s starting transition -> Question 1 active
  await sleep(2300);

  // 9. Tüm oyuncular aynı soruyu görür
  assert(
    latestPlayer1Snap?.game.status === 'QUESTION' &&
      latestPlayer2Snap?.game.status === 'QUESTION' &&
      latestPlayer1Snap?.currentQuestion?.id === createdQuestionIds[0] &&
      latestPlayer2Snap?.currentQuestion?.id === createdQuestionIds[0],
    'Oyuncular aynı anda 1. soruyu göremedi!'
  );
  console.log(`✅ 9. Tüm oyuncular aynı anda 1. Soruyu gördü: "${latestPlayer1Snap.currentQuestion.text}"`);

  // 10, 11, 12. Oyuncular farklı zamanlarda cevap verir (Erken doğru, geç doğru, yanlış cevap)
  // Ahmet answers immediately (within ~0.3s -> 100 pts)
  const ans1 = await emitAsync(player1Socket, 'submit_answer', {
    gameCode,
    playerId: p1Id,
    selectedColor: 'RED', // Correct
  });
  assert(ans1.ok && ans1.answer.isCorrect && ans1.answer.score > 0, 'Ahmet cevabı hatalı!');

  // Wait 2.5 seconds so Zeynep answers later and gets lower score
  await sleep(2500);
  const ans2 = await emitAsync(player2Socket, 'submit_answer', {
    gameCode,
    playerId: p2Id,
    selectedColor: 'RED', // Correct, later
  });
  assert(ans2.ok && ans2.answer.isCorrect, 'Zeynep cevabı hatalı!');
  assert(
    ans1.answer.score > ans2.answer.score,
    `Erken cevap veren Ahmet (${ans1.answer.score}) geç cevap veren Zeynep'ten (${ans2.answer.score}) yüksek puan almalı!`
  );

  // Mehmet gives wrong answer -> 0 pts
  const ans3 = await emitAsync(player3Socket, 'submit_answer', {
    gameCode,
    playerId: p3Id,
    selectedColor: 'BLUE', // Wrong
  });
  assert(ans3.ok && ans3.answer.score === 0 && !ans3.answer.isCorrect, 'Yanlış cevap 0 puan olmalı!');

  console.log(
    `✅ 10-11-12. Farklı zamanlarda cevaplar işlendi -> Ahmet: +${ans1.answer.score}p (${ans1.answer.elapsedSeconds}sn), Zeynep: +${ans2.answer.score}p (${ans2.answer.elapsedSeconds}sn), Mehmet (Yanlış): +${ans3.answer.score}p`
  );

  await sleep(300);

  // 14 & 15. Tüm oyuncular cevap verdiği için otomatik ANSWER_REVEAL ve skor tablosu güncellendi
  assert(
    latestAdminSnap?.game.status === 'ANSWER_REVEAL' &&
      latestAdminSnap?.questionResults?.correctColor === 'RED',
    'Soru bitişinde DOĞRU CEVAP (ANSWER_REVEAL) ekranına geçilmedi!'
  );
  console.log('✅ 13-14. Soru tamamlandı ve DOĞRU CEVAP ekranı gösterildi.');

  const lbRes = await emitAsync(adminSocket, 'admin_show_leaderboard', { gameCode, token });
  assert(lbRes.ok, 'Skor tablosuna geçilemedi!');
  await sleep(200);
  assert(latestAdminSnap?.game.status === 'LEADERBOARD', 'LEADERBOARD durumu aktif değil!');
  console.log('✅ 15. Canlı skor tablosu (LEADERBOARD) güncellendi.');

  // 16. Sonraki soruya geçilir (Soru 2) + Pause/Resume testi
  await emitAsync(adminSocket, 'admin_next_question', { gameCode, token });
  await sleep(200);
  assert(
    latestAdminSnap?.game.status === 'QUESTION' &&
      latestAdminSnap?.game.currentQuestionIndex === 1,
    '2. soruya geçilemedi!'
  );
  console.log(`✅ 16. 2. Soruya geçildi: "${latestAdminSnap.currentQuestion.text}"`);

  // Test Pause & Resume
  const pauseRes = await emitAsync(adminSocket, 'admin_toggle_pause', { gameCode, token });
  assert(pauseRes.ok && pauseRes.status === 'PAUSED', 'Oyun duraklatılamadı!');
  await sleep(200);
  assert(latestPlayer1Snap?.game.status === 'PAUSED', 'Oyuncu ekranında PAUSED görünmedi!');
  const resumeRes = await emitAsync(adminSocket, 'admin_toggle_pause', { gameCode, token });
  assert(resumeRes.ok && resumeRes.status === 'QUESTION', 'Oyun devam ettirilemedi!');
  console.log('✅ Bonus: Oyun duraklatma (PAUSED) ve kaldığı yerden devam ettirme doğrulandı.');

  // Players answer Question 2 (correct = BLUE)
  await emitAsync(player2Socket, 'submit_answer', { gameCode, playerId: p2Id, selectedColor: 'BLUE' });
  await sleep(1200);
  await emitAsync(player1Socket, 'submit_answer', { gameCode, playerId: p1Id, selectedColor: 'BLUE' });
  await emitAsync(player3Socket, 'submit_answer', { gameCode, playerId: p3Id, selectedColor: 'BLUE' });
  await sleep(300);

  // Move to Question 3 (duration = 10s, let's test timer expiration or manual end)
  await emitAsync(adminSocket, 'admin_next_question', { gameCode, token });
  await sleep(300);
  assert(latestAdminSnap?.game.currentQuestionIndex === 2, '3. soruya geçilemedi!');

  await emitAsync(player1Socket, 'submit_answer', { gameCode, playerId: p1Id, selectedColor: 'GREEN' });
  await emitAsync(adminSocket, 'admin_end_question', { gameCode, token });
  await sleep(200);
  assert(latestAdminSnap?.game.status === 'ANSWER_REVEAL', '3. soru bitirilemedi!');

  // 17 & 18. Quiz tamamlanır ve Final sıralaması gösterilir
  await emitAsync(adminSocket, 'admin_next_question', { gameCode, token });
  await sleep(300);
  assert(latestAdminSnap?.game.status === 'FINISHED', 'Oyun FINISHED durumuna geçmedi!');
  assert(
    Array.isArray(latestAdminSnap?.leaderboard) && latestAdminSnap.leaderboard.length === 3,
    'Final sıralaması eksik!'
  );

  console.log('✅ 17-18. Quiz tamamlandı ve FİNAL SIRALAMASI gösterildi:');
  latestAdminSnap.leaderboard.forEach((p: any, idx: number) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
    console.log(`   ${medal} ${idx + 1}. ${p.name} — ${p.totalScore} puan`);
  });

  adminSocket.disconnect();
  player1Socket.disconnect();
  player2Socket.disconnect();
  player3Socket.disconnect();

  console.log('==========================================================');
  console.log('🎉 TÜM 18 ADIMLI E2E TEST SENARYOSU BAŞARIYLA GEÇTİ!');
  console.log('==========================================================');
}

runE2E().catch((err) => {
  console.error('❌ E2E Test Hatası:', err);
  process.exit(1);
});
