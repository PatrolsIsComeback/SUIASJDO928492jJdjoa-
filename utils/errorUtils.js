// utils/errorUtils.js
const fs = require('node:fs');
const path = require('node:path');

const errorsFilePath = path.join(__dirname, 'errors.json');

// Hataları dosyadan oku
function getStoredErrors() {
    try {
        const data = fs.readFileSync(errorsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Dosya yoksa veya bozuksa boş bir dizi döndür
        console.error('Hata dosyasını okurken sorun oluştu veya dosya boş/bozuk:', error.message);
        return [];
    }
}

// Yeni bir hatayı kaydet
function addError(error) {
    const errors = getStoredErrors();
    const timestamp = new Date().toISOString();
    const errorDetails = {
        timestamp: timestamp,
        message: error.message || 'Bilinmeyen Hata',
        stack: error.stack || 'Stack trace mevcut değil.',
    };

    // Maksimum hata sayısını sınırlayabiliriz (örn: son 50 hata)
    errors.push(errorDetails);
    if (errors.length > 50) { // Sadece son 50 hatayı tut
        errors.shift(); // En eski hatayı sil
    }

    try {
        fs.writeFileSync(errorsFilePath, JSON.stringify(errors, null, 2), 'utf8');
    } catch (writeError) {
        console.error('Hata dosyasını yazarken sorun oluştu:', writeError.message);
    }
}

// Tüm hataları sil
function clearErrors() {
    try {
        fs.writeFileSync(errorsFilePath, '[]', 'utf8');
        return true;
    } catch (error) {
        console.error('Hata dosyasını temizlerken sorun oluştu:', error.message);
        return false;
    }
}

module.exports = {
    getStoredErrors,
    addError,
    clearErrors,
};