// commands/uptime.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PREFIX } = require('../utils/config'); // PREFIX'i buraya da dahil et

module.exports = {
    // Slash Komut Verileri (Mevcut)
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Botun ne kadar süredir aktif olduğunu gösterir.'),

    // Slash Komut Execute Fonksiyonu (Mevcut)
    async execute(interaction) {
        const uptimeInSeconds = Math.floor(process.uptime());
        const days = Math.floor((uptimeInSeconds / (3600 * 24)));
        const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeInSeconds % 60);

        let uptimeMessage = '';

        if (days > 0) {
            uptimeMessage += `${days} gün, `;
        }
        if (hours > 0) {
            uptimeMessage += `${hours} saat, `;
        }
        if (minutes > 0) {
            uptimeMessage += `${minutes} dakika, `;
        }
        uptimeMessage += `${seconds} saniye`;

        if (uptimeInSeconds < 1) {
            uptimeMessage = 'Bot henüz yeni başlatıldı veya bir sorun oluştu.';
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Bot Çalışma Süresi')
            .setDescription(`Bot **${uptimeMessage}** süredir aktif.`)
            .setTimestamp()
            .setFooter({ text: 'SomeSub Bot', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },

    // --- Yeni Eklenen Kısım: Prefix Komut Verileri ve Execute Fonksiyonu ---
    prefix: {
        name: 'uptime', // Prefix ile kullanılacak komut adı (örn: !uptime)
        description: 'Botun ne kadar süredir aktif olduğunu gösterir (Prefix).',
        // Prefix komutu için ayrı bir execute metodu
        async execute(message, args) {
            const uptimeInSeconds = Math.floor(process.uptime());
            const days = Math.floor((uptimeInSeconds / (3600 * 24)));
            const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
            const seconds = Math.floor(uptimeInSeconds % 60);

            let uptimeMessage = '';

            if (days > 0) {
                uptimeMessage += `${days} gün, `;
            }
            if (hours > 0) {
                uptimeMessage += `${hours} saat, `;
            }
            if (minutes > 0) {
                uptimeMessage += `${minutes} dakika, `;
            }
            uptimeMessage += `${seconds} saniye`;

            if (uptimeInSeconds < 1) {
                uptimeMessage = 'Bot henüz yeni başlatıldı veya bir sorun oluştu.';
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Bot Çalışma Süresi')
                .setDescription(`Bot **${uptimeMessage}** süredir aktif.`)
                .setTimestamp()
                .setFooter({ text: 'SomeSub Bot', iconURL: message.client.user.displayAvatarURL() }); // message.client.user

            await message.reply({ embeds: [embed] }); // interaction.reply yerine message.reply
        },
    },
};