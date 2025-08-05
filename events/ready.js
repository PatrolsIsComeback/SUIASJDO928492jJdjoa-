// events/ready.js
const { ActivityType } = require('discord.js'); // Discord.js v14 için ActivityType import ediyoruz
const { getBotStats } = require('../utils/db'); // Toplam anime sayısını almak için

module.exports = {
    name: 'ready', // Event'in adı
    once: true,    // Bu event'in sadece bir kere çalışmasını sağlar (bot başladığında)
    async execute(client) {
        console.log(`[BOT] ${client.user.tag} olarak giriş yapıldı ve hazır!`);

        // Bot istatistiklerini yükle
        const botStats = getBotStats();
        const totalAnimes = getBotStats.saveAnimes; // Toplam eklenen anime sayısı

        // Botun durumunu ayarla
        client.user.setPresence({
            activities: [{
                name: `SomeSub | Anime izliyor karışma / !yardım`,   // Görünen aktivite adı
                type: ActivityType.Playing, // Aktivite tipi (WATCHING = İzliyor)
            }],
            status: 'online', // Botun durumu (online, idle, dnd, invisible)
        });

        console.log(`[PRESENCE] Bot durumu ayarlandı: ${totalAnimes} Anime | SomeSub izliyor.`);
    },
};