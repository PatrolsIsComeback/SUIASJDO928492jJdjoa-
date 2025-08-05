// utils/hangmanManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { getBotStats, saveBotStats } = require('./db'); // Bot istatistiklerini güncellemek için
const { OWNER_ID } = require('./config'); // Bot sahibini kullanmak için

// Adam Asmaca kelime listesi
const WORDS = [
    "ELMA", "ARMUT", "KİRAZ", "MUZ", "ÇİLEK", "PORTAKAL", "LİMON", "ÜZÜM", "KARPUZ", "KAVUN",
    "BİLGİSAYAR", "TELEFON", "KLAVYE", "FARE", "MONİTÖR", "HOPARLÖR", "KULAKLIK", "KAMERA", "MİKROFON", "YAZICI",
    "KİTAP", "DEFTER", "KALEM", "SİLGİ", "CETVEL", "MAKAS", "BOYA", "FIRÇA", "TUVAL", "HEYKEL",
    "ARABA", "OTOBÜS", "TREN", "UÇAK", "GEMİ", "MOTOSİKLET", "BİSİKLET", "TAKSİ", "METRO", "DOLMUŞ",
    "GÜNEŞ", "AY", "YILDIZ", "BULUT", "YAĞMUR", "KAR", "RÜZGAR", "ŞİMŞEK", "GÖKKUŞAĞI", "VOLKAN",
    "İSTANBUL", "ANKARA", "İZMİR", "BURSA", "ADANA", "ANTALYA", "GAZİANTEP", "KONYA", "MERSİN", "DİYARBAKIR",
    "TÜRKİYE", "ALMANYA", "FRANSA", "İTALYA", "İSPANYA", "İNGİLTERE", "RUSYA", "ÇİN", "JAPONYA", "AMERİKA",
    "KEDİ", "KÖPEK", "KUŞ", "BALIK", "AT", "İNEK", "KOYUN", "TAVUK", "ASLAN", "KAPLAN",
    "DOKTOR", "ÖĞRETMEN", "MÜHENDİS", "POLİS", "ASKER", "HEMŞİRE", "AVUKAT", "AŞÇI", "RESSAM", "YAZAR",
    "FUTBOL", "BASKETBOL", "VOLEYBOL", "TENİS", "YÜZME", "KOŞU", "BOKS", "GÜREŞ", "JUDO", "KARATE"
];

// Adam Asmaca durumu (aktif/pasif)
let hangmanSystemActive = true; 

// Aktif Adam Asmaca oyunları, oda ID'sine göre saklanır
const activeHangmanGames = new Map();

// --- Yardımcı Fonksiyonlar ---

function generateHangmanRoomID() {
    let id;
    do {
        id = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 karakterli ID
    } while (activeHangmanGames.has(id));
    return id;
}

function getHangmanSystemStatus() {
    return hangmanSystemActive;
}

function setHangmanSystemStatus(status) {
    hangmanSystemActive = status;
}

async function updateHangmanMessage(game, client) {
    try {
        const channel = client.channels.cache.get(game.channelId);
        if (!channel) {
            console.error(`[Hangman] Kanal bulunamadı: ${game.channelId}`);
            return;
        }

        const message = await channel.messages.fetch(game.messageId).catch(() => null);
        if (!message) {
            console.error(`[Hangman] Mesaj bulunamadı: ${game.messageId}`);
            return;
        }

        const hangmanArt = getHangmanArt(game.wrongGuesses);
        const guessedWordDisplay = game.word.split('').map(char => game.guessedLetters.has(char) ? char : '_').join(' ');
        const guessedLettersList = Array.from(game.guessedLetters).sort().join(', ') || 'Yok';

        let embedColor = '#FFC107'; // Sarı (waiting)
        let embedTitle = `Adam Asmaca Odası: ${game.id}`;
        let embedDescription = `Oda Kurucusu: <@${game.creatorId}>\nOyuncu Sayısı: ${game.players.length}/${game.maxPlayers}`;
        let statusField = `**Durum:** \`${game.status === 'waiting' ? 'Bekliyor' : 'Oyunda'}\``;
        let turnField = '';

        if (game.status === 'in_game') {
            embedColor = '#007BFF'; // Mavi (in-game)
            embedTitle = `Adam Asmaca Oyunu: ${game.id}`;
            embedDescription = `Kelime: \`${guessedWordDisplay}\`\nYanlış Tahminler: **${game.wrongGuesses}/${game.maxWrongGuesses}**\nTahmin Edilen Harfler: ${guessedLettersList}`;
            statusField = `**Sıradaki Oyuncu:** <@${game.currentPlayerId}>`;
            turnField = `Kalan Can: ${game.maxWrongGuesses - game.wrongGuesses}`;
        } else if (game.status === 'ended') {
            embedColor = game.outcome === 'win' ? '#28A745' : '#DC3545'; // Yeşil (win) veya Kırmızı (lose)
            embedTitle = `Adam Asmaca Oyunu Bitti! (ID: ${game.id})`;
            embedDescription = game.outcome === 'win' ? 
                `Tebrikler, kelimeyi buldunuz! Kelime: **${game.word}**` :
                `Malesef, kelimeyi bulamadınız. Kelime: **${game.word}**`;
            statusField = `**Kazanan:** ${game.outcome === 'win' ? `<@${game.lastGuesserId}>` : 'Yok'}`;
            turnField = ''; // Oyun bittiğinde sıra veya kalan can bilgisi gereksiz
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(`${embedDescription}\n\`\`\`\n${hangmanArt}\n\`\`\``)
            .addFields(
                { name: 'Oyuncular', value: game.players.map(p => `<@${p.id}>`).join(', ') || 'Yok', inline: true },
                { name: 'Oda Tipi', value: game.type === 'ozel' ? 'Özel' : 'Açık', inline: true },
                { name: 'Kanal', value: `<#${game.channelId}>`, inline: true },
                { name: 'Durum', value: statusField, inline: false }
            )
            .setTimestamp();
        
        // Sadece oyun devam ediyorsa tahmin butonlarını göster
        let components = [];
        if (game.status === 'in_game') {
            const allLetters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');
            let letterRows = [];
            let currentRow = new ActionRowBuilder();
            let countInRow = 0;

            allLetters.forEach(char => {
                if (countInRow === 5) { // Her 5 butonda bir yeni satır
                    letterRows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    countInRow = 0;
                }
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hangman_guess_${game.id}_${char}`)
                        .setLabel(char)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(game.guessedLetters.has(char))
                );
                countInRow++;
            });
            if (countInRow > 0) { // Son kalan butonları da ekle
                letterRows.push(currentRow);
            }
            
            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`hangman_fullguess_${game.id}`)
                    .setLabel('Kelime Tahmin Et')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`hangman_endgame_${game.id}`)
                    .setLabel('Oyunu Bitir (Kurucu)')
                    .setStyle(ButtonStyle.Danger)
            );
            components = [...letterRows, controlRow]; // Tüm harf satırlarını ve kontrol satırını ekle
        } else if (game.status === 'waiting' && game.creatorId === client.user.id) { // Bot kendi oluşturduğu odaları bitirebilsin
             components = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hangman_endgame_${game.id}`)
                        .setLabel('Oyunu Bitir (Kurucu)')
                        .setStyle(ButtonStyle.Danger)
                )
            ];
        }

        await message.edit({ embeds: [embed], components: components });

    } catch (error) {
        console.error(`[Hangman] Mesaj güncellenirken hata oluştu (game ID: ${game.id}):`, error);
        // Hatanın detaylarını daha iyi görmek için
        if (error.code === 50035) { // Invalid Form Body hatası
            console.error("DiscordAPIError[50035] details:", error.rawError);
        }
    }
}


function getHangmanArt(wrongGuesses) {
    const stages = [
        `
  +---+
  |   |
      |
      |
      |
      ===`,
        `
  +---+
  |   |
  O   |
      |
      |
      ===`,
        `
  +---+
  |   |
  O   |
  |   |
      |
      ===`,
        `
  +---+
  |   |
  O   |
 /|   |
      |
      ===`,
        `
  +---+
  |   |
  O   |
 /|\\  |
      |
      ===`,
        `
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      ===`,
        `
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      ===`
    ];
    return stages[wrongGuesses];
}

function selectRandomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
}

async function createHangmanRoom(creatorMember, type, maxPlayers, client) {
    try {
        const roomId = generateHangmanRoomID();
        // Geçici bir kategori kanalı oluştur
        const categoryChannel = creatorMember.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Adam Asmaca Odaları');
        let parentId = null;
        if (categoryChannel) {
            parentId = categoryChannel.id;
        } else {
            // Eğer kategori yoksa oluştur
            const newCategory = await creatorMember.guild.channels.create({
                name: 'Adam Asmaca Odaları',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: creatorMember.guild.id, // Everyone role
                        deny: [PermissionsBitField.Flags.SendMessages] // Herkes mesaj atamasın
                    }
                ]
            });
            parentId = newCategory.id;
        }

        const roomChannel = await creatorMember.guild.channels.create({
            name: `adam-asmaca-${roomId.toLowerCase()}`,
            type: ChannelType.GuildText,
            parent: parentId,
            permissionOverwrites: [
                {
                    id: creatorMember.guild.id, // @everyone
                    deny: [PermissionsBitField.Flags.ViewChannel], // Default olarak kimse görmesin
                },
                {
                    id: creatorMember.id, // Oda kurucusu
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                {
                    id: client.user.id, // Botun kendisi
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
            ],
        });

        const newGame = {
            id: roomId,
            creatorId: creatorMember.id,
            type: type, // 'ozel' veya 'acik'
            maxPlayers: maxPlayers,
            players: [{ id: creatorMember.id, username: creatorMember.user.username }], // Kurucu otomatik eklenir
            channelId: roomChannel.id,
            word: null,
            hiddenWord: null,
            guessedLetters: new Set(),
            wrongGuesses: 0,
            maxWrongGuesses: 6,
            status: 'waiting', // waiting, in_game, ended
            messageId: null, // Oyun mesajının ID'si
            currentPlayerId: null, // Sırası olan oyuncunun ID'si
            turnTimeout: null, // Tahmin sırası için timeout
            turnStartTime: null, // Turun başladığı zaman damgası
            category: null, // Oyun kelimesinin kategorisi
            ownerTimeout: null // Oda kurucusunun süresi dolunca odayı kapatmak için
        };
        activeHangmanGames.set(roomId, newGame);

        // Eğer oda açıksa, herkesin görmesine izin ver
        if (type === 'acik') {
            await roomChannel.permissionOverwrites.edit(creatorMember.guild.id, {
                ViewChannel: true,
                SendMessages: false // Sadece komutlarla etkileşim olduğu için herkesin mesaj atmasını engelle
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#FFC107')
            .setTitle(`Adam Asmaca Odası Oluşturuldu: ${roomId}`)
            .setDescription(`Oda Kurucusu: <@${creatorMember.id}>\nOda Tipi: **${type === 'ozel' ? 'Özel' : 'Açık'}**\nMaksimum Oyuncu: ${maxPlayers}\nOyuncular: <@${creatorMember.id}>`)
            .setFooter({ text: 'Oyun başlaması bekleniyor...' })
            .setTimestamp();
        
        // Komponentleri (butonları) burada tanımlayabiliriz
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`hangman_join_${roomId}`)
                .setLabel('Odaya Katıl')
                .setStyle(ButtonStyle.Success)
                .setDisabled(type === 'ozel'), // Özel odalara butondan katılımı engelle
            new ButtonBuilder()
                .setCustomId(`hangman_start_${roomId}`)
                .setLabel('Oyunu Başlat (Kurucu)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`hangman_leave_${roomId}`)
                .setLabel('Odadan Ayrıl')
                .setStyle(ButtonStyle.Danger)
        );

        const sentMessage = await roomChannel.send({ embeds: [embed], components: [actionRow] });
        newGame.messageId = sentMessage.id;

        // Oda sahibi için 5 dakikalık bir timeout belirle (oyun başlamazsa kapanır)
        newGame.ownerTimeout = setTimeout(async () => {
            const game = activeHangmanGames.get(roomId);
            if (game && game.status === 'waiting') {
                await roomChannel.send(`Oyun ${creatorMember.user.username} tarafından başlatılmadığı için ${5} dakika sonra otomatik olarak kapatılıyor.`);
                await closeRoom(roomId, client);
            }
        }, 5 * 60 * 1000); // 5 dakika

        return newGame;

    } catch (error) {
        console.error('Adam Asmaca odası oluşturulurken hata:', error);
        return null;
    }
}

async function addPlayerToRoom(roomId, member, client) {
    const game = activeHangmanGames.get(roomId);
    if (!game) return false;

    if (game.players.some(p => p.id === member.id)) return false; // Zaten odada

    if (game.players.length >= game.maxPlayers) return false; // Oda dolu

    game.players.push({ id: member.id, username: member.user.username });

    // Oyuncu kanalı görebilsin ve mesaj atamasın (butonlarla etkileşim için)
    const channel = client.channels.cache.get(game.channelId);
    if (channel) {
        await channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
            SendMessages: false, // Mesaj atmasını engelle, sadece butonlarla tahmin yapacak
            ReadMessageHistory: true,
        });
    }

    await updateHangmanMessage(game, client);
    return true;
}

async function removePlayerFromRoom(roomId, playerId, client, kicked = false) {
    const game = activeHangmanGames.get(roomId);
    if (!game) return false;

    const initialPlayerCount = game.players.length;
    game.players = game.players.filter(p => p.id !== playerId);

    if (game.players.length === initialPlayerCount) return false; // Oyuncu bulunamadı

    const channel = client.channels.cache.get(game.channelId);
    if (channel) {
        await channel.permissionOverwrites.delete(playerId).catch(console.error); // Kanal erişimini kaldır
        if (kicked) {
            const member = await client.users.fetch(playerId).catch(() => null);
            if (member) {
                await channel.send(`<@${playerId}> odadan atıldı!`);
            }
        } else {
             await channel.send(`<@${playerId}> odadan ayrıldı.`);
        }
    }

    if (game.players.length === 0 && game.status !== 'ended') {
        // Tüm oyuncular ayrılırsa odayı kapat
        await closeRoom(roomId, client, 'Tüm oyuncular ayrıldığı için oda kapatıldı.');
    } else if (game.status === 'in_game' && game.currentPlayerId === playerId) {
        // Eğer sırası olan oyuncu ayrılırsa, sırayı sonraki oyuncuya geçir
        nextTurn(game, client);
    } else if (game.players.length > 0 && game.creatorId === playerId && game.status === 'waiting') {
        // Kurucu ayrılırsa ve oyun başlamadıysa, odayı kapat
        await closeRoom(roomId, client, 'Oda kurucusu ayrıldığı için oda kapatıldı.');
    } else if (game.players.length > 0 && game.creatorId === playerId && game.status === 'in_game') {
        // Oyun devam ederken kurucu ayrılırsa, oyun devam eder, ancak kurucu komutlarını kullanamaz.
        // İstersen burada yeni bir kurucu atayabilirsin veya oyunu sonlandırabilirsin.
        // Şimdilik sadece mesajla bilgilendiriyoruz.
        if (channel) {
            await channel.send(`Oda kurucusu (<@${playerId}>) oyundan ayrıldı. Oyun devam ediyor.`);
        }
    }

    await updateHangmanMessage(game, client);
    return true;
}

async function closeRoom(roomId, client, reason = 'Oyun sonlandırıldı.') {
    const game = activeHangmanGames.get(roomId);
    if (!game) return false;

    if (game.turnTimeout) clearTimeout(game.turnTimeout);
    if (game.ownerTimeout) clearTimeout(game.ownerTimeout);

    const channel = client.channels.cache.get(game.channelId);
    if (channel) {
        await channel.send(reason);
        await channel.delete().catch(console.error); // Kanalı sil
    }

    game.status = 'ended';
    activeHangmanGames.delete(roomId);
    console.log(`[Hangman] Oda kapatıldı: ${roomId}`);
    return true;
}

async function startGame(roomId, client) {
    const game = activeHangmanGames.get(roomId);
    if (!game || game.status !== 'waiting') return false;

    // Word seçimi ve başlangıç durumu
    game.word = selectRandomWord().toUpperCase();
    game.hiddenWord = game.word.split('').map(() => '_').join('');
    game.guessedLetters = new Set();
    game.wrongGuesses = 0;
    game.status = 'in_game';
    game.currentPlayerId = game.players[Math.floor(Math.random() * game.players.length)].id; // Rastgele oyuncu seç
    
    // Oyun mesajını güncelle ve tahmin butonlarını gönder
    await updateHangmanMessage(game, client);

    // İlk tahmini bekleme süresini başlat
    startTurnTimeout(game, client);

    return true;
}

async function handleGuess(roomId, guesserId, guess, client) {
    const game = activeHangmanGames.get(roomId);
    if (!game || game.status !== 'in_game' || game.currentPlayerId !== guesserId) return false;

    const channel = client.channels.cache.get(game.channelId);
    if (!channel) return false;

    clearTimeout(game.turnTimeout); // Yeni tahmin geldiği için süreyi sıfırla

    let responseMessage = '';
    let isCorrectGuess = false;

    if (guess.length === 1 && /^[a-zA-ZçÇğĞıİöÖşŞüÜ]$/.test(guess)) { // Harf tahmini
        const letter = guess.toUpperCase();
        if (game.guessedLetters.has(letter)) {
            responseMessage = `<@${guesserId}> zaten **${letter}** harfini tahmin etmiştin! Sıranı kaybettin.`;
            game.wrongGuesses++; // Aynı harfi tahmin etmek yanlış sayılır
        } else {
            game.guessedLetters.add(letter);
            if (game.word.includes(letter)) {
                isCorrectGuess = true;
                // Kelimenin güncel halini oluştur
                game.hiddenWord = game.word.split('').map(char => game.guessedLetters.has(char) ? char : '_').join('');
                responseMessage = `<@${guesserId}> doğru tahmin! **${letter}** harfi kelimede var.`;
                if (game.hiddenWord.replace(/ /g, '') === game.word) { // Tüm kelime bulundu mu?
                    await endGame(game, client, 'win', guesserId);
                    return true;
                }
            } else {
                game.wrongGuesses++;
                responseMessage = `<@${guesserId}> yanlış tahmin! **${letter}** harfi kelimede yok. Kalan can: ${game.maxWrongGuesses - game.wrongGuesses}`;
            }
        }
    } else if (guess.length > 1) { // Kelime tahmini
        if (guess.toUpperCase() === game.word) {
            await endGame(game, client, 'win', guesserId);
            return true;
        } else {
            responseMessage = `<@${guesserId}> yanlış kelime tahmini! **${guess}** kelime değil. Kalan can: ${game.maxWrongGuesses - game.wrongGuesses}`;
            game.wrongGuesses++;
        }
    } else {
        responseMessage = `<@${guesserId}> geçersiz tahmin formatı. Lütfen tek bir harf veya tüm kelimeyi girin.`;
        // Geçersiz tahmin için yanlış sayısını artırma
        await updateHangmanMessage(game, client); // Mesajı güncelle
        startTurnTimeout(game, client); // Sırayı tekrar başlat
        return true; // İşlem başarılı sayılır, ancak sıra geçmez
    }

    if (game.wrongGuesses >= game.maxWrongGuesses) {
        await endGame(game, client, 'lose');
        return true;
    }

    await channel.send(responseMessage);
    await updateHangmanMessage(game, client);

    // Eğer doğru tahmin değilse veya geçersiz tahminse sırayı değiştir
    if (!isCorrectGuess || guess.length > 1) { // Kelime tahmini doğru olsa da sıra değişir
        nextTurn(game, client);
    } else { // Harf tahmini doğruysa, aynı oyuncu tekrar tahmin yapabilir
        startTurnTimeout(game, client);
    }
    return true;
}

function nextTurn(game, client) {
    const currentIndex = game.players.findIndex(p => p.id === game.currentPlayerId);
    const nextIndex = (currentIndex + 1) % game.players.length;
    game.currentPlayerId = game.players[nextIndex].id;

    const channel = client.channels.cache.get(game.channelId);
    if (channel) {
        channel.send(`<@${game.currentPlayerId}>, sıradaki tahmin senin!`);
    }
    startTurnTimeout(game, client);
}

function startTurnTimeout(game, client) {
    if (game.turnTimeout) clearTimeout(game.turnTimeout);
    game.turnStartTime = Date.now();
    game.turnTimeout = setTimeout(async () => {
        if (game.status === 'in_game') {
            game.wrongGuesses++;
            const channel = client.channels.cache.get(game.channelId);
            if (channel) {
                await channel.send(`<@${game.currentPlayerId}> süresi doldu! Bir can kaybedildi. Kalan can: ${game.maxWrongGuesses - game.wrongGuesses}`);
            }
            if (game.wrongGuesses >= game.maxWrongGuesses) {
                await endGame(game, client, 'lose');
            } else {
                nextTurn(game, client);
                await updateHangmanMessage(game, client);
            }
        }
    }, 60 * 1000); // 60 saniye tahmin süresi
}

async function endGame(game, client, outcome, lastGuesserId = null) {
    game.status = 'ended';
    game.outcome = outcome;
    game.lastGuesserId = lastGuesserId;

    if (game.turnTimeout) clearTimeout(game.turnTimeout);
    if (game.ownerTimeout) clearTimeout(game.ownerTimeout);

    const channel = client.channels.cache.get(game.channelId);
    if (channel) {
        const resultText = outcome === 'win' ? 
            `Oyun sona erdi! Kazanan: <@${lastGuesserId}>! Kelime: **${game.word}**` :
            `Oyun sona erdi! Kelime bulunamadı. Kelime: **${game.word}**`;
        await channel.send(resultText);
    }
    
    // Bot istatistiklerini güncelle
    const botStats = getBotStats();
    if (outcome === 'win') {
        botStats.hangmanWins++;
        if (lastGuesserId) {
            botStats.hangmanPlayerWins[lastGuesserId] = (botStats.hangmanPlayerWins[lastGuesserId] || 0) + 1;
        }
    } else {
        botStats.hangmanLosses++;
    }
    saveBotStats(botStats);

    await updateHangmanMessage(game, client); // Son durumu göstermek için mesajı güncelle

    // Oda kanalını 10 saniye sonra sil
    setTimeout(async () => {
        if (channel && channel.deletable) {
            await channel.delete().catch(console.error);
        }
        activeHangmanGames.delete(game.id);
        console.log(`[Hangman] Oyun sonlandı ve oda silindi: ${game.id}`);
    }, 10 * 1000); // 10 saniye sonra kanalı sil
}

function listRooms(type = 'all') {
    if (type === 'all') {
        return Array.from(activeHangmanGames.values());
    }
    return Array.from(activeHangmanGames.values()).filter(game => game.type === type && game.status === 'waiting');
}

async function closeRoomAsOwner(roomId, client) {
    return closeRoom(roomId, client, 'Bot sahibi tarafından oda kapatıldı.');
}


module.exports = {
    getHangmanSystemStatus,
    setHangmanSystemStatus,
    activeHangmanGames,
    createHangmanRoom,
    addPlayerToRoom,
    removePlayerFromRoom,
    startGame,
    handleGuess,
    listRooms,
    closeRoomAsOwner,
    endGame // Dışarıdan çağrılabilir olması ihtimaline karşı ekledim
};
