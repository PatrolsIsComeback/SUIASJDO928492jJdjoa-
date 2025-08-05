// utils/helpers.js

/**
 * Benzersiz bir ID oluşturur.
 * Prefiks ve uzunluk belirtilebilir.
 * @param {string} prefix - ID'nin ön eki (örn: 'ANM', 'TKM').
 * @param {number} length - ID'nin sayısal kısmının uzunluğu (örn: 4 için 0001).
 * @returns {string} Benzersiz ID.
 */
function generateUniqueId(prefix = '', length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = prefix;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Basit bir örnek, daha sağlam bir benzersizlik için timestamp veya UUID kütüphanesi kullanılabilir.
    return result;
}

/**
 * Benzersiz bir Anime ID'si oluşturur (Örn: ANM-0001).
 * Mevcut animelerin ID'leri ile çakışmayacak şekilde yeni bir ID döndürür.
 *
 * @param {Array<Object>} existingAnimes - Mevcut anime objelerinin listesi.
 * @returns {string} Benzersiz Anime ID'si.
 */
function generateAnimeID(existingAnimes = []) {
    let newId;
    let counter = 1;

    do {
        newId = `ANM-${String(counter).padStart(4, '0')}`;
        counter++;
    } while (existingAnimes.some(anime => anime.id === newId));

    return newId;
}


/**
 * Belirli bir süre (ms) bekler.
 * @param {number} ms - Beklenecek milisaniye cinsinden süre.
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Diğer yardımcı fonksiyonlar buraya eklenebilir.

module.exports = {
    generateAnimeID,
    generateUniqueId, // YENİ EKLENEN
    sleep,
};
