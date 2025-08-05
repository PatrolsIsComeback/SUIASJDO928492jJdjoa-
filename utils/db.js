// utils/db.js

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const animesPath = path.join(dataDir, 'animes.json');
const takvimPath = path.join(dataDir, 'takvim.json');
const systemSettingsPath = path.join(dataDir, 'systemSettings.json');
const botStatsPath = path.join(dataDir, 'botStats.json');
const userLevelsPath = path.join(dataDir, 'userLevels.json'); // Yeni: Kullanıcı seviyeleri için dosya yolu

// Veri dizini yoksa oluştur
if (!fs.existsSync(dataDir)) {
    console.log(`[DB] 'data' klasörü bulunamadı, oluşturuluyor: ${dataDir}`);
    fs.mkdirSync(dataDir, { recursive: true });
}

// Varsayılan Ayarlar
const defaultSystemSettings = {
    saas: { active: true },
    gunaydin: { active: true },
    haberSistemi: {
        active: false,
        lastCheck: 0,
        nextCheck: 0,
        lastNewsIds: {},
        channelId: null
    },
    menuluRolSistemi: {
        active: false,
        channelId: null,
        messageId: null
    },
    levelSystem: {
        active: false,
        channelId: null
    }
};

const defaultBotStats = {
    commandsUsed: 0,
    totalAnimesAdded: 0,
    totalAnimesRemoved: 0,
    roleUsage: {},
    lastUpdated: Date.now()
};

// --- Helper Functions to read/write files ---

function readJsonFile(filePath, defaultData) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`[DB] ${filePath} dosyası bulunamadı, varsayılan veri ile oluşturuluyor.`);
            writeJsonFile(filePath, defaultData);
            return defaultData;
        }

        const data = fs.readFileSync(filePath, 'utf8');
        if (data.trim() === '') {
            console.warn(`[DB] ${filePath} dosyası boş. Varsayılan veri kullanılıyor.`);
            return defaultData;
        }

        const parsedData = JSON.parse(data);

        // Varsayılan değer bir dizi ise, parsedData'yı olduğu gibi döndür
        if (Array.isArray(defaultData)) {
            return parsedData;
        }

        // Nesneler için eksik anahtarları tamamla
        return { ...defaultData, ...parsedData };

    } catch (error) {
        console.error(`[DB] Dosya okunurken hata (${filePath}):`, error);
        return defaultData;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`[DB] Dosyaya yazılırken hata (${filePath}):`, error);
    }
}

// --- System Settings ---
function getSystemSettings() {
    const settings = readJsonFile(systemSettingsPath, defaultSystemSettings);
    return { ...defaultSystemSettings, ...settings };
}

function saveSystemSettings(settings) {
    writeJsonFile(systemSettingsPath, settings);
}

// --- Bot Stats ---
function getBotStats() {
    const stats = readJsonFile(botStatsPath, defaultBotStats);
    return { ...defaultBotStats, ...stats };
}

function saveBotStats(stats) {
    stats.lastUpdated = Date.now();
    writeJsonFile(botStatsPath, stats);
}

// --- Animes ---
function getAnimes() {
    return readJsonFile(animesPath, []);
}

function saveAnimes(animes) {
    writeJsonFile(animesPath, animes);
}

// --- Takvim ---
function getTakvim() {
    return readJsonFile(takvimPath, []);
}

function saveTakvim(takvim) {
    writeJsonFile(takvimPath, takvim);
}

// --- User Levels (NEW) ---
function getUserLevels() {
    return readJsonFile(userLevelsPath, {});
}

function saveUserLevels(userLevels) {
    writeJsonFile(userLevelsPath, userLevels);
}

module.exports = {
    getSystemSettings,
    saveSystemSettings,
    getBotStats,
    saveBotStats,
    getAnimes,
    saveAnimes,
    getTakvim,
    saveTakvim,
    getUserLevels,
    saveUserLevels
};