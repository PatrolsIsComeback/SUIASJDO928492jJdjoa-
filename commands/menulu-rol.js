// commands/menulu-rol.js
const { SlashCommandBuilder } = require('discord.js');
const { OWNER_ID, UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID } = require('../utils/config');
const { sendOrUpdateRoleMenu, disableRoleMenu } = require('../utils/menuluRolUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menulu-rol')
        .setDescription('Menülü rol sistemi ile ilgili işlemleri yapar.')
        .setDefaultMemberPermissions(0) // Varsayılan olarak kimse kullanamaz
        .addSubcommand(subcommand =>
            subcommand
                .setName('aç')
                .setDescription('Menülü rol sistemini açar ve mesajı gönderir/günceller.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Menülü rol sistemini kapatır ve menü mesajını siler.')
        ),
    async execute(interaction) {
        // Yalnızca bot sahibi veya yetkili roller kullanabilir
        const allowedRoles = [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID];
        const isOwner = interaction.user.id === OWNER_ID;
        const hasRole = allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!isOwner && !hasRole) {
            return interaction.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'aç') {
            await sendOrUpdateRoleMenu(interaction.client, interaction, true); // True: İlk kurulum/yeniden kurma
        } else if (subcommand === 'kapat') {
            await disableRoleMenu(interaction.client, interaction);
        }
    },
};
