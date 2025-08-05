// utils/config.js

module.exports = {
    TOKEN: 'TOKEN_HERE', // Botunuzun tokeni
    CLIENT_ID: '1396480803340554361', // Botunuzun Client ID'si
    GUILD_ID: '1388093711828910140', // Botun kullanılacağı sunucunun ID'si
    OWNER_ID:  '1198643628780814378',// Bot sahibinin Discord ID'si
    CO_OWNER_IDS: ['1198643628780814378', '1198643628780814378'],  
    ANIME_NOTIFICATION_ROLE_ID: '1388094328265642004',
    UPLOADER_ROLE_ID: '1388094328982994974', // Yükleyici rolünün ID'si
    TRANSLATOR_ROLE_ID: '1388126456428630046', // Çevirmen rolünün ID'si
    ANIME_PANEL_CHANNEL_ID: '1396485891781820537', // /setanime panelinin gönderileceği kanal ID'si (Örn: #anime-panel)
    ANIME_LOG_CHANNEL_ID: '1396483804159414322', 
    
    PREFIX: '!',
    
    // Anime ekleme/durum güncellemelerinin düşeceği kanal ID'si (Örn: #anime-log)
    ANIME_NOTIFICATION_CHANNEL_ID: '1389508917327036536', // Anime tamamlandığında nihai duyurunun düşeceği kanal ID'si (Örn: #anime-bildirim)

    // --- YENİ: Menülü Rol Sistemi Ayarları ---
    MENULU_ROL_CHANNEL_ID: '1397981608644186334', // Menü mesajının gönderileceği kanal ID'si (örn: '123456789012345678')
    
    // Roller ve ID'leri - Lütfen KENDİ SUNUCUNUZDAKİ ROL ID'LERİNİ BURAYA GİRİN!
    NSFW_ROLE_ID: '1395084487985074176', // Örn: '123456789012345679'
    HABER_ROLE_ID: '1397999380404899900',   // Örn: '123456789012345680'
    DUYURU_ROLE_ID: '1398000098566213632', // Örn: '123456789012345681'
    ANIME_TAKIPCI_ROLE_ID: '1388094328265642004', // Örn: '123456789012345682'

    // İsteğe bağlı: Menü rolü alındığında/verildiğinde özel bildirimler için log kanalı
    ROLE_LOG_CHANNEL_ID: '1397981982620778536', // Botun rol verme/çıkarma loglarını göndereceği kanal (örn: '123456789012345683')

    // --- YENİ: Adam Asmaca Sistemi Ayarları ---
    HANGMAN_CATEGORY_ID: '1398331805056106546', // Adam asmaca odalarının oluşturulacağı kategorinin ID'si
    ADAM_ASMACA_CREATE_ROOM_CHANNEL_ID: '1398332044773429349', // !adam-asmaca-oda-olustur komutunun kullanılacağı kanal
    SINGLE_HANGMAN_CATEGORY: 'hayvanlar' // Oyun için kullanılacak tek kelime kategorisi (data/words.json'dan)
};n kullanılacak tek kelime kategorisi (data/words.json'dan)
};