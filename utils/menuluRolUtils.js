// utils/menuluRolUtils.js (GÜNCELLENMİŞ KOD)
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js'); // ButtonBuilder kaldırıldı, StringSelectMenuBuilder eklendi
const { getSystemSettings, saveSystemSettings, getBotStats, saveBotStats } = require('./db');
const { MENULU_ROL_CHANNEL_ID, NSFW_ROLE_ID, HABER_ROLE_ID, DUYURU_ROLE_ID, ANIME_TAKIPCI_ROLE_ID, ANIME_HABER_ROLE_ID, ROLE_LOG_CHANNEL_ID } = require('./config');

// Roller ve açıklamaları (Aynı kalacak)
const ROLES_INFO = [
    {
        id: NSFW_ROLE_ID,
        name: 'NSFW İçerik Rolü',
        emoji: '🔞',
        description: 'Sunucudaki NSFW kanallarını görmek için bu rolü alın.'
    },
    {
        id: HABER_ROLE_ID,
        name: 'Anime Haber Bildirimleri Rolü',
        emoji: '📰',
        description: 'Güncel anime haber bildirimlerini almak için bu rolü alın.'
    },
    {
        id: DUYURU_ROLE_ID,
        name: 'Duyuru Bildirimleri Rolü',
        emoji: '📢',
        description: 'Önemli duyurulardan haberdar olmak için bu rolü alın.'
    },
    {
        id: ANIME_TAKIPCI_ROLE_ID,
        name: 'Anime Takipçisi Rolü',
        emoji: '🌸',
        description: 'Yeni anime ve bölüm duyurularını almak için bu rolü alın.'
    }

].filter(role => role.id); // config'de ID'si girilmeyen rolleri filtrele

/**
 * Menülü rol sistemi mesajını oluşturur ve gönderir/günceller.
 * @param {Client} client Discord bot client
 * @param {Message|CommandInteraction} interactionOrMessage Mesaj veya etkileşim objesi
 * @param {boolean} isInitialSetup İlk kurulum mu (mesajı silip yeniden göndermek için)
 */
async function sendOrUpdateRoleMenu(client, interactionOrMessage, isInitialSetup = false) {
    let settings = getSystemSettings();

    // Kanal ID'si belirtilmemişse veya geçersizse hata ver
    if (!MENULU_ROL_CHANNEL_ID) {
        const replyContent = 'Hata: `config.js` dosyasında `MENULU_ROL_CHANNEL_ID` belirtilmemiş. Lütfen ayarlayın.';
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return false;
    }

    const targetChannel = await client.channels.fetch(MENULU_ROL_CHANNEL_ID).catch(() => null);

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        const replyContent = `Hata: Menülü rol kanalı (${MENULU_ROL_CHANNEL_ID}) bulunamadı veya bir metin kanalı değil.`;
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return false;
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📢 Rol Seçim Menüsü')
        .setDescription(
            'Aşağıdaki açılır menüden istediğiniz rolleri alabilir veya mevcut rollerinizi kaldırabilirsiniz.\n' +
            'Sadece ilgilendiğiniz bildirimleri almak için seçim yapın.'
        )
        .addFields(
            ROLES_INFO.map(role => ({
                name: `${role.emoji} ${role.name}`,
                value: role.description,
                inline: false
            }))
        )
        .setFooter({ text: 'SomeSub Bot | Rol Almak/Kaldırmak İçin Seçim Yap', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    // Select Menü Oluşturma
    const options = ROLES_INFO.map(role => ({
        label: role.name,
        description: role.description.length > 50 ? role.description.substring(0, 47) + '...' : role.description, // Max 50 karakter
        value: role.id,
        emoji: role.emoji,
    })).filter(option => option.value); // Geçersiz rol ID'si olanları filtrele

    if (options.length === 0) {
        const replyContent = 'Hata: Tanımlanmış geçerli rol bulunamadı. Lütfen `config.js` dosyasındaki rol ID\'lerini kontrol edin.';
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return false;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('role_select_menu') // Özel ID
        .setPlaceholder('Rol almak veya kaldırmak için seçin...')
        .addOptions(options)
        .setMinValues(0) // Kullanıcı hiçbir şey seçmeden de gönderebilir (yani mevcut rolleri kaldırabilir)
        .setMaxValues(options.length); // Tüm rolleri seçebilir

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    try {
        let sentMessage;
        if (settings.menuluRolSistemi.active && settings.menuluRolSistemi.messageId && settings.menuluRolSistemi.channelId === MENULU_ROL_CHANNEL_ID) {
            try {
                // Mesaj zaten varsa güncelleyelim
                sentMessage = await targetChannel.messages.fetch(settings.menuluRolSistemi.messageId);
                await sentMessage.edit({ embeds: [embed], components: [actionRow] });
            } catch (err) {
                console.warn('Mevcut menü mesajı bulunamadı veya erişilemiyor, yeni mesaj gönderiliyor:', err.message);
                sentMessage = await targetChannel.send({ embeds: [embed], components: [actionRow] });
            }
        } else {
            // Sistem ilk kez açılıyorsa veya mesaj ID'si/kanal ID'si değişmişse eski mesajı silip yeni gönder
            if (settings.menuluRolSistemi.messageId && settings.menuluRolSistemi.channelId) {
                try {
                    const oldChannel = await client.channels.fetch(settings.menuluRolSistemi.channelId).catch(() => null);
                    if (oldChannel && oldChannel.type === ChannelType.GuildText) {
                        const oldMessage = await oldChannel.messages.fetch(settings.menuluRolSistemi.messageId).catch(() => null);
                        if (oldMessage) {
                            await oldMessage.delete();
                        }
                    }
                } catch (err) {
                    console.error('Eski menü mesajı silinirken hata:', err.message);
                }
            }
            sentMessage = await targetChannel.send({ embeds: [embed], components: [actionRow] });
        }

        settings.menuluRolSistemi.active = true;
        settings.menuluRolSistemi.messageId = sentMessage.id;
        settings.menuluRolSistemi.channelId = targetChannel.id;
        saveSystemSettings(settings);

        const replyContent = `Menülü rol sistemi başarıyla ${targetChannel} kanalına kuruldu/güncellendi!`;
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return true;

    } catch (error) {
        console.error('Menülü rol menüsü gönderilirken/güncellenirken hata:', error);
        const replyContent = 'Menülü rol menüsü kurulurken bir hata oluştu. Botun kanala mesaj gönderme izni olduğundan emin olun.';
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return false;
    }
}

/**
 * Menülü rol sistemini kapatır ve mesajı siler. (AYNI KALACAK)
 * @param {Client} client Discord bot client
 * @param {Message|CommandInteraction} interactionOrMessage Mesaj veya etkileşim objesi
 */
async function disableRoleMenu(client, interactionOrMessage) {
    let settings = getSystemSettings();

    if (!settings.menuluRolSistemi.active) {
        const replyContent = 'Menülü rol sistemi zaten kapalı.';
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return false;
    }

    if (!settings.menuluRolSistemi.messageId || !settings.menuluRolSistemi.channelId) {
        settings.menuluRolSistemi.active = false;
        settings.menuluRolSistemi.messageId = null;
        settings.menuluRolSistemi.channelId = null;
        saveSystemSettings(settings);
        const replyContent = 'Menülü rol mesajının ID\'si veya kanalı bulunamadı, ancak sistem kapatıldı.';
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
        return false;
    }

    const targetChannel = await client.channels.fetch(settings.menuluRolSistemi.channelId).catch(() => null);
    if (targetChannel && targetChannel.type === ChannelType.GuildText) {
        try {
            const messageToDelete = await targetChannel.messages.fetch(settings.menuluRolSistemi.messageId);
            if (messageToDelete) {
                await messageToDelete.delete();
            }
        } catch (err) {
            console.warn('Menü mesajı silinirken hata oluştu veya zaten silinmiş:', err.message);
        }
    }

    settings.menuluRolSistemi.active = false;
    settings.menuluRolSistemi.messageId = null;
    settings.menuluRolSistemi.channelId = null;
    saveSystemSettings(settings);

    const replyContent = 'Menülü rol sistemi başarıyla kapatıldı ve menü mesajı silindi.';
    if (interactionOrMessage.replied || interactionOrMessage.deferred) {
        await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
    } else {
        await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
    }
    return true;
}

/**
 * Kullanıcıya rol verir veya rolünü kaldırır ve istatistikleri günceller. (Bu fonksiyonun adı değişecek veya ayrı bir selectMenuToggleRoles fonksiyonu yazılabilir)
 * Bu fonksiyon artık doğrudan tek bir rolü değil, bir array'i yönetecek.
 * @param {StringSelectMenuInteraction} interaction Seçim menüsü etkileşimi objesi
 * @param {string[]} selectedRoleIds Seçilen rollerin ID'leri
 */
async function processSelectedRoles(interaction, selectedRoleIds) {
    await interaction.deferReply({ ephemeral: true }); // Kullanıcıya anlık geri bildirim ver

    const member = interaction.member;
    const client = interaction.client; // Log kanalı için client'a erişim
    let botStats = getBotStats();

    const rolesGiven = [];
    const rolesRemoved = [];
    const errors = [];

    // Tüm tanımlı rollerin ID'leri
    const allRoleIds = ROLES_INFO.map(r => r.id);

    for (const roleId of allRoleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        const roleInfo = ROLES_INFO.find(r => r.id === roleId);
        const roleName = roleInfo ? roleInfo.name : 'Bilinmeyen Rol';

        if (!role) {
            errors.push(`\`${roleName}\` rolü bulunamadı.`);
            continue;
        }

        if (selectedRoleIds.includes(roleId)) {
            // Eğer rol menüde seçilmişse ve kullanıcıda yoksa, ver
            if (!member.roles.cache.has(roleId)) {
                try {
                    await member.roles.add(roleId);
                    rolesGiven.push(roleName);
                    if (typeof botStats.roleUsage[roleId] === 'undefined') {
                        botStats.roleUsage[roleId] = 0;
                    }
                    botStats.roleUsage[roleId]++; // Rol verildiğinde sayacı artır
                    logRoleAction(client, member.user, roleName, 'Verildi', '00FF00'); // Yeşil
                } catch (error) {
                    errors.push(`\`${roleName}\` rolü verilemedi.`);
                    logRoleAction(client, member.user, roleName, 'Başarısız (Verilemedi)', 'FF0000', error.message);
                }
            }
        } else {
            // Eğer rol menüde seçilmemişse ve kullanıcıda varsa, kaldır
            if (member.roles.cache.has(roleId)) {
                try {
                    await member.roles.remove(roleId);
                    rolesRemoved.push(roleName);
                    if (typeof botStats.roleUsage[roleId] === 'undefined') { // Olur da eksik olursa diye kontrol
                        botStats.roleUsage[roleId] = 0;
                    }
                    if (botStats.roleUsage[roleId] > 0) { // Negatife düşmemesi için
                        botStats.roleUsage[roleId]--; // Rol alındığında sayacı azalt
                    }
                    logRoleAction(client, member.user, roleName, 'Alındı', 'FFA500'); // Turuncu
                } catch (error) {
                    errors.push(`\`${roleName}\` rolü kaldırılamadı.`);
                    logRoleAction(client, member.user, roleName, 'Başarısız (Kaldırılamadı)', 'FF0000', error.message);
                }
            }
        }
    }

    saveBotStats(botStats); // Tüm değişiklikleri bir kerede kaydet

    let replyMessage = '';
    if (rolesGiven.length > 0) {
        replyMessage += `✅ Başarıyla verilen roller: ${rolesGiven.map(r => `\`${r}\``).join(', ')}\n`;
    }
    if (rolesRemoved.length > 0) {
        replyMessage += `❌ Başarıyla kaldırılan roller: ${rolesRemoved.map(r => `\`${r}\``).join(', ')}\n`;
    }
    if (errors.length > 0) {
        replyMessage += `⚠️ Bazı roller için sorun oluştu: ${errors.map(e => `\`${e}\``).join(', ')}\nBotun yetkilerinin yeterli olduğundan ve rollerin bot rolünün altında olduğundan emin olun.`;
    }

    if (replyMessage === '') {
        replyMessage = 'Herhangi bir rol değişikliği yapılmadı. Mevcut rolleriniz zaten seçiminize uygun.';
    }

    await interaction.editReply({ content: replyMessage });
}


/**
 * Rol alma/verme işlemlerini bir log kanalına kaydeder. (AYNI KALACAK)
 * @param {Client} client Discord bot client
 * @param {User} user İşlemi yapan kullanıcı
 * @param {string} roleName Etkilenen rolün adı
 * @param {string} action Gerçekleşen eylem (Verildi, Alındı, Başarısız vb.)
 * @param {string} color Embed rengi (hex kodu)
 * @param {string} [errorMessage] Hata mesajı (sadece başarısız durumlarda)
 */
async function logRoleAction(client, user, roleName, action, color, errorMessage = null) {
    if (!ROLE_LOG_CHANNEL_ID) return;

    const logChannel = await client.channels.fetch(ROLE_LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Rol İşlemi: ${roleName}`)
        .addFields(
            { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Eylem', value: action, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() });

    if (errorMessage) {
        embed.addFields({ name: 'Hata Detayı', value: `\`\`\`${errorMessage.substring(0, 1000)}\`\`\``, inline: false });
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Rol log mesajı gönderilirken hata:', err.message);
    }
}


module.exports = {
    sendOrUpdateRoleMenu,
    disableRoleMenu,
    processSelectedRoles, // Fonksiyonun adı değişti
    ROLES_INFO
};
