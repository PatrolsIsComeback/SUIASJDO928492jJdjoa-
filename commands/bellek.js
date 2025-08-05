// commands/bellek.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os'); // Sistem RAM kullanımı için

module.exports = {
    // Slash Komutu Tanımlaması
    data: new SlashCommandBuilder()
        .setName('bellek')
        .setDescription('Botun veya sistemin anlık bellek kullanımını gösterir.')
        .addStringOption(option =>
            option.setName('tip')
                .setDescription('Hangi bellek bilgisini görmek istersin?')
                .setRequired(false) // Seçenek zorunlu değil
                .addChoices(
                    { name: 'Bot Belleği', value: 'bot' },
                    { name: 'Sistem Belleği', value: 'system' },
                    { name: 'Hepsi', value: 'all' } // Varsayılan olarak hepsi
                )),
    
    async execute(interaction, client) {
        // Geliştirici kontrolü (Sadece bot sahibi kullanabilir)
        const { OWNER_ID } = require('../utils/config'); // utils/config.js dosyanızda OWNER_ID tanımlı olmalı
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'Bu komutu sadece geliştirici kullanabilir.', ephemeral: true });
        }

        const requestedType = interaction.options.getString('tip') || 'all'; // Varsayılan 'all'

        const embed = new EmbedBuilder()
            .setColor('#20B2AA')
            .setTitle('Bellek Kullanım Bilgileri')
            .setTimestamp()
            .setFooter({ text: 'Somesub Bot | Bellek Kontrol', iconURL: client.user.displayAvatarURL() });

        const fields = [];

        // --- Bot Süreç Bellek Kullanımı (process.memoryUsage() ile) ---
        const processMemory = process.memoryUsage();
        const rss = (processMemory.rss / 1024 / 1024).toFixed(2); // Resident Set Size - İşletim sistemi tarafından ayrılan toplam bellek
        const heapTotal = (processMemory.heapTotal / 1024 / 1024).toFixed(2); // V8 motorunun tahsis ettiği toplam heap boyutu
        const heapUsed = (processMemory.heapUsed / 1024 / 1024).toFixed(2); // V8 motoru tarafından kullanılan heap boyutu

        const botMemoryUsage = `RSS: \`${rss}MB\`\nHeap Used: \`${heapUsed}MB / ${heapTotal}MB\``;

        // --- Sistem RAM Kullanımı (os modülü ile) ---
        const totalSystemMemoryBytes = os.totalmem(); // Toplam sistem belleği (byte)
        const freeSystemMemoryBytes = os.freemem(); // Boş sistem belleği (byte)
        const usedSystemMemoryBytes = totalSystemMemoryBytes - freeSystemMemoryBytes; // Kullanılan sistem belleği (byte)
        
        // Değerleri her zaman GB olarak gösterelim, daha okunur olacaktır.
        const totalSystemMemoryGB_formatted = (totalSystemMemoryBytes / (1024 * 1024 * 1024)).toFixed(2); 
        const usedSystemMemoryGB_formatted = (usedSystemMemoryBytes / (1024 * 1024 * 1024)).toFixed(2);
        
        // Burayı, 512MB'lık beklentinle çelişen büyük değeri açıklayacak şekilde düzenledim.
        const systemRamUsage = `Kullanılan: \`${usedSystemMemoryGB_formatted}GB\`\nToplam: \`${totalSystemMemoryGB_formatted}GB\``;

        if (requestedType === 'bot' || requestedType === 'all') {
            fields.push({ name: '🤖 Bot Süreç Belleği', value: botMemoryUsage, inline: false });
        }
        if (requestedType === 'system' || requestedType === 'all') {
            // Alan adını daha açıklayıcı hale getirdim
            fields.push({ name: '💻 Ortam Belleği (Sunucu/Konteyner)', value: systemRamUsage, inline: false });
        }
        
        if (fields.length === 0) {
            embed.setDescription("Hangi bellek bilgisini görmek istediğini belirtmedin veya geçersiz bir seçenek kullandın. Lütfen 'Bot Belleği', 'Sistem Belleği' veya 'Hepsi' seçeneklerinden birini kullan.");
        } else {
            embed.setDescription('Botun ve çalıştığı sanal/konteyner ortamının anlık bellek kullanım detayları:\n\n' +
                                 `*Not: "Ortam Belleği", botun erişebildiği sanal RAM miktarını gösterir. Bu değer, hosting sağlayıcınızın size tahsis ettiği ${totalSystemMemoryGB_formatted}GB\'lık bir kapasiteyi yansıtabilir, fiziksel sunucunun tamamını değil. Hostinginiz tarafından uygulanan 512MB gibi bir limit olsa bile, botun çalıştığı sanal katman daha büyük bir toplam gösterebilir.*`);
            embed.addFields(fields);
        }

        await interaction.reply({ embeds: [embed], ephemeral: true }).catch(err => console.error("Bellek embed'i gönderilemedi:", err));
    },
};