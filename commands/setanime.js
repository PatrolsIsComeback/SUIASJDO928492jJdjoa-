// commands/setanime.js

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { OWNER_ID, UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID } = require('../utils/config');
const { hasRequiredRoles } = require('../utils/functions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setanime')
        .setDescription('Anime ekleme ve yönetimi için admin panelini açar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        // BURADA GÜNCELLEME YAPILDI: OWNER_ID tek bir string ID olarak kontrol ediliyor.
        const requiredRoleIDs = [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID];
        if (!hasRequiredRoles(interaction.member, requiredRoleIDs) && interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.', ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Anime Yönetim Paneli')
            .setDescription('Aşağıdaki butonları kullanarak animeleri yönetebilirsiniz.')
            .addFields(
                { name: '➕ Yeni Anime Ekle', value: 'Yeni bir anime kaydı oluşturur.', inline: false },
                { name: '🗑️ Anime Sil', value: 'Mevcut bir anime kaydını siler.', inline: false },
                { name: '📋 Anime Listele', value: 'Sistemdeki tüm animeleri listeler.', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'SomeSub Bot', iconURL: interaction.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('anime_add')
                    .setLabel('➕ Yeni Anime Ekle')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('anime_delete')
                    .setLabel('🗑️ Anime Sil')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('anime_list')
                    .setLabel('📋 Anime Listele')
                    .setStyle(ButtonStyle.Primary),
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};
