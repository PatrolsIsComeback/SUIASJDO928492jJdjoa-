// utils/levelSystem.js

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js'); // EmbedBuilder'ı ekledik

const levelsPath = path.join(__dirname, '../data/levels.json'); // Seviye verileri için ayrı JSON
const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json'); // Sistem ayarları için ayrı JSON

// Yardımcı fonksiyon: Seviye veritabanından verileri oku
const readLevels = () => {
    if (!fs.existsSync(levelsPath)) {
        return { users: {} };
    }
    const data = fs.readFileSync(levelsPath, 'utf8');
    return JSON.parse(data);
};

// Yardımcı fonksiyon: Seviye veritabanına verileri yaz
const writeLevels = (data) => {
    fs.writeFileSync(levelsPath, JSON.stringify(data, null, 2), 'utf8');
};

// Yardımcı fonksiyon: Sistem ayarlarını oku
const readSystemSettings = () => {
    if (!fs.existsSync(systemSettingsPath)) {
        return { 
            saas: { active: false },
            gunaydin: { active: false },
            haberSistemi: { active: false, lastCheck: 0, nextCheck: 0 },
            menuluRolSistemi: { active: false, channelId: null, messageId: null },
            levelSystem: { active: false, channelId: null, xpPerMessage: 15 }, // Varsayılan değerler
            unvanSystem: { active: false } // Varsayılan değer
        };
    }
    const data = fs.readFileSync(systemSettingsPath, 'utf8');
    return JSON.parse(data);
};

// Yardımcı fonksiyon: Sistem ayarlarını yaz
const writeSystemSettings = (data) => {
    fs.writeFileSync(systemSettingsPath, JSON.stringify(data, null, 2), 'utf8');
};

const getSystemSettings = () => {
    return readSystemSettings();
};

const saveSystemSettings = (settings) => {
    writeSystemSettings(settings);
};

// XP hesaplama fonksiyonu (logaritmik veya doğrusal olabilir)
const getRequiredXP = (level) => {
    return 100 * Math.pow(1.5, level); 
};

// Kullanıcı verilerini almak için yeni fonksiyon
const getUserLevelData = (userId) => {
    const levels = readLevels();
    if (!levels.users[userId]) {
        levels.users[userId] = { level: 0, xp: 0, totalXP: 0, lastMessageTime: 0, activityMessageCount: 0 };
        writeLevels(levels);
    }
    return levels.users[userId];
};

// Kullanıcıya XP verme fonksiyonu
const giveXP = async (message, client) => {
    const settings = getSystemSettings();
    if (!settings.levelSystem || !settings.levelSystem.active) {
        return; // Seviye sistemi kapalıysa XP verme
    }
    const userId = message.author.id;
    const levels = readLevels(); // Güncel seviye verilerini oku
    const userData = levels.users[userId] || { level: 0, xp: 0, totalXP: 0, lastMessageTime: 0, activityMessageCount: 0 };
    const xpPerMessage = settings.levelSystem.xpPerMessage || 15; // Varsayılan 15 XP

    // Anti-spam kontrolü: Son mesajdan bu yana belirli bir süre geçmeli
    const COOLDOWN_SECONDS = 60; // 60 saniye cooldown
    const now = Date.now();
    if (now - userData.lastMessageTime < (COOLDOWN_SECONDS * 1000)) {
        return; // Cooldown süresi dolmadıysa XP verme
    }

    userData.xp += xpPerMessage;
    userData.totalXP += xpPerMessage; // Toplam kazanılan XP
    userData.lastMessageTime = now; // Son mesaj zamanını güncelle
    userData.activityMessageCount = (userData.activityMessageCount || 0) + 1; // Aktivite sayacını artır

    let levelUp = false;
    let newLevel = userData.level;

    while (userData.xp >= getRequiredXP(newLevel)) {
        userData.xp -= getRequiredXP(newLevel);
        newLevel++;
        levelUp = true;
    }

    if (levelUp) {
        userData.level = newLevel;
        await levelUpNotification(message, newLevel, client); // levelUpNotification fonksiyonunu çağır
    }

    // Verileri güncelle ve kaydet
    levels.users[userId] = userData;
    writeLevels(levels);
};

// Seviye atlama bildirimi
const levelUpNotification = async (message, newLevel, client) => {
    const settings = getSystemSettings();
    const notificationChannelId = settings.levelSystem.channelId;
    if (!notificationChannelId) {
        console.warn('Seviye atlama bildirim kanalı ayarlanmamış.');
        return;
    }

    const channel = client.channels.cache.get(notificationChannelId);
    if (!channel) {
        console.error(`Seviye atlama bildirim kanalı bulunamadı: ${notificationChannelId}`);
        return;
    }

    const user = message.author; // Seviye atlayan kullanıcıyı al

    const embed = new EmbedBuilder()
        .setColor('#00FF00') // Yeşil renk
        .setTitle('🎉 Seviye Atladın! 🎉')
        .setDescription(`Harika bir iş çıkardın, yeni seviyen: **\`${newLevel}\`**!`) // Description güncellendi
        .addFields(
            { name: '🌟 Yeni Seviye', value: `**\`${newLevel}\`**`, inline: true },
            { name: '🚀 Yolun Açık Olsun!', value: `Bir sonraki seviye için durmak yok, yola devam!`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true })) // Kullanıcının avatarını ekle
        .setFooter({ text: 'SomeSub Bot | Seviye Sistemi', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    // Kullanıcıyı embed'in dışında etiketleyerek bildirim gönder
    await channel.send({ 
        content: `Tebrikler, <@${user.id}>!`, // Etiketleme burada yapıldı
        embeds: [embed]
    });
};

// XP ekleme (yönetim komutları için)
const addXP = async (userId, amount, member, client) => {
    const levels = readLevels();
    const userData = levels.users[userId] || { level: 0, xp: 0, totalXP: 0, lastMessageTime: 0, activityMessageCount: 0 };
    
    userData.xp += amount;
    userData.totalXP += amount;
    let levelUp = false;
    let newLevel = userData.level;
    while (userData.xp >= getRequiredXP(newLevel)) {
        userData.xp -= getRequiredXP(newLevel);
        newLevel++;
        levelUp = true;
    }
    if (levelUp) {
        userData.level = newLevel;
        if (member && client) {
            const message = { author: { id: userId, username: member.user.username, displayAvatarURL: member.user.displayAvatarURL }, guild: { id: member.guild.id } };
            await levelUpNotification(message, newLevel, client);
        }
    }
    levels.users[userId] = userData;
    writeLevels(levels);
    return true;
};

// XP silme (yönetim komutları için)
const removeXP = async (userId, amount, member, client) => {
    const levels = readLevels();
    const userData = levels.users[userId] || { level: 0, xp: 0, totalXP: 0, lastMessageTime: 0, activityMessageCount: 0 };
    userData.xp = Math.max(0, userData.xp - amount);
    userData.totalXP = Math.max(0, userData.totalXP - amount);
    let levelDown = false;
    let newLevel = userData.level;
    while (userData.xp < 0 && newLevel > 0) {
        newLevel--;
        userData.xp += getRequiredXP(newLevel);
        levelDown = true;
    }
    if (newLevel < 0) {
        newLevel = 0;
        userData.xp = 0;
        userData.totalXP = 0;
    }
    if (levelDown) {
        userData.level = newLevel;
    }
    levels.users[userId] = userData;
    writeLevels(levels);
    return true;
};

// Seviye ayarlama (yönetim komutları için)
const setLevel = async (userId, level, member, client) => {
    const levels = readLevels();
    const userData = levels.users[userId] || { level: 0, xp: 0, totalXP: 0, lastMessageTime: 0, activityMessageCount: 0 };
    userData.level = level;
    userData.xp = 0;
    let totalXpForNewLevel = 0;
    for (let i = 0; i < level; i++) {
        totalXpForNewLevel += getRequiredXP(i);
    }
    userData.totalXP = totalXpForNewLevel;
    if (member && client && userData.level < level) {
         const message = { author: { id: userId, username: member.user.username, displayAvatarURL: member.user.displayAvatarURL }, guild: { id: member.guild.id } };
         await levelUpNotification(message, level, client);
    }
    levels.users[userId] = userData;
    writeLevels(levels);
    return true;
};

// Seviye sıfırlama (yönetim komutları için)
const resetLevel = (userId) => {
    const levels = readLevels();
    if (!levels.users[userId]) return false;
    levels.users[userId] = { level: 0, xp: 0, totalXP: 0, lastMessageTime: 0, activityMessageCount: 0 };
    writeLevels(levels);
    return true;
};

// Tüm seviyeleri sıfırlama (bot sahibi komutu için)
const resetAllLevels = () => {
    writeLevels({ users: {} }); // Tüm kullanıcı verilerini sıfırla
    return true;
};

// Tüm kullanıcıların seviye verilerini çekme (sıralama için)
const getAllUserLevels = () => {
    const levels = readLevels();
    return Object.keys(levels.users).map(userId => ({
        userID: userId,
        level: levels.users[userId].level || 0,
        xp: levels.users[userId].xp || 0,
        totalXP: levels.users[userId].totalXP || 0
    }));
};

// Seviye sistemi durumunu ayarla
const setLevelSystemStatus = (status, channelId = null, xpPerMessage = 15) => {
    const settings = getSystemSettings();
    settings.levelSystem = {
        active: status,
        channelId: channelId,
        xpPerMessage: xpPerMessage
    };
    saveSystemSettings(settings);
};

// Mesaj başına verilecek XP miktarını ayarla
const setXPPerMessage = (amount) => {
    const settings = getSystemSettings();
    if (!settings.levelSystem) settings.levelSystem = {};
    settings.levelSystem.xpPerMessage = amount;
    saveSystemSettings(settings);
};

module.exports = {
    giveXP,
    getRequiredXP,
    getUserLevelData,
    addXP,
    removeXP,
    setLevel,
    resetLevel,
    resetAllLevels,
    getAllUserLevels,
    setLevelSystemStatus,
    setXPPerMessage
};