// utils/unvanSystem.js

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const levelSystem = require('./levelSystem'); // Seviye sistemi modülünü dahil et

// Dosya yolları
const titlesConfigPath = path.join(__dirname, '../data/unvanlar.json');
const titlesDataPath = path.join(__dirname, '../data/titles_data.json');
const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json');

// Unvan ayarlarını oku (unvanlar.json)
function getAllTitles() {
    if (!fs.existsSync(titlesConfigPath)) {
        console.warn('[UNVAN_SYSTEM] unvanlar.json bulunamadı. Boş array dönülüyor.');
        return [];
    }
    try {
        const data = fs.readFileSync(titlesConfigPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`[UNVAN_SYSTEM] unvanlar.json okuma veya parse etme hatası: ${e.message}`);
        return [];
    }
}

// Kullanıcı unvan verilerini oku (titles_data.json)
function readTitlesData() {
    if (!fs.existsSync(titlesDataPath)) {
        return { users: {} };
    }
    try {
        const data = fs.readFileSync(titlesDataPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`[UNVAN_SYSTEM] titles_data.json okuma veya parse etme hatası: ${e.message}`);
        return { users: {} };
    }
}

// Kullanıcı unvan verilerini yaz (titles_data.json)
function writeTitlesData(data) {
    try {
        fs.writeFileSync(titlesDataPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`[UNVAN_SYSTEM] titles_data.json yazma hatası: ${e.message}`);
    }
}

// Belirli bir kullanıcının unvan verilerini al
function getUserUnvanData(userId) {
    const data = readTitlesData();
    // activityMessages, nightMessages gibi alanları varsayılan olarak boş veya 0 ile başlat
    if (!data.users[userId]) {
        data.users[userId] = { awardedTitles: [], nightMessages: 0, activityMessages: [] };
        writeTitlesData(data); // Yeni kullanıcı verisini kaydet
    } else {
        // Eksik alanları tamamla (mevcut kullanıcılar için)
        if (!data.users[userId].awardedTitles) data.users[userId].awardedTitles = [];
        if (!data.users[userId].nightMessages) data.users[userId].nightMessages = 0;
        if (!data.users[userId].activityMessages) data.users[userId].activityMessages = [];
    }
    return data.users[userId];
}

// Kullanıcıya unvan ekle
function awardTitle(userId, titleId) {
    const data = readTitlesData();
    if (!data.users[userId]) {
        data.users[userId] = { awardedTitles: [], nightMessages: 0, activityMessages: [] };
    }
    if (!data.users[userId].awardedTitles.includes(titleId)) {
        data.users[userId].awardedTitles.push(titleId);
        writeTitlesData(data);
        return true;
    }
    return false; // Zaten unvanı var
}

// Sistem ayarlarını oku/yaz
function getSystemSettings() {
    if (!fs.existsSync(systemSettingsPath)) {
        return {
            saas: { active: false },
            gunaydin: { active: false },
            haberSistemi: { active: false, lastCheck: 0, nextCheck: 0 },
            menuluRolSistemi: { active: false, channelId: null, messageId: null },
            levelSystem: { active: false, channelId: null, xpPerMessage: 15 },
            unvanSystem: { active: false } // Unvan sistemi varsayılan olarak kapalı
        };
    }
    const data = fs.readFileSync(systemSettingsPath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(`[SYSTEM_SETTINGS] systemSettings.json okuma hatası: ${e.message}`);
        return { unvanSystem: { active: false } }; // Hata durumunda varsayılan dön
    }
}

function saveSystemSettings(settings) {
    try {
        fs.writeFileSync(systemSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
        console.error(`[SYSTEM_SETTINGS] systemSettings.json yazma hatası: ${e.message}`);
    }
}

// Unvan sistemini aktif/pasif et
function setUnvanSystemStatus(status) {
    const settings = getSystemSettings();
    settings.unvanSystem = settings.unvanSystem || {}; // objenin varlığını garanti et
    if (settings.unvanSystem.active !== status) {
        settings.unvanSystem.active = status;
        saveSystemSettings(settings);
        console.log(`[UNVAN_SYSTEM] Unvan sistemi ${status ? 'aktif' : 'pasif'} olarak ayarlandı.`);
        return true;
    }
    return false;
}

// Unvan ilerlemesini hesapla
async function calculateTitleProgress(userId, title, client) {
    const userData = getUserUnvanData(userId);
    const userLevelData = levelSystem.getUserLevelData(userId); // Seviye sisteminden veri çek

    if (title.type === 'xp') {
        return userLevelData.totalXP || 0; // Kullanıcının toplam XP'sini döndür
    } else if (title.type === 'activity') {
        const now = Date.now();
        const timeWindowMs = title.requirements.timeWindowMinutes * 60 * 1000;
        const minIntervalMs = title.requirements.minIntervalSeconds * 1000;

        // Belirli zaman penceresi içindeki mesajları filtrele
        // Ayrıca, activityMessages dizisini temizleyerek sadece son mesajları tutmak performansı artırır.
        userData.activityMessages = (userData.activityMessages || []).filter(msg => now - msg.timestamp <= timeWindowMs);
        writeTitlesData(readTitlesData()); // Güncel activityMessages'ı kaydet

        // İlerleme için gerekli mesaj sayısını ve zaman aralığını kontrol et
        let messageCount = userData.activityMessages.length;
        let activeMinutes = 0;

        // Herhangi 2 mesaj arasındaki minIntervalSeconds kontrolü
        // Bu daha karmaşık bir mantık gerektirir. Basitçe, belirlenen süre içinde
        // minMessages kadar mesaj atıldıysa ve bu mesajların arasında
        // minIntervalSeconds kadar fark varsa ödüllendirilir.
        // Şimdilik sadece mesaj sayısı ve en eski ve en yeni mesaj arasındaki zaman farkını baz alalım.
        if (messageCount >= title.requirements.minMessages && messageCount > 1) {
             const firstMessageTime = userData.activityMessages[0].timestamp;
             const lastMessageTime = userData.activityMessages[messageCount - 1].timestamp;
             const spanMinutes = (lastMessageTime - firstMessageTime) / (60 * 1000);
             if (spanMinutes >= title.requirements.timeWindowMinutes) {
                 activeMinutes = title.requirements.timeWindowMinutes; // Gereksinimi karşılıyor
             } else {
                 activeMinutes = Math.floor(spanMinutes); // Şu anki aktif dakika
             }
        }
        
        return {
            activeMinutes: activeMinutes,
            messages: messageCount
        };
    } else if (title.type === 'activity_time_based') {
        return userData.nightMessages || 0; // Kullanıcının gece mesaj sayısını döndür
    }
    return 0; // Varsayılan değer
}

// Kullanıcının unvan kazanıp kazanmadığını kontrol et ve ödüllendir
async function checkAndAwardTitles(userId, member, client) {
    const settings = getSystemSettings();
    if (!settings.unvanSystem || !settings.unvanSystem.active) return; // Sistem kapalıysa çık

    const allTitles = getAllTitles();
    const userData = getUserUnvanData(userId);

    for (const title of allTitles) {
        if (userData.awardedTitles.includes(title.id)) {
            continue; // Zaten kazanmışsa atla
        }

        let isAwarded = false;
        const currentProgress = await calculateTitleProgress(userId, title, client);

        if (title.type === 'xp') {
            const userTotalXP = currentProgress;
            if (userTotalXP >= title.requirements.totalXP) {
                isAwarded = true;
            }
        } else if (title.type === 'activity') {
            // "Hayatsız?" unvanı için daha kesin kontrol
            // Kullanıcının mesaj geçmişi (activityMessages) her mesajda güncellenmeli.
            // Burada sadece anlık kontrol yapıyoruz.
            const requiredMessages = title.requirements.minMessages;
            const requiredTimeWindowMinutes = title.requirements.timeWindowMinutes;
            const requiredMinIntervalSeconds = title.requirements.minIntervalSeconds;

            const recentMessages = (userData.activityMessages || []).filter(msg => Date.now() - msg.timestamp <= requiredTimeWindowMinutes * 60 * 1000);

            if (recentMessages.length >= requiredMessages) {
                // Mesajlar arasında en az 5 dakikalık aralık olup olmadığını kontrol et
                let validIntervalCount = 0;
                let lastValidTime = 0;

                // activityMessages'daki her bir mesaj için, kendisinden sonra gelen mesajlarla olan zaman farkını kontrol et
                // Bu kısım karmaşık olduğu için basit bir doğrulama yapıyorum:
                // Tüm mesajlar arasında yeterli aralıklar varsa ve belirli bir zaman penceresine yayılmışsa.
                // Basitçe, son 2 saatteki mesaj sayısı 20'den fazlaysa ve ilk ile son mesaj arasında 2 saatten fazla zaman varsa
                // Bu daha çok belirli bir sürede sürekli aktiviteyi ölçer.
                if (recentMessages.length > 0) {
                    const sortedMessages = [...recentMessages].sort((a, b) => a.timestamp - b.timestamp);
                    const firstMsgTime = sortedMessages[0].timestamp;
                    const lastMsgTime = sortedMessages[sortedMessages.length - 1].timestamp;
                    const timeSpanMinutes = (lastMsgTime - firstMsgTime) / (60 * 1000);

                    if (timeSpanMinutes >= requiredTimeWindowMinutes - 1 && recentMessages.length >= requiredMessages) { // -1 dk esneklik
                        // Burada her mesaj arasında minimum aralık şartını daha detaylı kontrol etmek gerekiyor.
                        // Şu anki veri yapımızda bunu kolayca kontrol edemiyoruz.
                        // Daha basit bir kontrol: sadece mesaj sayısı ve toplam süreye bakıyorum.
                        // Eğer her mesajın timestamp'i `activityMessages`'ta tutuluyorsa:
                        let intervalCheckPassed = true;
                        if (requiredMinIntervalSeconds > 0) {
                            for (let i = 0; i < sortedMessages.length - 1; i++) {
                                if (sortedMessages[i+1].timestamp - sortedMessages[i].timestamp < requiredMinIntervalSeconds * 1000) {
                                    intervalCheckPassed = false;
                                    break;
                                }
                            }
                        }
                        if (intervalCheckPassed) {
                            isAwarded = true;
                        }
                    }
                }
            }
        } else if (title.type === 'activity_time_based') {
            const userNightMessages = currentProgress;
            if (userNightMessages >= title.requirements.messageCount) {
                isAwarded = true;
            }
        }

        if (isAwarded) {
            if (awardTitle(userId, title.id)) { // Unvanı ver ve zaten sahip olup olmadığını kontrol et
                if (title.roleId && member) {
                    try {
                        await member.roles.add(title.roleId, 'Unvan kazanıldı');
                    } catch (roleError) {
                        console.error(`[UNVAN_SYSTEM] Rol eklenirken hata oluştu ${title.roleId} kullanıcı ${userId}:`, roleError);
                    }
                }
                const awardChannel = client.channels.cache.get(settings.levelSystem.channelId); // Seviye atlama kanalı varsa oraya gönder
                if (awardChannel && awardChannel.type === 0) { // Text kanalı ise
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('🎉 Yeni Unvan Kazandın! 🎉')
                        .setDescription(`Tebrikler! **\`${title.name}\`** unvanını kazandın!`) // Description güncellendi
                        .addFields(
                            { name: 'Unvan Açıklaması', value: title.description, inline: false }
                        )
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: title.unvanAwardedMessage || 'Unvanını profiline eklemeyi unutma!', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();
                        
                    await awardChannel.send({
                        content: `<@${member.user.id}>`, // Kullanıcıyı embed'in dışında etiketle
                        embeds: [embed]
                    });
                } else {
                    console.log(`[UNVAN_SYSTEM] ${member.user.tag} adlı kullanıcıya ${title.name} unvanı verildi, ancak bildirim kanalı yok veya yanlış tipte.`);
                }
            }
        }
    }
}

module.exports = {
    getAllTitles,
    getUserUnvanData,
    awardTitle,
    setUnvanSystemStatus,
    calculateTitleProgress,
    checkAndAwardTitles,
    readTitlesData, // messageCreate içinde kullanmak için dışa aktar
    writeTitlesData // messageCreate içinde kullanmak için dışa aktar
};