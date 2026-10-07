# BilgiArena – Gerçek Zamanlı Çok Kullanıcılı Quiz & Yarışma Platformu

Sınıf ortamında akıllı tahta / projeksiyon ve öğrenci telefonlarıyla gerçek zamanlı olarak oynanabilen, 4 renkli cevap sistemine sahip modern full-stack web uygulaması.

## Özellikler

- **Gerçek Zamanlı Multiplayer (WebSocket / Socket.IO)**: Yönetici oyunu başlattığı anda tüm oyuncuların telefonlarında aynı soru eşzamanlı açılır.
- **4 Renk Cevap Sistemi (`🔴 Kırmızı`, `🔵 Mavi`, `🟡 Sarı`, `🟢 Yeşil`)**: Büyük ekranda soru ve renkli seçenek metinleri gösterilirken, oyuncu telefonlarında sade ve dokunması kolay 4 büyük renkli buton yer alır.
- **Sunucu Tabanlı Adil Süre ve Puanlama**:
  - Soru başlangıç (`questionStartedAt`), bitiş (`questionEndsAt`) ve cevap gönderim (`submittedAt`) zamanları tamamen sunucu tarafından milisaniye hassasiyetinde kaydedilir.
  - Maksimum puan **100**'dür. Formül: `score = Math.floor(100 * (remainingTime / totalTime))` (İlk saniyede doğru cevap 100 puan, yanlış veya süresi geçmiş cevap 0 puan).
- **Yönetici Paneli**:
  - Güvenli yönetici girişi (`admin` / `admin123`)
  - Soru Havuzu (Oluştur, Düzenle, Sil, Kopyala, 10/15/20/30/45/60 sn veya özel süre)
  - Quiz Yönetimi (Soru havuzundan soru seçme, **sürükle-bırak** ile soru sırasını değiştirme, kopyalama, silme)
  - Canlı Yarışma Kontrol Paneli (`SORUYU BİTİR`, `SONRAKİ SORU`, `OYUNU DURAKLAT / DEVAM ETTİR`, `OYUNU BİTİR`, Otomatik Geçiş, Opsiyonel Ses Efektleri)
- **Otomatik Oyun Kodu & Büyük QR Kod**:
  - Her oyun için benzersiz 6 haneli oyun kodu ve telefonla okutulabilir yüksek çözünürlüklü QR kod üretilir (`/join/:gameCode`).
- **Bağlantı Koruma (Reconnection)**:
  - Oyuncunun internet bağlantısı kesilirse veya sayfa yenilenirse aynı `playerId` ile oyuna ve mevcut puanına kaldığı yerden geri döner; aynı soruya tekrar cevap gönderemez.

## Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Frontend derlemesi
npm run build

# Sunucuyu başlat (http://localhost:3001)
npm start

# 18 adımlı uçtan uca (E2E) çok oyunculu senaryo testini çalıştır
npm run test:e2e
```
