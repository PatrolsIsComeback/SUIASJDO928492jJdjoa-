// commands/sistemler.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getSystemSettings } = require('../utils/db');
const { OWNER_ID, UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID } = require('../utils/config');
const { hasRequiredRoles } = require('../utils/functions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sistemler')
        .setDescription('Bot üzerindeki aktif/deaktif sistemleri listeler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        // Yetki kontrolü: Sadece belirlenen yetkili rollere sahip olanlar veya bot sahibi kullanabilir.
        const requiredRoleIDs = [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID];
        if (!hasRequiredRoles(interaction.member, requiredRoleIDs) && interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.', ephemeral: true });
        }

        const settings = getSystemSettings(); // Sistem ayarlarını yükle

        // Sistem durumlarını emoji ile gösterme
        const saasStatusEmoji = settings.saas.active ? '✅ Aktif' : ' ❌ Deaktif';
        const gunaydinStatusEmoji = settings.gunaydin.active ? '✅ Aktif' : ' ❌ Deaktif'; // Günaydın sistemi için

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Bot Sistem Durumları')
            .setDescription('Bot üzerindeki farklı sistemlerin mevcut durumları aşağıdadır:')
            .addFields(
                { name: 'Selamün Aleyküm - Aleyküm Selam', value: `\`\`\`${saasStatusEmoji}\`\`\``, inline: false },
                { name: 'Günaydın Yanıt', value: `\`\`\`${gunaydinStatusEmoji}\`\`\` `, inline: false } // Günaydın sistemi alanı
                // Gelecekte buraya başka sistemleri de ekleyebilirsiniz
            )
            // Hata burada olabilir: addFields kapanışından sonra fazladan bir ) vardı. Kaldırıldı.
            .setTimestamp()
            .setFooter({ text: 'SomeSub Bot', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
