// commands/restart.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// Buraya yeniden başlatma yetkisi vermek istediğin kurucuların ID'lerini ekle.
// Tek bir kurucu ID'si için '123456789012345678' gibi string olarak,
// birden fazla kurucu ID'si için ['ID1', 'ID2', 'ID3'] şeklinde ekleyebilirsin.
// Şimdilik örnek olarak iki farklı ID ekledim. Kendi gerçek ID'lerinle değiştir!
const AUTHORIZED_USER_IDS = ['1048315350921510952', '1198643628780814378']; // Burayı kendi ID'lerinle Doldur!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Botu yeniden başlatır. Sadece yetkili kurucular kullanabilir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Admin yetkisi olanlar görebilir/kullanabilir

    async execute(interaction) {
        // Kullanıcının ID'sinin yetkili ID'ler arasında olup olmadığını kontrol et
        if (!AUTHORIZED_USER_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili kurucular botu yeniden başlatabilir.',
                ephemeral: true, // Sadece komutu kullanan görsün
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#ff0000') // Kırmızı renk, uyarı için uygun
            .setTitle('Bot Yeniden Başlatılıyor...')
            .setDescription('Bot şimdi yeniden başlatılıyor. Kısa bir süre sonra tekrar aktif olacaktır.')
            .setTimestamp()
            .setFooter({ text: 'SomeSub Bot', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed], ephemeral: false }); // Herkesin görmesi için ephemeral: false

        // Botun kendini yeniden başlatma işlemi
        setTimeout(() => {
            process.exit(); // Uygulamadan çıkış yapar
        }, 1000); // 1 saniye sonra çıkış yap, böylece yanıt mesajı gönderilebilir
    },
};