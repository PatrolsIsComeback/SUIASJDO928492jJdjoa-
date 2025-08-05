// utils/takvimUtils.js

const fs = require('node:fs'); // CommonJS yapısında devam ettiğimiz için require kullanıyoruz

const path = require('node:path');

const takvimFilePath = path.join(__dirname, '../data/takvim.json');

// Takvimi dosyadan oku

function getTakvim() {

    try {

        if (!fs.existsSync(takvimFilePath)) {

            fs.writeFileSync(takvimFilePath, '[]', 'utf8'); // Dosya yoksa oluştur

        }

        const data = fs.readFileSync(takvimFilePath, 'utf8');

        return JSON.parse(data);

    } catch (error) {

        console.error('Takvim dosyasını okurken veya ayrıştırırken hata oluştu:', error.message);

        return [];

    }

}

// Takvimi dosyaya kaydet

function saveTakvim(takvim) {

    try {

        fs.writeFileSync(takvimFilePath, JSON.stringify(takvim, null, 2), 'utf8');

    } catch (error) {

        console.error('Takvim dosyasını yazarken hata oluştu:', error.message);

    }

}

// Yeni bir anime kaydı ekle

function addAnimeToTakvim(anime) {

    const takvim = getTakvim();

    anime.id = Date.now().toString(); // Basit bir benzersiz ID ataması

    takvim.push(anime);

    saveTakvim(takvim);

    return anime;

}

// Anime kaydını ID'ye göre düzenle

function updateAnimeInTakvim(id, updatedAnime) {

    let takvim = getTakvim();

    const index = takvim.findIndex(anime => anime.id === id);

    if (index !== -1) {

        takvim[index] = { ...takvim[index], ...updatedAnime };

        saveTakvim(takvim);

        return takvim[index];

    }

    return null; // Bulunamadı

}

// Anime kaydını ID'ye göre sil

function deleteAnimeFromTakvim(id) {

    let takvim = getTakvim();

    const initialLength = takvim.length;

    takvim = takvim.filter(anime => anime.id !== id);

    saveTakvim(takvim);

    return takvim.length < initialLength; // Silme başarılıysa true döndür

}

module.exports = {

    getTakvim,

    saveTakvim,

    addAnimeToTakvim,

    updateAnimeInTakvim,

    deleteAnimeFromTakvim

};

