// commands/istatistik.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBotStats, getAnimes } = require('../utils/db'); // Güncel db.js'den çekiyoruz
const os = require('os'); // RAM kullanımı için

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Botun genel istatistiklerini gösterir.'),
    
    // Prefix komutu için execute fonksiyonu
    async execute(interactionOrMessage, client) {
        let isSlashCommand = interactionOrMessage.isChatInputCommand?.(); // Slash komutu olup olmadığını kontrol et

        // Geliştirici kontrolü (Sadece bot sahibi kullanabilir)
        // config.js'den OWNER_ID'yi import ettiğini varsayıyorum
        const { OWNER_ID } = require('../utils/config'); 
        if (interactionOrMessage.user.id !== OWNER_ID) {
            return interactionOrMessage.reply({ content: 'Bu komutu sadece geliştirici kullanabilir.', ephemeral: isSlashCommand });
        }

        // --- RAM Kullanımı ---
        const totalMemory = os.totalmem(); // Toplam RAM (byte)
        const freeMemory = os.freemem();   // Boş RAM (byte)
        const usedMemory = totalMemory - freeMemory; // Kullanılan RAM (byte)

        // MB cinsine çevirme
        const usedMemoryMB = (usedMemory / 1024 / 1024).toFixed(2);
        const totalMemoryGB = (totalMemory / 1024 / 1024 / 1024).toFixed(2); // GB yapalım daha okunaklı olur
        const ramUsage = `${usedMemoryMB}MB / ${totalMemoryGB}GB`;

        // --- Komut Sayısı ---
        const commandCount = client.commands.size; // Yüklü olan slash komutlarının sayısı

        // --- Veritabanından İstatistikleri Çekme ---
        const botStats = getBotStats();
        const ekliAnimeler = getAnimes().length; // animes.json dosyasındaki güncel anime sayısı

        const eklenenAnimeler = botStats.totalAnimesAdded;
        const silinenAnimeler = botStats.totalAnimesRemoved;
        const toplamKullanilanKomut = botStats.commandsUsed;
        const sonGuncellemeTimestamp = botStats.lastUpdated;

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Somesub Bot İstatistikleri')
            .setDescription('Botun anlık ve genel kullanım verileri.')
            .addFields(
                { name: 'Geliştirici', value: `<@${OWNER_ID}>`, inline: true },
                { name: 'RAM Kullanımı', value: ramUsage, inline: true },
                { name: 'Yüklü Komut Sayısı', value: `${commandCount}`, inline: true },
                { name: 'Toplam Kullanılan Komut', value: `${toplamKullanilanKomut}`, inline: true },
                { name: 'Ekli Animeler (Sistemde)', value: `${ekliAnimeler}`, inline: true },
                { name: 'Eklenen Animeler (Toplam)', value: `${eklenenAnimeler}`, inline: true },
                { name: 'Silinen Animeler (Toplam)', value: `${silinenAnimeler}`, inline: true },
                { name: 'Son Veri Güncelleme', value: `<t:${Math.floor(sonGuncellemeTimestamp / 1000)}:R>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Somesub Fansub Bot', iconURL: client.user.displayAvatarURL() });

        // Yanıtı interaction tipine göre gönder
        if (isSlashCommand) {
            await interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
        } else {
            // Eğer messageCreate'den geliyorsa, direkt mesaj olarak gönder
            await interactionOrMessage.reply({ embeds: [embed] });
        }
    },
};
