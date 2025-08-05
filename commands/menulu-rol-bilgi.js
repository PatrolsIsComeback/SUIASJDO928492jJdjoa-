// commands/menulu-rol-bilgi.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBotStats, getSystemSettings } = require('../utils/db');
const { OWNER_ID } = require('../utils/config');
const { ROLES_INFO } = require('../utils/menuluRolUtils'); // Rol bilgilerini buradan çekiyoruz

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menulu-rol-bilgi')
        .setDescription('Menülü rol sistemi istatistiklerini gösterir.')
        .setDefaultMemberPermissions(0), // Sadece yetkili kişiler görebilir
    async execute(interaction) {
        // Sadece bot sahibi kullanabilir
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.', ephemeral: true });
        }

        const botStats = getBotStats();
        const settings = getSystemSettings();

        const roleUsageData = botStats.roleUsage;

        let roleStatsField = '';
        if (ROLES_INFO.length > 0) {
            ROLES_INFO.forEach(roleInfo => {
                const count = roleUsageData[roleInfo.id] || 0;
                roleStatsField += `${roleInfo.emoji} **${roleInfo.name}**: Verilme Sayısı: \`${count}\`\n`;
            });
        } else {
            roleStatsField = 'Rol bilgileri bulunamadı veya hiç rol ayarlanmamış.';
        }

        const embed = new EmbedBuilder()
            .setColor('#f8f9fa')
            .setTitle('📊 Menülü Rol Sistemi İstatistikleri')
            .addFields(
                { name: 'Durum', value: settings.menuluRolSistemi.active ? '✅ Aktif' : '❌ Kapalı', inline: true },
                { name: 'Kanal', value: settings.menuluRolSistemi.channelId ? `<#${settings.menuluRolSistemi.channelId}>` : 'Ayarlanmadı', inline: true },
                { name: 'Mesaj ID', value: settings.menuluRolSistemi.messageId || 'Yok', inline: true },
                { name: 'Rol Kullanım Sayıları', value: roleStatsField, inline: false }
            )
            .setFooter({ text: 'SomeSub Bot | Güncel Veri', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
