// events/messageCreate.js

const { PREFIX, OWNER_ID, UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID, MENULU_ROL_CHANNEL_ID, ADAM_ASMACA_CREATE_ROOM_CHANNEL_ID } = require('../utils/config');
const { EmbedBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const os = require('os');
const { startNewsChecker, stopNewsChecker, getCurrentNewsJob, RSS_FEEDS } = require('../utils/newsChecker');
const { sendOrUpdateRoleMenu, disableRoleMenu, ROLES_INFO } = require('../utils/menuluRolUtils');
const hangmanManager = require('../utils/hangmanManager');
const levelSystem = require('../utils/levelSystem'); // Seviye sistemi modülünü dahil et
const unvanSystem = require('../utils/unvanSystem'); // Unvan sistemi modülünü dahil et
const path = require('path');

// Tüm sistem ayarlarını okuyacak genel bir fonksiyon
const getSystemSettings = () => {
    const fs = require('fs');
    const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json');
    if (!fs.existsSync(systemSettingsPath)) {
        return {
            saas: { active: false },
            gunaydin: { active: false },
            haberSistemi: { active: false, lastCheck: 0, nextCheck: 0 },
            menuluRolSistemi: { active: false, channelId: null, messageId: null },
            levelSystem: { active: false, channelId: null, xpPerMessage: 15 },
            unvanSystem: { active: false }
        };
    }
    const data = fs.readFileSync(systemSettingsPath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(`[SYSTEM_SETTINGS] systemSettings.json okuma hatası: ${e.message}`);
        return {
            saas: { active: false },
            gunaydin: { active: false },
            haberSistemi: { active: false, lastCheck: 0, nextCheck: 0 },
            menuluRolSistemi: { active: false, channelId: null, messageId: null },
            levelSystem: { active: false, channelId: null, xpPerMessage: 15 },
            unvanSystem: { active: false }
        };
    }
};

// Bot istatistikleri için yeni bir okuma/yazma fonksiyonu
const botStatsPath = path.join(__dirname, '../data/botStats.json');
const getBotStats = () => {
    const fs = require('fs');
    if (!fs.existsSync(botStatsPath)) {
        return { commandsUsed: 0, totalAnimesAdded: 0, totalAnimesRemoved: 0, lastUpdated: Date.now(), roleUsage: {} };
    }
    const data = fs.readFileSync(botStatsPath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(`[BOT_STATS] botStats.json okuma hatası: ${e.message}`);
        return { commandsUsed: 0, totalAnimesAdded: 0, totalAnimesRemoved: 0, lastUpdated: Date.now(), roleUsage: {} };
    }
};
const saveBotStats = (data) => {
    const fs = require('fs');
    fs.writeFileSync(botStatsPath, JSON.stringify(data, null, 2), 'utf8');
};

// Anime verileri için (eski db.json'dan geliyorsa)
const animesPath = path.join(__dirname, '../data/animes.json');
const getAnimes = () => {
    const fs = require('fs');
    if (!fs.existsSync(animesPath)) {
        return [];
    }
    const data = fs.readFileSync(animesPath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(`[ANIMES] animes.json okuma hatası: ${e.message}`);
        return [];
    }
};


module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const content = message.content.toLowerCase();
        let settings = getSystemSettings(); // Genel ayarları çek


        const checkPermission = (member, requiredRoleIDs, ownerId) => {
            const allAllowedRoles = [...requiredRoleIDs, ...Array.isArray(ownerId) ? ownerId : [ownerId]];
            // Kontrol: Bot sahibinin ID'si, botun kendi ID'si veya herhangi bir gerekli role sahip olma
            return member.user.id === OWNER_ID || member.user.id === client.user.id || allAllowedRoles.some(roleId => member.roles.cache.has(roleId));
        };

        // Her mesaj için XP verme ve Unvan sistemi aktivite takibi
        try {
            await levelSystem.giveXP(message, client);

            // Unvan sistemi için nightMessages sayacı güncellemesi
            if (settings.unvanSystem && settings.unvanSystem.active) {
                const now = Date.now();
                const currentHour = new Date(now).getHours();
                const currentMinute = new Date(now).getMinutes();

                const allTitles = unvanSystem.getAllTitles();
                const userData = unvanSystem.getUserUnvanData(message.author.id); // Kullanıcıya ait güncel veriyi çek

                for (const title of allTitles) {
                    if (title.type === 'activity_time_based') {
                        const [startHour, startMinute] = title.requirements.startTime.split(':').map(Number);
                        const [endHour, endMinute] = title.requirements.endTime.split(':').map(Number);

                        let inTimeWindow = false;
                        if (startHour < endHour) { // Örn: 00:00 - 05:00
                            inTimeWindow = (currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute)) &&
                                           (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute));
                        } else { // Örn: 22:00 - 02:00 (gece yarısını geçen)
                            inTimeWindow = (currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute)) ||
                                           (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute));
                        }

                        if (inTimeWindow) {
                            userData.nightMessages = (userData.nightMessages || 0) + 1; // Mesaj zaman aralığındaysa artır
                        }
                    }
                }
                // Kullanıcı verilerini güncelle ve kaydet (titles_data.json'a)
                // Bu kısımda `unvanSystem.readTitlesData()` ve `unvanSystem.writeTitlesData()` doğrudan kullanılmalı
                // Ancak bu fonksiyonların unvanSystem.js'den export edildiğinden emin olmalıyız.
                // Eğer edilmediyse, aşağıdaki gibi manuel olarak dosyayı okuyup yazmak gerekir:
                const fs = require('fs');
                const titlesDataPath = path.join(__dirname, '../data/titles_data.json');
                let titlesData = {};
                if (fs.existsSync(titlesDataPath)) {
                    try {
                        titlesData = JSON.parse(fs.readFileSync(titlesDataPath, 'utf8'));
                    } catch (e) {
                        console.error(`[UNVAN_SYSTEM_MSG_CREATE] titles_data.json okuma hatası: ${e.message}`);
                    }
                }
                titlesData.users = titlesData.users || {};
                titlesData.users[message.author.id] = userData;
                fs.writeFileSync(titlesDataPath, JSON.stringify(titlesData, null, 2), 'utf8');
            }

            await unvanSystem.checkAndAwardTitles(message.author.id, message.member, client);
        } catch (error) {
            console.error(`[LEVEL/UNVAN_SYSTEM] Mesaj işlenirken hata oluştu:`, error);
        }

        // ---------------------- PREFIX KOMUTLARI ----------------------
        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            try {
                const botStats = getBotStats();
                botStats.commandsUsed++;
                saveBotStats(botStats);

                // Adam Asmaca Sistem Kontrolü: Bu komutlar her zaman çalışmalı
                if (commandName === 'adam-asmaca-ac') {
                    if (message.author.id !== OWNER_ID) {
                        return message.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.' });
                    }
                    hangmanManager.setHangmanSystemStatus(true);
                    return message.reply('Adam Asmaca sistemi başarıyla açıldı!');
                }

                if (commandName === 'adam-asmaca-kapat') {
                    if (message.author.id !== OWNER_ID) {
                        return message.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.' });
                    }
                    hangmanManager.setHangmanSystemStatus(false);
                    return message.reply('Adam Asmaca sistemi başarıyla kapatıldı!');
                }

                if (!hangmanManager.getHangmanSystemStatus() && commandName.startsWith('adam-asmaca-') && commandName !== 'adam-asmaca-ac' && commandName !== 'adam-asmaca-kapat') {
                    if (message.author.id !== OWNER_ID) {
                        return message.reply({ content: 'Adam Asmaca sistemi şu an kapalı. Lütfen bir yetkilinin sistemi açmasını bekleyin.' });
                    }
                }

                // Mevcut komutlar...
                // !sa-as ve !gunaydin gibi komutlar için systemSettings'i kullanmaya devam et
                if (commandName === 'sa-as') {
                    if (args[0] === 'aç' || args[0] === 'kapat') {
                        if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                            return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                        }
                        const newState = args[0] === 'aç';
                        settings.saas.active = newState;
                        // Ayarları geri kaydet
                        const fs = require('fs');
                        const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json');
                        fs.writeFileSync(systemSettingsPath, JSON.stringify(settings, null, 2), 'utf8');

                        const embed = new EmbedBuilder()
                            .setColor(newState ? '#4CAF50' : '#F4436')
                            .setTitle(`👋 SA-AS Sistemi ${newState ? 'Açıldı!' : 'Kapatıldı!'}`)
                            .setDescription(`Selamün Aleyküm - Aleyküm Selam yanıt sistemi başarıyla **${newState ? 'aktif edildi.' : 'pasif hale getirildi.'}**`)
                            .setFooter({ text: 'SomeSub Bot | Sistem Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else {
                        return message.reply(`Kullanım: \`${PREFIX}sa-as [aç/kapat]\``);
                    }
                }

                if (commandName === 'gunaydin') {
                    if (args[0] === 'aç' || args[0] === 'kapat') {
                        if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                            return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                        }
                        const newState = args[0] === 'aç';
                        settings.gunaydin.active = newState;
                         // Ayarları geri kaydet
                         const fs = require('fs');
                         const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json');
                         fs.writeFileSync(systemSettingsPath, JSON.stringify(settings, null, 2), 'utf8');

                        const embed = new EmbedBuilder()
                            .setColor(newState ? '#FFC107' : '#9E9E90')
                            .setTitle(`☀️ Günaydın Sistemi ${newState ? 'Açıldı!' : 'Kapatıldı!'}`)
                            .setDescription(`Günaydın yanıt sistemi başarıyla **${newState ? 'aktif edildi.' : 'pasif hale getirildi.'}**`)
                            .setFooter({ text: 'SomeSub Bot | Sistem Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else {
                        return message.reply(`Kullanım: \`${PREFIX}gunaydin [aç/kapat]\``);
                    }
                }

                if (commandName === 'haber-sistemi') {
                    if (!checkPermission(message.member, [OWNER_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca bot sahibi kullanabilir.' });
                    }

                    const action = args[0] ? args[0].toLowerCase() : null;

                    if (action === 'aç' || action === 'ac') {
                        if (settings.haberSistemi.active) {
                            return message.reply('Haber sistemi zaten aktif!');
                        }
                        settings.haberSistemi.active = true;
                        const fs = require('fs');
                        const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json');
                        fs.writeFileSync(systemSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
                        startNewsChecker(client);
                        const embed = new EmbedBuilder()
                            .setColor('#2196F3')
                            .setTitle('📰 Haber Sistemi Aktif Edildi!')
                            .setDescription('Haber sistemi başarıyla açıldı! Haberler artık düzenli olarak kontrol edilecek.')
                            .setFooter({ text: 'SomeSub Bot | Sistem Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else if (action === 'kapat') {
                        if (!settings.haberSistemi.active) {
                            return message.reply('Haber sistemi zaten kapalı!');
                        }
                        settings.haberSistemi.active = false;
                        const fs = require('fs');
                        const systemSettingsPath = path.join(__dirname, '../data/systemSettings.json');
                        fs.writeFileSync(systemSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
                        stopNewsChecker();
                        const embed = new EmbedBuilder()
                            .setColor('#F44336')
                            .setTitle('⛔ Haber Sistemi Pasif Edildi!')
                            .setDescription('Haber sistemi başarıyla kapatıldı! Yeni haberler gönderilmeyecek.')
                            .setFooter({ text: 'SomeSub Bot | Sistem Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else {
                        return message.reply(`Kullanım: \`${PREFIX}haber-sistemi [aç/kapat]\``);
                    }
                }

                if (commandName === 'haber-bilgi') {
                    settings = getSystemSettings();

                    const isActive = settings.haberSistemi.active;
                    let lastCheckMessage;
                    let nextCheckMessage;

                    if (settings.haberSistemi.lastCheck) {
                        lastCheckMessage = `<t:${Math.floor(settings.haberSistemi.lastCheck / 1000)}:R>`;
                    } else {
                        lastCheckMessage = 'Henüz hiç kontrol edilmedi.';
                    }

                    if (isActive) {
                        if (settings.haberSistemi.nextCheck) {
                            nextCheckMessage = `<t:${Math.floor(settings.haberSistemi.nextCheck / 1000)}:R>`;
                        } else {
                            const newsJob = getCurrentNewsJob();
                            if (newsJob && newsJob.nextInvocation()) {
                                nextCheckMessage = `<t:${Math.floor(newsJob.nextInvocation().getTime() / 1000)}:R>`;
                            } else {
                                nextCheckMessage = 'Ayarlanıyor...';
                            }
                        }
                    } else {
                        nextCheckMessage = 'Sistem kapalı, zamanlanmış kontrol yok.';
                    }

                    const embed = new EmbedBuilder()
                        .setColor(isActive ? '#28a745' : '#dc3545')
                        .setTitle('📰 Haber Sistemi Durumu')
                        .setDescription('Botun haber sisteminin anlık durumu ve bilgileri.')
                        .addFields(
                            { name: '📊 Durum', value: isActive ? '✅ Aktif' : '❌ Kapalı', inline: true },
                            { name: '🌐 Çeviri Sistemi', value: '✅ Aktif', inline: true },
                            { name: '\u200B', value: '\u200B', inline: true },
                            { name: '⏰ Son Kontrol', value: lastCheckMessage, inline: false },
                            { name: '⏳ Bir Sonraki Kontrol', value: nextCheckMessage, inline: false }
                        );

                    let rssSourcesField = '';
                    if (RSS_FEEDS.length > 0) {
                        RSS_FEEDS.forEach((feed, index) => {
                            rssSourcesField += `\`${index + 1}.\` **${feed.name}**: Dil: **${feed.language.toUpperCase()}**\n`;
                        });
                    } else {
                        rssSourcesField = 'Haber kaynakları tanımlanmamış.';
                    }
                    embed.addFields({ name: '📚 Haber Kaynakları', value: rssSourcesField, inline: false });

                    embed.setFooter({ text: 'SomeSub Bot | Haber Bilgisi', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'menulu-rol') {
                    if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                    }

                    const action = args[0] ? args[0].toLowerCase() : null;

                    if (action === 'aç' || action === 'ac') {
                        const success = await sendOrUpdateRoleMenu(client, message, true);
                        if(success) {
                            const embed = new EmbedBuilder()
                                .setColor('#8A2BE2')
                                .setTitle('📌 Menülü Rol Sistemi Kuruldu/Güncellendi!')
                                .setDescription(`Menülü rol sistemi başarıyla ${MENULU_ROL_CHANNEL_ID ? `<#${MENULU_ROL_CHANNEL_ID}>` : 'belirlenen kanala'} kuruldu veya güncellendi.`)
                                .setFooter({ text: 'SomeSub Bot | Sistem Yönetimi' })
                                .setTimestamp();
                            await message.reply({ embeds: [embed] });
                        } else {
                            await message.reply('Menülü rol sistemi kurulurken bir hata oluştu. Lütfen bot sahibine bildirin.');
                        }
                    } else if (action === 'kapat') {
                        const success = await disableRoleMenu(client, message);
                        if(success) {
                            const embed = new EmbedBuilder()
                                .setColor('#F08080')
                                .setTitle('🗑️ Menülü Rol Sistemi Kapatıldı!')
                                .setDescription('Menülü rol sistemi başarıyla kapatıldı ve ilgili mesaj silindi.')
                                .setFooter({ text: 'SomeSub Bot | Sistem Yönetimi' })
                                .setTimestamp();
                            await message.reply({ embeds: [embed] });
                        } else {
                            await message.reply('Menülü rol sistemi kapatılırken bir hata oluştu veya zaten aktif değildi.');
                        }
                    } else {
                        return message.reply(`Kullanım: \`${PREFIX}menulu-rol [aç/kapat]\`\nNot: Menü ${MENULU_ROL_CHANNEL_ID ? `<#${MENULU_ROL_CHANNEL_ID}>` : 'belirlenen kanala'} kurulur.`);
                    }
                    return;
                }

                if (commandName === 'menulu-rol-bilgi') {
                    if (message.author.id !== OWNER_ID) {
                        return message.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.' });
                    }

                    const botStats = getBotStats();
                    settings = getSystemSettings();

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
                        .setColor('#9C27B0')
                        .setTitle('📊 Menülü Rol Sistemi İstatistikleri')
                        .setDescription('Botun menülü rol sisteminin mevcut durumu ve kullanım verileri.')
                        .addFields(
                            { name: 'Aktif Durum', value: settings.menuluRolSistemi.active ? '✅ Aktif' : '❌ Pasif', inline: true },
                            { name: 'Kanal', value: settings.menuluRolSistemi.channelId ? `<#${settings.menuluRolSistemi.channelId}>` : 'Ayarlanmadı', inline: true },
                            { name: 'Mesaj ID', value: settings.menuluRolSistemi.messageId || 'Yok', inline: true },
                            { name: 'Rol Kullanım Sayıları', value: roleStatsField, inline: false }
                        )
                        .setFooter({ text: 'SomeSub Bot | Güncel Veri', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'istatistik') {
                    const developerId = OWNER_ID;
                    if (message.author.id !== developerId) {
                        return message.reply({ content: 'Bu komutu sadece geliştirici kullanabilir.' });
                    }

                    const totalMemory = os.totalmem();
                    const freeMemory = os.freemem();
                    const usedMemory = totalMemory - freeMemory;

                    const usedMemoryMB = (usedMemory / 1024 / 1024).toFixed(2);
                    const totalMemoryGB = (totalMemory / 1024 / 1024 / 1024).toFixed(2);
                    const ramUsage = `\`${usedMemoryMB}MB / ${totalMemoryGB}GB\``;

                    const commandCount = 50; // Geçici olarak sabitledim, eğer dinamik çekmek zorsa

                    const botStats = getBotStats();
                    const ekliAnimeler = getAnimes().length; // anime.json'dan çekilmeli

                    const eklenenAnimeler = botStats.totalAnimesAdded;
                    const silinenAnimeler = botStats.totalAnimesRemoved;
                    const toplamKullanilanKomut = botStats.commandsUsed;
                    const sonGuncellemeTimestamp = botStats.lastUpdated;


                    const embed = new EmbedBuilder()
                        .setColor('#FF9900')
                        .setTitle('📊 Bot İstatistikleri')
                        .setDescription('Botun genel performansı ve kullanım verileri.')
                        .addFields(
                            { name: '👤 Geliştirici', value: `<@${developerId}>`, inline: true },
                            { name: '💾 RAM Kullanımı', value: ramUsage, inline: true },
                            { name: '⚙️ Yüklü Komut Sayısı', value: `\`${commandCount}\``, inline: true },
                            { name: '\u200B', value: '\u200B', inline: false },

                            { name: '🚀 Toplam Komut Kullanımı', value: `\`${toplamKullanilanKomut}\``, inline: true },
                            { name: '🎬 Ekli Animeler (Sistemde)', value: `\`${ekliAnimeler}\``, inline: true },
                            { name: '➕ Eklenen Animeler (Toplam)', value: `\`${eklenenAnimeler}\``, inline: true },
                            { name: '➖ Silinen Animeler (Toplam)', value: `\`${silinenAnimeler}\``, inline: true },
                            { name: '\u200B', value: '\u200B', inline: false },
                            { name: '⏰ Son Veri Güncelleme', value: `<t:${Math.floor(sonGuncellemeTimestamp / 1000)}:R>`, inline: true }
                        )
                        .setThumbnail(client.user.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot | Analiz', iconURL: client.user.displayAvatarURL() });

                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'sistemler') {
                    settings = getSystemSettings();

                    const sistemlerEmbed = new EmbedBuilder()
                        .setColor('#4CAF50')
                        .setTitle('⚙️ Bot Sistem Durumları')
                        .setDescription('Botumuzdaki tüm sistemlerin güncel durumu:')
                        .addFields(
                            {
                                name: '💬 Selamün Aleyküm',
                                value: settings.saas.active ? '✅ Aktif' : '❌ Pasif',
                                inline: true
                            },
                            {
                                name: '☀️ Günaydın',
                                value: settings.gunaydin.active ? '✅ Aktif' : '❌ Pasif',
                                inline: true
                            },
                            {
                                name: '📰 Haber Sistemi',
                                value: settings.haberSistemi.active ? '✅ Aktif' : '❌ Pasif',
                                inline: true
                            },
                            { name: '\u200B', value: '\u200B', inline: false },

                            {
                                name: '📚 Menülü Rol',
                                value: settings.menuluRolSistemi.active ? '✅ Aktif' : '❌ Pasif',
                                inline: true
                            },
                            {
                                name: '🧩 Adam Asmaca',
                                value: hangmanManager.getHangmanSystemStatus() ? '✅ Aktif' : '❌ Pasif',
                                inline: true
                            },
                            {
                                name: '📊 Seviye Sistemi',
                                value: settings.levelSystem && settings.levelSystem.active ?
                                       `✅ Aktif (Kanal: <#${settings.levelSystem.channelId || 'Ayarlanmadı'}>)` :
                                       '❌ Pasif',
                                inline: true
                            },
                            {
                                name: '🏅 Unvan Sistemi',
                                value: settings.unvanSystem && settings.unvanSystem.active ? '✅ Aktif' : '❌ Pasif',
                                inline: true
                            }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot | Güncel Bilgi', iconURL: client.user.displayAvatarURL() });

                    await message.reply({ embeds: [sistemlerEmbed] });
                    return;
                }

                // --- Adam Asmaca Komutları (değişiklik yok) ---
                if (commandName === 'adam-asmaca-oda-olustur') {
                    if (message.channel.id !== ADAM_ASMACA_CREATE_ROOM_CHANNEL_ID) {
                        return message.reply(`Bu komutu sadece <#${ADAM_ASMACA_CREATE_ROOM_CHANNEL_ID}> kanalında kullanabilirsiniz.`);
                    }

                    const type = args[0] ? args[0].toLowerCase() : null;
                    const maxPlayers = parseInt(args[1]);

                    if (!type || (type !== 'ozel' && type !== 'acik')) {
                        return message.reply('Lütfen oda tipini belirtin: `!adam-asmaca-oda-olustur [ozel/acik] [maksKisiSayisi]`');
                    }
                    if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
                        return message.reply('Maksimum oyuncu sayısı en az 2, en fazla 10 olmalıdır.');
                    }

                    const existingRoomAsCreator = Array.from(hangmanManager.activeHangmanGames.values()).find(game => game.creatorId === message.author.id && game.status !== 'ended');
                    if (existingRoomAsCreator) {
                        return message.reply(`Zaten bir Adam Asmaca odası oluşturdunuz veya aktif bir odanın kurucusunuz (Oda ID: \`${existingRoomAsCreator.id}\`). Yeni bir oda oluşturmak için önce mevcut odanızı bitirmelisiniz.`);
                    }
                    const newRoom = await hangmanManager.createHangmanRoom(message.member, type, maxPlayers, client);
                    if (newRoom) {
                        const embed = new EmbedBuilder()
                            .setColor('#4CAF50')
                            .setTitle('🎮 Adam Asmaca Odası Oluşturuldu!')
                            .setDescription(`Yeni Adam Asmaca odanız başarıyla kuruldu!`)
                            .addFields(
                                { name: 'Oda ID', value: `\`${newRoom.id}\``, inline: true },
                                { name: 'Oda Tipi', value: `\`${newRoom.type === 'ozel' ? 'Özel' : 'Açık'}\``, inline: true },
                                { name: 'Maks Oyuncu', value: `\`${newRoom.maxPlayers}\``, inline: true },
                                { name: 'Oyun Kanalı', value: `<#${newRoom.channelId}>`, inline: false }
                            )
                            .setFooter({ text: 'Odaya katılmak için !adam-asmaca-katıl [OdaID]' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Oda oluşturulurken bir hata oluştu. Lütfen bot sahibine bildirin.');
                    }
                    return;
                }

                if (commandName === 'adam-asmaca-davet-et') {
                    const game = Array.from(hangmanManager.activeHangmanGames.values()).find(g => g.creatorId === message.author.id && g.status === 'waiting');
                    if (!game) {
                        return message.reply('Sadece kendi oluşturduğunuz ve bekleme durumundaki bir odada davet gönderebilirsiniz.');
                    }
                    if (game.type !== 'ozel') {
                        return message.reply('Bu komut sadece özel odalar için geçerlidir.');
                    }
                    if (message.mentions.members.size === 0) {
                        return message.reply('Lütfen davet etmek istediğiniz üyeleri etiketleyin.');
                    }

                    let invitedUsers = [];
                    let failedInvites = [];

                    for (const member of message.mentions.members.values()) {
                        if (game.players.length >= game.maxPlayers) {
                            failedInvites.push(`${member.user.username} (Oda dolu)`);
                            continue;
                        }
                        if (game.players.some(p => p.id === member.id)) {
                            failedInvites.push(`${member.user.username} (Zaten odada)`);
                            continue;
                        }
                        if (member.user.bot) {
                            failedInvites.push(`${member.user.username} (Bot)`);
                            continue;
                        }

                        const added = await hangmanManager.addPlayerToRoom(game.id, member, client);
                        if (added) {
                            invitedUsers.push(member.user.username);
                        } else {
                            failedInvites.push(`${member.user.username} (Hata)`);
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#00BCD4')
                        .setTitle('🤝 Oyuncu Davet Sonuçları')
                        .setDescription(`Oda ID: \`${game.id}\``)
                        .addFields(
                            { name: '✅ Davet Edilenler', value: invitedUsers.length > 0 ? invitedUsers.join(', ') : 'Kimse davet edilmedi.', inline: false },
                            { name: '❌ Davet Edilemeyenler', value: failedInvites.length > 0 ? failedInvites.join(', ') : 'Yok.', inline: false }
                        )
                        .setFooter({ text: 'SomeSub Bot | Adam Asmaca' })
                        .setTimestamp();
                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'adam-asmaca-odalar') {
                    const openRooms = hangmanManager.listRooms('acik');
                    let embedDescription = '';

                    if (openRooms.length === 0) {
                        embedDescription = 'Şu anda aktif bir açık Adam Asmaca odası bulunmuyor. Sen bir tane oluşturabilirsin!';
                    } else {
                        embedDescription = openRooms.map(room =>
                            `**ID:** \`${room.id}\` | **Kurucu:** <@${room.creatorId}> | **Oyuncular:** \`${room.players.length}/${room.maxPlayers}\` | **Kanal:** <#${room.channelId}>`
                        ).join('\n');
                    }

                    const roomsEmbed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('🌐 Aktif Adam Asmaca Odaları')
                        .setDescription(embedDescription)
                        .setFooter({ text: 'Katılmak için !adam-asmaca-katıl [ID]', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    await message.reply({ embeds: [roomsEmbed] });
                    return;
                }

                if (commandName === 'adam-asmaca-katıl') {
                    const roomId = args[0];
                    if (!roomId) {
                        return message.reply('Lütfen katılmak istediğiniz odanın ID\'sini belirtin: `!adam-asmaca-katıl [OdaID]`');
                    }

                    const game = hangmanManager.activeHangmanGames.get(roomId);
                    if (!game) {
                        return message.reply('Belirtilen ID\'ye sahip bir oda bulunamadı veya kapalı.');
                    }
                    if (game.type === 'ozel' && game.players.every(p => p.id !== message.author.id) && game.creatorId !== message.author.id) {
                        return message.reply('Bu özel bir oda ve davetli değilsiniz.');
                    }
                    if (game.status !== 'waiting') {
                        return message.reply('Bu oda zaten başladı veya bitmiş durumda.');
                    }
                    if (game.players.some(p => p.id === message.author.id)) {
                        return message.reply('Zaten bu odadasınız.');
                    }
                    if (game.players.length >= game.maxPlayers) {
                        return message.reply('Bu oda dolu.');
                    }

                    const added = await hangmanManager.addPlayerToRoom(roomId, message.member, client);
                    if (added) {
                        const embed = new EmbedBuilder()
                            .setColor('#28a745')
                            .setTitle('✅ Odaya Katıldınız!')
                            .setDescription(`\`${roomId}\` ID'li Adam Asmaca odasına başarıyla katıldınız.`)
                            .setFooter({ text: 'Oyunun başlamasını bekleyin!' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Odaya katılırken bir hata oluştu.');
                    }
                    return;
                }

                if (commandName === 'adam-asmaca-ayrıl') {
                    const game = Array.from(hangmanManager.activeHangmanGames.values()).find(g => g.players.some(p => p.id === message.author.id) && g.status !== 'ended');
                    if (!game) {
                        return message.reply('Şu anda aktif bir Adam Asmaca odasında değilsiniz.');
                    }

                    const removed = await hangmanManager.removePlayerFromRoom(game.id, message.author.id, client);
                    if (removed) {
                        const embed = new EmbedBuilder()
                            .setColor('#FFC107')
                            .setTitle('🚪 Odadan Ayrıldınız!')
                            .setDescription(`\`${game.id}\` ID'li Adam Asmaca odasından başarıyla ayrıldınız.`)
                            .setFooter({ text: 'SomeSub Bot | Adam Asmaca' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Odadan ayrılırken bir hata oluştu.');
                    }
                    return;
                }

                if (commandName === 'adam-asmaca-at') {
                    const game = Array.from(hangmanManager.activeHangmanGames.values()).find(g => g.creatorId === message.author.id && g.status !== 'ended');
                    if (!game) {
                        return message.reply('Sadece kendi oluşturduğunuz odadan oyuncu atabilirsiniz.');
                    }
                    if (message.mentions.members.size === 0) {
                        return message.reply('Lütfen atmak istediğiniz üyeyi etiketleyin.');
                    }
                    const targetMember = message.mentions.members.first();
                    if (targetMember.id === message.author.id) {
                        return message.reply('Kendinizi odadan atamazsınız, bunun yerine `!adam-asmaca-ayrıl` komutunu kullanın.');
                    }
                    if (!game.players.some(p => p.id === targetMember.id)) {
                        return message.reply('Bu kişi odada değil.');
                    }

                    const removed = await hangmanManager.removePlayerFromRoom(game.id, targetMember.id, client, true);
                    if (removed) {
                        const embed = new EmbedBuilder()
                            .setColor('#FF5722')
                            .setTitle('🗑️ Oyuncu Atıldı!')
                            .setDescription(`${targetMember.user} başarıyla \`${game.id}\` ID'li odadan atıldı.`)
                            .setFooter({ text: 'SomeSub Bot | Adam Asmaca Yönetimi' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Oyuncu atılırken bir hata oluştu.');
                    }
                    return;
                }

                if (commandName === 'adam-asmaca-baslat') {
                    const game = Array.from(hangmanManager.activeHangmanGames.values()).find(g => g.creatorId === message.author.id && g.status === 'waiting');
                    if (!game) {
                        return message.reply('Sadece kendi oluşturduğunuz ve bekleme durumundaki bir oyunu başlatabilirsiniz.');
                    }
                    if (game.players.length < 2) {
                        return message.reply(`Oyunu başlatmak için en az 2 oyuncu olmalı. Şu an: ${game.players.length}/${game.maxPlayers}`);
                    }

                    try {
                        const started = await hangmanManager.startGame(game.id, client);
                        if (started) {
                            const embed = new EmbedBuilder()
                                .setColor('#4CAF50')
                                .setTitle('▶️ Oyun Başlatıldı!')
                                .setDescription(`\`${game.id}\` ID'li Adam Asmaca oyunu başarıyla başlatıldı! Kelimeyi tahmin etmeye başlayın.`)
                                .setFooter({ text: 'İyi eğlenceler!' })
                                .setTimestamp();
                            await message.reply({ embeds: [embed] });
                        } else {
                            await message.reply('Oyunu başlatırken bir hata oluştu. Lütfen logları kontrol edin veya bot sahibine bildirin.');
                        }
                    } catch (error) {
                        console.error(`Adam asmaca başlatılırken hata oluştu (game ID: ${game.id}):`, error);
                        await message.reply('Oyunu başlatırken beklenmedik bir hata oluştu. Lütfen bot sahibine bildirin.');
                    }
                    return;
                }

                // Bot sahibine özel komutlar
                if (message.author.id === OWNER_ID) {
                    if (commandName === 'adam-asmaca-bilgi') {
                        const allRooms = hangmanManager.listRooms();
                        let infoDescription = 'Aktif Adam Asmaca Odaları:\n\n';
                        if (allRooms.length === 0) {
                            infoDescription = 'Şu anda aktif bir Adam Asmaca odası bulunmuyor.';
                        } else {
                            infoDescription += allRooms.map(room =>
                                `**ID:** \`${room.id}\` | **Kurucu:** <@${room.creatorId}> | **Tip:** ${room.type === 'ozel' ? 'Özel' : 'Açık'} | **Durum:** ${room.status} | **Oyuncular:** \`${room.players.length}/${room.maxPlayers}\` | **Kanal:** <#${room.channelId}>${room.status === 'in_game' ? `\n**Kelime:** ${room.hiddenWord} | Yanlış: ${room.wrongGuesses}` : ''}`
                            ).join('\n\n');
                        }

                        const infoEmbed = new EmbedBuilder()
                            .setColor('#FFD700')
                            .setTitle('🔍 Adam Asmaca Sistemi Detaylı Bilgi')
                            .setDescription(infoDescription)
                            .setFooter({ text: 'SomeSub Bot | Sadece Bot Sahibi', iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();
                        await message.reply({ embeds: [infoEmbed] });
                        return;
                    }

                    if (commandName === 'adam-asmaca-oda-kapat') {
                        const roomId = args[0];
                        if (!roomId) {
                            return message.reply('Lütfen kapatmak istediğiniz odanın ID\'sini belirtin: `!adam-asmaca-oda-kapat [OdaID]`');
                        }
                        const closed = await hangmanManager.closeRoomAsOwner(roomId, client);
                        if (closed) {
                            const embed = new EmbedBuilder()
                                .setColor('#DC3545')
                                .setTitle('🗑️ Adam Asmaca Odası Kapatıldı!')
                                .setDescription(`\`${roomId}\` ID'li oda başarıyla kapatıldı.`)
                                .setFooter({ text: 'SomeSub Bot | Bot Sahibi İşlemi' })
                                .setTimestamp();
                            await message.reply({ embeds: [embed] });
                        } else {
                            await message.reply('Belirtilen ID\'ye sahip bir oda bulunamadı veya zaten kapalıydı.');
                        }
                        return;
                    }
                }

                // --- Seviye Sistemi Komutları ---
                if (commandName === 'seviye-sistemi') {
                    if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                    }
                    const action = args[0] ? args[0].toLowerCase() : null;
                    const channel = message.mentions.channels.first();

                    if (action === 'aç' || action === 'ac') {
                        if (!channel) {
                            return message.reply(`Kullanım: \`${PREFIX}seviye-sistemi aç [#kanal]\` (Seviye atlama bildirimleri için bir kanal belirtmelisiniz)`);
                        }
                        levelSystem.setLevelSystemStatus(true, channel.id);
                        const embed = new EmbedBuilder()
                            .setColor('#28a745')
                            .setTitle('✅ Seviye Sistemi Başarıyla Aktif Edildi!')
                            .setDescription(`Artık kullanıcılar mesaj attıkça XP kazanacaklar! Seviye atlama bildirimleri ${channel} kanalına gönderilecek.`)
                            .setFooter({ text: 'SomeSub Bot | Seviye Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else if (action === 'kapat') {
                        levelSystem.setLevelSystemStatus(false);
                        const embed = new EmbedBuilder()
                            .setColor('#dc3545')
                            .setTitle('❌ Seviye Sistemi Pasif Edildi!')
                            .setDescription('Seviye sistemi artık çalışmayacak ve kullanıcılar XP kazanamayacak.')
                            .setFooter({ text: 'SomeSub Bot | Seviye Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else {
                        return message.reply(`Kullanım: \`${PREFIX}seviye-sistemi [aç/kapat] [#kanal(isteğe bağlı)]\``);
                    }
                }

                if (commandName === 'seviye-mesaj-basina') {
                    if (message.author.id !== OWNER_ID) {
                        return message.reply('Bu komutu kullanmaya yetkiniz yok! Sadece bot sahibi kullanabilir.');
                    }
                    const amount = parseInt(args[0]);

                    if (isNaN(amount) || amount < 5 || amount > 50) {
                        return message.reply(`Kullanım: \`${PREFIX}seviye-mesaj-basina <miktar>\` (Miktar **5 ile 50** arasında olmalı)`);
                    }

                    levelSystem.setXPPerMessage(amount);
                    const embed = new EmbedBuilder()
                        .setColor('#007BFF')
                        .setTitle('✨ Mesaj Başına XP Ayarlandı!')
                        .setDescription(`Her mesajdan kazanılacak XP miktarı başarıyla **\`${amount}\`** olarak ayarlandı.`)
                        .addFields(
                            { name: 'Detay', value: 'Bu ayar, kullanıcıların her mesajdan kazanacağı temel XP miktarını belirler.', inline: false }
                        )
                        .setFooter({ text: 'SomeSub Bot | Seviye Yönetimi' })
                        .setTimestamp();
                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'seviye-bilgi') {
                    const targetUser = message.mentions.users.first() || message.author;
                    const userData = levelSystem.getUserLevelData(targetUser.id);
                    const currentSettings = getSystemSettings();

                    if (!currentSettings.levelSystem || !currentSettings.levelSystem.active) {
                        const embed = new EmbedBuilder()
                            .setColor('#FF6347')
                            .setTitle('🚫 Seviye Sistemi Kapalı!')
                            .setDescription('Seviye sistemi şu an **kapalı** olduğu için seviye bilgilerini görüntüleyemezsiniz.')
                            .setFooter({ text: 'SomeSub Bot | Hata' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    }

                    const userUnvanData = unvanSystem.getUserUnvanData(targetUser.id);
                    const allTitles = unvanSystem.getAllTitles();
                    const awardedTitlesNames = userUnvanData.awardedTitles
                        .map(titleId => allTitles.find(t => t.id === titleId)?.name)
                        .filter(name => name)
                        .join(', ');

                    // Kullanıcı verisi yoksa veya bomboşsa hata mesajı
                    if (!userData || (userData.level === 0 && userData.xp === 0 && userData.totalXP === 0 && awardedTitlesNames.length === 0)) {
                        const embed = new EmbedBuilder()
                            .setColor('#ffc107')
                            .setTitle('🤔 Kullanıcı Verisi Bulunamadı')
                            .setDescription(`**${targetUser.username}** henüz bir seviyeye veya unvana sahip değil ya da veri tabanında bulunmuyor.\nMesaj atarak XP kazanmaya başlayabilir veya unvanları keşfedebilirsin!`)
                            .setFooter({ text: 'SomeSub Bot | Seviye Sistemi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    }

                    const currentLevel = userData.level;
                    const currentXP = userData.xp;
                    const totalXP = userData.totalXP;
                    const requiredXPForNextLevel = levelSystem.getRequiredXP(currentLevel);

                    const progressBarLength = 20;
                    const filledBlocks = Math.round((currentXP / requiredXPForNextLevel) * progressBarLength);
                    const emptyBlocks = progressBarLength - filledBlocks;
                    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

                    const embed = new EmbedBuilder()
                        .setColor('#8A2BE2')
                        .setTitle(`⭐ ${targetUser.username}'ın Seviye Detayları ⭐`)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .setDescription(`${targetUser}, işte mevcut seviye bilgileriniz!`)
                        .addFields(
                            { name: '📊 Mevcut Seviye', value: `**\`${currentLevel}\`**`, inline: true },
                            { name: '✨ Mevcut XP', value: `**\`${currentXP}\`**`, inline: true },
                            { name: '📈 Sonraki Seviye İçin XP', value: `**\`${requiredXPForNextLevel}\`**`, inline: true },
                            { name: '⭐ Toplam Kazanılan XP', value: `**\`${totalXP}\`**`, inline: false },
                            { name: '🚀 İlerleme', value: `${progressBar} **%${((currentXP / requiredXPForNextLevel) * 100).toFixed(2)}**`, inline: false }
                        );

                    if (awardedTitlesNames.length > 0) {
                        embed.addFields(
                            { name: '🏆 Kazanılan Unvanlar', value: awardedTitlesNames, inline: false }
                        );
                    } else {
                        embed.addFields(
                            { name: '🏆 Kazanılan Unvanlar', value: 'Henüz hiçbir unvan kazanmadın. `!unvanlar` komutuyla unvanları keşfet!', inline: false }
                        );
                    }

                    embed.setFooter({ text: `SomeSub Bot | Seviye Sistemi`, iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'seviye-ekle') {
                    if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                    }
                    const targetUser = message.mentions.users.first();
                    const amount = parseInt(args[1]);

                    if (!targetUser || isNaN(amount) || amount <= 0) {
                        return message.reply(`Kullanım: \`${PREFIX}seviye-ekle <@kullanıcı> <miktar>\` (Miktar pozitif bir sayı olmalı)`);
                    }

                    const success = await levelSystem.addXP(targetUser.id, amount, message.guild.members.cache.get(targetUser.id), client);
                    if (success) {
                        const embed = new EmbedBuilder()
                            .setColor('#28a745')
                            .setTitle('➕ XP Başarıyla Eklendi!')
                            .setDescription(`**${targetUser.username}** kullanıcısına başarıyla **\`${amount}\`** XP eklendi.`)
                            .setFooter({ text: 'SomeSub Bot | Seviye Yönetimi' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('XP eklenirken bir hata oluştu veya kullanıcı bulunamadı.');
                    }
                    return;
                }

                if (commandName === 'seviye-sil') {
                    if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                    }
                    const targetUser = message.mentions.users.first();
                    const amount = parseInt(args[1]);

                    if (!targetUser || isNaN(amount) || amount <= 0) {
                        return message.reply(`Kullanım: \`${PREFIX}seviye-sil <@kullanıcı> <miktar>\` (Miktar pozitif bir sayı olmalı)`);
                    }

                    const success = await levelSystem.removeXP(targetUser.id, amount, message.guild.members.cache.get(targetUser.id), client);
                    if (success) {
                        const embed = new EmbedBuilder()
                            .setColor('#dc3545')
                            .setTitle('➖ XP Başarıyla Silindi!')
                            .setDescription(`**${targetUser.username}** kullanıcısından başarıyla **\`${amount}\`** XP silindi.`)
                            .setFooter({ text: 'SomeSub Bot | Seviye Yönetimi' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('XP silinirken bir hata oluştu veya kullanıcı bulunamadı.');
                    }
                    return;
                }

                if (commandName === 'seviye-ayarla') {
                    if (!checkPermission(message.member, [OWNER_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Sadece bot sahibi kullanabilir.' });
                    }
                    const targetUser = message.mentions.users.first();
                    const level = parseInt(args[1]);

                    if (!targetUser || isNaN(level) || level < 0) {
                        return message.reply(`Kullanım: \`${PREFIX}seviye-ayarla <@kullanıcı> <seviye>\` (Seviye **0 veya pozitif** bir sayı olmalı)`);
                    }

                    const success = await levelSystem.setLevel(targetUser.id, level, message.guild.members.cache.get(targetUser.id), client);
                    if (success) {
                        const embed = new EmbedBuilder()
                            .setColor('#17A2B8')
                            .setTitle('🎯 Seviye Başarıyla Ayarlandı!')
                            .setDescription(`**${targetUser.username}** kullanıcısının seviyesi başarıyla **\`${level}\`** olarak ayarlandı.`)
                            .setFooter({ text: 'SomeSub Bot | Bot Sahibi İşlemi' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Seviye ayarlanırken bir hata oluştu.');
                    }
                    return;
                }

                if (commandName === 'seviye-sıfırla' || commandName === 'seviye-sifirla') {
                    if (!checkPermission(message.member, [OWNER_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Sadece bot sahibi kullanabilir.' });
                    }
                    const targetUser = message.mentions.users.first();
                    if (!targetUser) {
                        return message.reply(`Kullanım: \`${PREFIX}seviye-sıfırla <@kullanıcı>\`\nBu komut, belirli bir kullanıcının seviye ve XP verilerini sıfırlar.`);
                    }

                    const success = levelSystem.resetLevel(targetUser.id);
                    if (success) {
                        const embed = new EmbedBuilder()
                            .setColor('#6C757D')
                            .setTitle('🔄 Seviye Sıfırlandı!')
                            .setDescription(`**${targetUser.username}** kullanıcısının seviye ve XP verileri başarıyla sıfırlandı.`)
                            .setFooter({ text: 'SomeSub Bot | Bot Sahibi İşlemi' })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Kullanıcı bulunamadı veya seviyesi zaten sıfırdı.');
                    }
                    return;
                }

                if (commandName === 'seviye-sistemi-reset') {
                    if (message.author.id !== OWNER_ID) {
                        return message.reply('Bu komutu kullanmaya yetkiniz yok! Sadece bot sahibi kullanabilir.');
                    }

                    if (args[0] !== 'sıfırla') {
                        const embed = new EmbedBuilder()
                            .setColor('#FFD700')
                            .setTitle('⚠️ Tüm Seviye Sistemini Sıfırla Onayı')
                            .setDescription('**UYARI!** Bu komut tüm sunucudaki **tüm kullanıcıların seviye ve XP verilerini kalıcı olarak silecektir!**\n\nOnaylamak için: `!seviye-sistemi-reset sıfırla` yazın.')
                            .setFooter({ text: 'Bu işlem geri alınamaz!', iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    }

                    const success = levelSystem.resetAllLevels();
                    if (success) {
                        const embed = new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('🚨 Tüm Seviye Sistemi Sıfırlandı! 🚨')
                            .setDescription('**Tüm** kullanıcıların seviye ve XP verileri başarıyla **silindi** ve sistem sıfırlandı. Artık herkes 0 seviye ve 0 XP ile başlayacak.')
                            .setFooter({ text: 'SomeSub Bot | KRİTİK İŞLEM', iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('Tüm seviye sistemi sıfırlanırken bir hata oluştu.');
                    }
                    return;
                }

                if (commandName === 'seviye-sıralama' || commandName === 'seviye-siralamasi') {
                    const currentSettings = getSystemSettings();
                    if (!currentSettings.levelSystem || !currentSettings.levelSystem.active) {
                        const embed = new EmbedBuilder()
                            .setColor('#FF6347')
                            .setTitle('🚫 Seviye Sistemi Kapalı!')
                            .setDescription('Seviye sistemi şu an **kapalı** olduğu için sıralamayı görüntüleyemezsiniz.')
                            .setFooter({ text: 'SomeSub Bot | Hata' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    }

                    let allLevels = levelSystem.getAllUserLevels();

                    allLevels = allLevels.filter(u => client.users.cache.has(u.userID) && !client.users.cache.get(u.userID).bot);

                    allLevels.sort((a, b) => b.totalXP - a.totalXP);

                    let leaderboardDescription = '';
                    if (allLevels.length === 0) {
                        leaderboardDescription = 'Henüz kimse seviye kazanmamış! İlk olmak için mesaj atın. 🚀';
                    } else {
                        const top10 = allLevels.slice(0, 10);
                        for (let i = 0; i < top10.length; i++) {
                            const user = client.users.cache.get(top10[i].userID);
                            if (user) {
                                let emoji = '';
                                if (i === 0) emoji = '🥇';
                                else if (i === 1) emoji = '🥈';
                                else if (i === 2) emoji = '🥉';
                                else emoji = '🔹';

                                leaderboardDescription += `${emoji} **${i + 1}.** **${user.username}** - Seviye: \`${top10[i].level}\` (Toplam XP: \`${top10[i].totalXP}\`)\n`;
                            }
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#DAA520')
                        .setTitle('🏆 Sunucu Seviye Lider Tablosu 🏆')
                        .setDescription(leaderboardDescription)
                        .setFooter({ text: 'SomeSub Bot | En İyi 10 Kullanıcı', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    await message.reply({ embeds: [embed] });
                    return;
                }

                if (commandName === 'seviye-yardım' || commandName === 'seviye-yardim') {
                    const helpEmbed = new EmbedBuilder()
                        .setColor('#8B008B')
                        .setTitle('📚 Seviye Sistemi Komutları Kılavuzu 📚')
                        .setDescription('Botun gelişmiş seviye sistemi ile ilgili kullanabileceğin tüm komutlar ve yetkileri:')
                        .addFields(
                            {
                                name: '✨ Kullanıcı Komutları (Herkes Kullanabilir)',
                                value:
                                    `\`${PREFIX}seviye-bilgi [kullanıcı]\`\n` +
                                    `> Kendi veya etiketlediğin bir kullanıcının **seviye ve XP** bilgilerini detaylıca gösterir.\n` +
                                    `\`${PREFIX}seviye-sıralama\`\n` +
                                    `> Sunucudaki en yüksek seviyeye sahip **ilk 10 kişiyi** sıralamayı gösterir.`,
                                inline: false
                            },
                            {
                                name: '🛠️ Yetkili Komutları (Bot Sahibi)',
                                value:
                                    `\`${PREFIX}seviye-sistemi [aç/kapat] [#kanal]\`\n` +
                                    `> Seviye sistemini **aktif/pasif** hale getirir ve seviye atlama bildirim kanalını ayarlar.\n` +
                                    `\`${PREFIX}seviye-ekle <@kullanıcı> <miktar>\`\n` +
                                    `> Belirtilen kullanıcıya belirli miktarda **ek XP** verir.`,
                                inline: false
                            },
                            {
                                name: '👑 Bot Sahibi Komutları (Sadece Bot Sahibi)',
                                value:
                                    `\`${PREFIX}seviye-sil <@kullanıcı> <miktar>\`\n` +
                                    `> Belirtilen kullanıcıdan belirli miktarda **XP siler**.\n` +
                                    `\`${PREFIX}seviye-ayarla <@kullanıcı> <seviye>\`\n` +
                                    `> Belirtilen kullanıcının seviyesini manuel olarak **istediğin seviyeye ayarlar**.\n` +
                                    `\`${PREFIX}seviye-sıfırla <@kullanıcı>\`\n` +
                                    `> Belirtilen kullanıcının tüm seviye ve XP verilerini **sıfırlar**.\n` +
                                    `\`${PREFIX}seviye-mesaj-basina <miktar>\`\n` +
                                    `> Her mesajdan kazanılacak **XP miktarını** ayarlar (5-50 arası).\n` +
                                    `\`${PREFIX}seviye-sistemi-reset sıfırla\`\n` +
                                    `> **UYARI!** Tüm sunucudaki **TÜM kullanıcıların seviye ve XP verilerini kalıcı olarak sıfırlar.**`,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot | Yardım Kılavuzu', iconURL: client.user.displayAvatarURL() });

                    await message.reply({ embeds: [helpEmbed] });
                    return;
                }

                //!unvan-yardım

 if (commandName === 'unvan-yardım' || commandName === 'unvan-yardim') {
                    const helpEmbed = new EmbedBuilder()
                        .setColor('#8B008B')
                        .setTitle('📚 unvan Sistemi Komutları Kılavuzu 📚')
                        .setDescription('Botun gelişmiş unvan sistemi ile ilgili kullanabileceğin tüm komutlar ve yetkileri:')
                        .addFields(
                            {
                                name: '✨ Kullanıcı Komutları (Herkes Kullanabilir)',
                                value:
                                    `\`${PREFIX}unvan-bilgi [unvan adı]\`\n` +
                                    `> **Unvan** bilgilerini ve ilerlemenizi detaylıca gösterir.\n` +
                                    `\`${PREFIX}unvan-bilgi @kişi_etiketi [unvan adı]\`\n` +
                                    `> Etiketlediğiniz kişinin **Unvan** bilgilerini ve ilerlemesini gösterir.`,
                                inline: false
                            },
                            {
                                name: '🛠️ Yetkili Komutları (Bot Sahibi)',
                                value:
                                    `\`${PREFIX}unvan-sistemi [aç/kapat] [#kanal]\`\n` +
                                    `> Seviye sistemini **aktif/pasif** hale getirir ve seviye atlama bildirim kanalını ayarlar.\n`,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot | Yardım Kılavuzu', iconURL: client.user.displayAvatarURL() });

                    await message.reply({ embeds: [helpEmbed] });
                    return;
                }
                

 if (commandName === 'yardım' || commandName === 'help') {
                    const helpEmbed = new EmbedBuilder()
                        .setColor('#8B008B')
                        .setTitle('📚 SomeSub Komutları Kılavuzu 📚')
                        .setDescription('Yardım klavuzum (Bebiş)')
                        .addFields(
                            {
                                name: '✨ Kullanıcı Komutları (Herkes Kullanabilir)',
                                value:
                                    `\`${PREFIX}seviye-yardım \`\n` +
                                    `> **Seviye** sistemi için komut listesi.\n` +
                                    `\`${PREFIX}unvan-yardım \`\n` +
                                    `> **Unvan** sistemi için komut listesi`,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot | Yardım Kılavuzu', iconURL: client.user.displayAvatarURL() });

                    await message.reply({ embeds: [helpEmbed] });
                    return;
                }

                // YENİ KOMUT: !unvan-bilgi
                if (commandName === 'unvan-bilgi') {
                    settings = getSystemSettings();
                    if (!settings.unvanSystem || !settings.unvanSystem.active) {
                        return message.reply('Unvan sistemi şu an kapalı. Bir yetkilinin sistemi açmasını bekleyin.');
                    }

                    const targetUser = message.mentions.users.first() || message.author;
                    const unvanAdi = args.slice(message.mentions.users.first() ? 1 : 0).join(' ').toLowerCase();

                    if (!unvanAdi) {
                        return message.reply(`Kullanım: \`${PREFIX}unvan-bilgi [unvan adı]\` veya \`${PREFIX}unvan-bilgi <@kullanıcı> [unvan adı]\`\nBelirli bir unvanın ilerlemesini görmek için kullanın.`);
                    }

                    const allTitles = unvanSystem.getAllTitles();
                    const targetTitle = allTitles.find(t => t.name.toLowerCase() === unvanAdi);

                    if (!targetTitle) {
                        return message.reply(`\`${unvanAdi}\` adında bir unvan bulunamadı. Lütfen unvan listesini görmek için \`${PREFIX}unvanlar\` komutunu kullanın.`);
                    }

                    const userUnvanData = unvanSystem.getUserUnvanData(targetUser.id);
                    const userHasTitle = userUnvanData.awardedTitles.includes(targetTitle.id);

                    const infoEmbed = new EmbedBuilder()
                        .setColor('#FF69B4')
                        .setTitle(`🏅 ${targetTitle.name} Unvan Bilgisi`)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .setDescription(`**${targetTitle.name}** unvanı hakkında detaylar ve **${targetUser.username}**'ın bu unvandaki ilerlemesi.`);

                    if (userHasTitle) {
                        infoEmbed.addFields(
                            { name: 'Durum', value: '✅ **Bu unvanı zaten kazandınız!**', inline: false },
                            { name: 'Açıklama', value: targetTitle.description, inline: false }
                        );
                    } else {
                        const currentProgressData = await unvanSystem.calculateTitleProgress(targetUser.id, targetTitle, client);
                        let progressValue = 0;
                        let maxValue = 1; // Division by zero guard
                        let progressText = '';

                        if (targetTitle.type === 'xp') {
                            progressValue = currentProgressData;
                            maxValue = targetTitle.requirements.totalXP;
                            progressText = `\`${progressValue}/${maxValue}\` XP`;
                        } else if (targetTitle.type === 'activity') {
                            // currentProgressData = { activeMinutes, messages }
                            progressValue = Math.min(currentProgressData.activeMinutes, currentProgressData.messages * (targetTitle.requirements.timeWindowMinutes / targetTitle.requirements.minMessages)); // Basit bir ilerleme göstergesi için
                            maxValue = targetTitle.requirements.timeWindowMinutes; // Ya da minMessages, hangisi daha anlamlıysa
                            progressText = `Aktivite: \`${currentProgressData.activeMinutes}/${targetTitle.requirements.timeWindowMinutes}\` dakika, \`${currentProgressData.messages}/${targetTitle.requirements.minMessages}\` mesaj`;
                        } else if (targetTitle.type === 'activity_time_based') {
                            progressValue = currentProgressData;
                            maxValue = targetTitle.requirements.messageCount;
                            progressText = `\`${currentProgressData}/${targetTitle.requirements.messageCount}\` mesaj (Saat: ${targetTitle.requirements.startTime}-${targetTitle.requirements.endTime})`;
                        } else {
                            progressText = 'İlerleme hesaplanamadı.';
                        }

                        const progressBarLength = 20;
                        const filledBlocks = Math.round((progressValue / maxValue) * progressBarLength);
                        const emptyBlocks = progressBarLength - filledBlocks;
                        const progressBar = '█'.repeat(Math.max(0, filledBlocks)) + '░'.repeat(Math.max(0, emptyBlocks));
                        const percentage = ((progressValue / maxValue) * 100).toFixed(2);


                        infoEmbed.addFields(
                            { name: 'Açıklama', value: targetTitle.description, inline: false },
                            { name: 'İlerleme', value: `${progressBar} **%${percentage}**\n${progressText}`, inline: false }
                        );
                    }

                    infoEmbed.setFooter({ text: 'SomeSub Bot | Unvan Bilgisi', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    await message.reply({ embeds: [infoEmbed] });
                    return;
                }

                // YENİ KOMUT: !unvanlar (Arayüz İyileştirmesi ile)
                if (commandName === 'unvanlar') {
                    settings = getSystemSettings();
                    if (!settings.unvanSystem || !settings.unvanSystem.active) {
                        return message.reply('Unvan sistemi şu an kapalı. Bir yetkilinin sistemi açmasını bekleyin.');
                    }

                    const targetUser = message.mentions.users.first() || message.author;
                    const unvanData = unvanSystem.getUserUnvanData(targetUser.id);
                    const allTitles = unvanSystem.getAllTitles();

                    const embed = new EmbedBuilder()
                        .setColor('#FF69B4')
                        .setTitle(`🏅 ${targetUser.username}'ın Unvan Durumu 🏅`)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .setDescription(`Aşağıdaki menüden unvan türlerini filtreleyebilir veya tüm unvanları görüntüleyebilirsin.`)
                        .setFooter({ text: 'SomeSub Bot | Unvanlar', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    const options = [
                        { label: 'Tüm Unvanlar', value: 'all_titles', description: 'Tüm unvanları gösterir.' },
                        { label: 'Kazanılan Unvanlar', value: 'awarded_titles', description: `${targetUser.username}'ın kazandığı unvanları gösterir.` },
                        { label: 'Kazanılabilir Unvanlar', value: 'available_titles', description: `${targetUser.username}'ın henüz kazanmadığı unvanları gösterir.` },
                        { label: 'XP Unvanları', value: 'xp_titles', description: 'XP ile kazanılan unvanları gösterir.' },
                        { label: 'Aktivite Unvanları', value: 'activity_titles', description: 'Aktivite ile kazanılan unvanları gösterir.' },
                        { label: 'Zaman Tabanlı Aktivite Unvanları', value: 'activity_time_based_titles', description: 'Belirli saat aralıklarında aktivite ile kazanılan unvanları gösterir.' }
                    ];

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`select_unvan_filter_${targetUser.id}`) // Kullanıcıya özel ID
                        .setPlaceholder('Unvanları filtrele...')
                        .addOptions(options);

                    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

                    await message.reply({ embeds: [embed], components: [actionRow] });

                    // Default olarak tüm unvanları gösteren bir embed gönderme (menüden seçim yapılana kadar)
                    const initialEmbed = new EmbedBuilder()
                        .setColor('#FF69B4')
                        .setTitle(`📜 Tüm Unvanlar`)
                        .setDescription(`**${targetUser.username}** için mevcut tüm unvanlar:`);

                    let defaultFieldsAdded = 0;
                    for (const title of allTitles) {
                        const userHasTitle = unvanData.awardedTitles.includes(title.id);
                        initialEmbed.addFields({
                            name: `**${title.name}** ${userHasTitle ? '✅' : '⏳'}`, // ✅ kazanıldı, ⏳ henüz kazanılmadı
                            value: `${title.description}`,
                            inline: false
                        });
                        defaultFieldsAdded++;
                    }

                    if (defaultFieldsAdded === 0) {
                        initialEmbed.setDescription('Henüz tanımlanmış bir unvan bulunmuyor.');
                    }

                    await message.channel.send({ embeds: [initialEmbed] }); // Başlangıçta tüm unvanları göster
                    return;
                }

                // YENİ KOMUT: !unvan-sistemi (Bot sahibi/yetkili için açma/kapatma)
                if (commandName === 'unvan-sistemi') {
                    if (!checkPermission(message.member, [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID], OWNER_ID)) {
                        return message.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.' });
                    }
                    const action = args[0] ? args[0].toLowerCase() : null;

                    if (action === 'aç' || action === 'ac') {
                        unvanSystem.setUnvanSystemStatus(true);
                        const embed = new EmbedBuilder()
                            .setColor('#28a745')
                            .setTitle('✅ Unvan Sistemi Başarıyla Aktif Edildi!')
                            .setDescription('Kullanıcılar artık unvan kazanmak için gereksinimleri tamamlayabilirler.')
                            .setFooter({ text: 'SomeSub Bot | Unvan Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else if (action === 'kapat') {
                        unvanSystem.setUnvanSystemStatus(false);
                        const embed = new EmbedBuilder()
                            .setColor('#dc3545')
                            .setTitle('❌ Unvan Sistemi Pasif Edildi!')
                            .setDescription('Unvan sistemi artık çalışmayacak ve yeni unvanlar kazanılamayacak.')
                            .setFooter({ text: 'SomeSub Bot | Unvan Yönetimi' })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    } else {
                        return message.reply(`Kullanım: \`${PREFIX}unvan-sistemi [aç/kapat]\``);
                    }
                }

            } catch (error) {
                console.error(`[MessageCreate] PREFIX Komutu çalıştırılırken hata: ${commandName}`, error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Bir Hata Oluştu!')
                    .setDescription(`\`${PREFIX}${commandName}\` komutu çalıştırılırken beklenmedik bir hata oluştu. Lütfen bot sahibine bildirin.`)
                    .addFields({ name: 'Hata Mesajı', value: `\`\`\`${error.message}\`\`\`` })
                    .setFooter({ text: 'SomeSub Bot | Hata Raporu', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
                if (message.replied || message.deferred) {
                    await message.followUp({ embeds: [errorEmbed], ephemeral: true });
                } else {
                    await message.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }
        }

        // ---------------------- KELİME TABANLI YANIT SİSTEMLERİ ----------------------
        if (settings.saas && settings.saas.active) { // settings.saas kontrolü ekledim
            const saasKeywords = [
                'sa', 'selamun aleykum', 'selamün aleyküm', 'selamunaleykum', 'selam', 'selamlar', 'Selamun aleyküm', 'selamünaleyküm', 'sea'
            ];
            const isSaasMatch = saasKeywords.some(keyword => {
                return content === keyword || content.startsWith(keyword + ' ');
            });

            if (isSaasMatch) {
                await message.reply('Aleykümselam');
                return;
            }
        }

        if (settings.gunaydin && settings.gunaydin.active) { // settings.gunaydin kontrolü ekledim
            const gunaydinKeywords = [
                'günaydın', 'gunaydin', 'güno', 'guno', 'günaydınlar', 'gunaydinlar', 'aydınlar', 'aydınlık', 'iyi sabahlar'
            ];
            const isGunaydinMatch = gunaydinKeywords.some(keyword => {
                return content === keyword || content.startsWith(keyword + ' ');
            });

            if (isGunaydinMatch) {
                await message.reply('Günaydın! Kral');
                return;
            }
        }

        // Adam Asmaca oyunu devam eden kanalda tahminleri yakala
        const activeGames = Array.from(hangmanManager.activeHangmanGames.values());
        const gameInChannel = activeGames.find(g => g.channelId === message.channel.id && g.status === 'in_game');

        if (gameInChannel && gameInChannel.currentPlayerId === message.author.id) {
            const guess = message.content.toLowerCase();
            if (guess.length === 1 || guess.length > 1) {
                try {
                    const processed = await hangmanManager.handleGuess(gameInChannel.id, message.author.id, guess, client);
                    if (processed) {
                        await message.delete().catch(err => console.error('Tahmin mesajı silinirken hata:', err));
                    }
                }
                catch (error) {
                    console.error(`Adam asmaca tahmini işlenirken hata oluştu (game ID: ${gameInChannel.id}, user: ${message.author.tag}):`, error);
                }
            }
            return;
        } else if (gameInChannel && gameInChannel.players.some(p => p.id === message.author.id) && gameInChannel.currentPlayerId !== message.author.id) {
            await message.delete().catch(err => console.error('Sırası olmayan oyuncunun mesajı silinirken hata:', err));
            return;
        } else if (gameInChannel && !gameInChannel.players.some(p => p.id === message.author.id)) {
            await message.delete().catch(err => console.error('Oyunda olmayan kullanıcının mesajı silinirken hata:', err));
            return;
        }
    },
};