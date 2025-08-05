// commands/geterrors.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getStoredErrors, clearErrors } = require('../utils/errorUtils'); // Hata yardımcılarını al

// Buraya hataları DM alabilecek yetkili kullanıcıların ID'lerini ekle.
// Kendi gerçek ID'lerinle değiştirmeyi unutma!
const AUTHORIZED_USER_IDS = ['1198643628780814378', '1048315350921510952']; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('geterrors')
        .setDescription('Botun kaydettiği hataları DM olarak gönderir veya temizler.')
        .addBooleanOption(option =>
            option.setName('clear')
                .setDescription('Hata listesini gönderdikten sonra temizle (Varsayılan: Hayır)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Admin yetkisi olanlar görebilir/kullanabilir

    async execute(interaction) {
        // Yetki kontrolü
        if (!AUTHORIZED_USER_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili kurucular hata kayıtlarını görebilir.',
                ephemeral: true,
            });
        }

        const clearOption = interaction.options.getBoolean('clear') || false; // clear seçeneği varsayılan olarak false

        const errors = getStoredErrors(); // Hataları dosyadan al

        if (errors.length === 0) {
            await interaction.reply({
                content: 'Şu anda kaydedilmiş bir hata bulunmamaktadır.',
                ephemeral: true,
            });
            return;
        }

        // Kullanıcıya DM göndermeden önce yanıt ver (Discord timeout'unu önlemek için)
        await interaction.deferReply({ ephemeral: true });

        const maxMessageLength = 1900; // Discord DM limiti 2000 karakter, güvenli marj bırakalım
        let errorMessages = [];
        let currentMessage = '';

        // Hataları parçalara ayırarak gönderme
        for (const error of errors) {
            const errorText = `\`\`\`js\n${error.timestamp}\nMesaj: ${error.message}\nStack: ${error.stack.substring(0, 1000)}...\n\`\`\``; // Stack'i kısalt
            
            if (currentMessage.length + errorText.length > maxMessageLength) {
                errorMessages.push(currentMessage);
                currentMessage = errorText;
            } else {
                currentMessage += errorText;
            }
        }
        if (currentMessage.length > 0) {
            errorMessages.push(currentMessage);
        }

        try {
            // Kullanıcıya DM gönder
            for (const msg of errorMessages) {
                await interaction.user.send(msg);
            }

            // Temizleme seçeneği aktifse hataları temizle
            if (clearOption) {
                clearErrors();
                await interaction.editReply({
                    content: 'Hata kayıtları başarıyla DM olarak gönderildi ve liste temizlendi.',
                    ephemeral: true,
                });
            } else {
                await interaction.editReply({
                    content: 'Hata kayıtları başarıyla DM olarak gönderildi.',
                    ephemeral: true,
                });
            }

        } catch (dmError) {
            console.error('Hata DM gönderirken sorun oluştu:', dmError);
            await interaction.editReply({
                content: 'Hata kayıtlarını DM olarak gönderirken bir sorun oluştu. DM\'leriniz kapalı olabilir.',
                ephemeral: true,
            });
        }
    },
};

