// events/interactionCreate.js
const { OWNER_ID, UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID, ANIME_LOG_CHANNEL_ID, ANIME_NOTIFICATION_CHANNEL_ID, ANIME_NOTIFICATION_ROLE_ID } = require('../utils/config');
const { hasRequiredRoles, generateAnimeID } = require('../utils/functions');
const { getAnimes, saveAnimes, getBotStats, saveBotStats } = require('../utils/db');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const { addAnimeToTakvim, updateAnimeInTakvim } = require('../utils/takvimUtils');
const tkmCommand = require('../commands/taskagitmakas');
const { processSelectedRoles } = require('../utils/menuluRolUtils'); // Yeni fonksiyonu import et
const hangmanManager = require('../utils/hangmanManager'); // Adam asmaca manager'ı import et

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isModalSubmit()) {
            console.log(`[ModalSubmit] CustomID: ${interaction.customId}`);
            if (interaction.customId === 'addAnimeModal') { // Bu kısım takvim utils ile alakalı gibi duruyor.
                const animeData = {
                    animeName: interaction.fields.getTextInputValue('animeName'),
                    episode: interaction.fields.getTextInputValue('episode'),
                    season: interaction.fields.getTextInputValue('season'),
                    releaseDate: interaction.fields.getTextInputValue('releaseDate'),
                    translateTime: interaction.fields.getTextInputValue('translateTime'),
                };
                try {
                    const newAnime = addAnimeToTakvim(animeData);
                    await interaction.reply({ content: `Anime takvime başarıyla eklendi! ID: \`${newAnime.id}\``, ephemeral: true });
                } catch (error) {
                    console.error('addAnimeModal işlenirken hata:', error);
                    await interaction.reply({ content: 'Anime eklenirken bir hata oluştu.', ephemeral: true });
                }
            }
            else if (interaction.customId.startsWith('editAnimeModal_')) { // Bu kısım takvim utils ile alakalı gibi duruyor.
                const animeId = interaction.customId.split('_')[1];
                const updatedData = {
                    animeName: interaction.fields.getTextInputValue('animeName'),
                    episode: interaction.fields.getTextInputValue('episode'),
                    season: interaction.fields.getTextInputValue('season'),
                    releaseDate: interaction.fields.getTextInputValue('releaseDate'),
                    translateTime: interaction.fields.getTextInputValue('translateTime'),
                };
                try {
                    const updatedAnime = updateAnimeInTakvim(animeId, updatedData);
                    if (updatedAnime) {
                        await interaction.reply({ content: `ID'si **${animeId}** olan anime kaydı başarıyla güncellendi!`, ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'Bu anime bulunamadı veya güncellenemedi.', ephemeral: true });
                    }
                } catch (error) {
                    console.error('editAnimeModal işlenirken hata:', error);
                    await interaction.reply({ content: 'Anime düzenlenirken bir hata oluştu.', ephemeral: true });
                }
            }
            else if (interaction.customId === 'add_anime_modal') { // Ana anime ekleme modalı
                const animeName = interaction.fields.getTextInputValue('anime_name');
                const animeEpisode = parseInt(interaction.fields.getTextInputValue('anime_episode'));
                const animeSeason = parseInt(interaction.fields.getTextInputValue('anime_season'));
                const animeLinks = interaction.fields.getTextInputValue('anime_links').split(',').map(link => link.trim()).filter(link => link.length > 0);
                const animeContributors = interaction.fields.getTextInputValue('anime_contributors').split(',').map(cont => cont.trim()).filter(cont => cont.length > 0);

                if (isNaN(animeEpisode) || animeEpisode <= 0) {
                    return interaction.reply({ content: 'Bölüm numarası geçerli bir sayı olmalı!', flags: [MessageFlags.Ephemeral] });
                }
                if (isNaN(animeSeason) || animeSeason <= 0) {
                    return interaction.reply({ content: 'Sezon numarası geçerli bir sayı olmalı!', flags: [MessageFlags.Ephemeral] });
                }
                if (animeLinks.length === 0) {
                    return interaction.reply({ content: 'En az bir ilk izleme linki sağlamalısınız!', flags: [MessageFlags.Ephemeral] });
                }
                if (animeContributors.length === 0) {
                    return interaction.reply({ content: 'En az bir hazırlayan belirtmelisiniz!', flags: [MessageFlags.Ephemeral] });
                }

                const animes = getAnimes();
                const newAnime = {
                    id: generateAnimeID(animes),
                    name: animeName,
                    episode: animeEpisode,
                    season: animeSeason,
                    initialLinks: animeLinks,
                    contributors: animeContributors,
                    addedBy: interaction.user.id,
                    addedTimestamp: Date.now(),
                    status: 'Bekliyor',
                    imdbRating: null,
                    duration: null,
                    finalLinks: [],
                    imageUrl: null,
                    userRatings: [], // Eski haline dönerken bu kısım da geri geldi.
                    averageRating: 0, // Eski haline dönerken bu kısım da geri geldi.
                    totalVotes: 0, // Eski haline dönerken bu kısım da geri geldi.
                    notificationMessageId: null,
                    finalNotificationMessageId: null
                };
                animes.push(newAnime);

                const botStats = getBotStats();
                botStats.totalAnimesAdded++;
                saveBotStats(botStats);

                const animeLogChannel = client.channels.cache.get(ANIME_LOG_CHANNEL_ID);
                if (animeLogChannel) {
                    const addEmbed = new EmbedBuilder()
                        .setColor('#ffc107')
                        .setTitle(`🔔 Yeni Anime Ekleniyor: ${newAnime.name} - S${newAnime.season} Bölüm ${newAnime.episode}`)
                        .setDescription(`**ID:** \`${newAnime.id}\`\n**Ekleyen:** <@${newAnime.addedBy}>`)
                        .addFields(
                            { name: '👤 Hazırlayanlar', value: newAnime.contributors.join(', ') || 'Belirtilmemiş', inline: true },
                            { name: '✨ Durum', value: `\`\`\`Bekliyor...\`\`\``, inline: true },
                            { name: '🔗 İlk İzleme Linkleri', value: newAnime.initialLinks.map(link => `[Link](${link})`).join('\n') || 'Yok', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() });

                    if (interaction.user.displayAvatarURL()) {
                        addEmbed.setThumbnail(interaction.user.displayAvatarURL());
                    }

                    const addRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`anime_status_ekleniyor_${newAnime.id}`)
                                .setLabel('Ekleniyor')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`anime_status_eklendi_${newAnime.id}`)
                                .setLabel('Eklendi')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`anime_status_iptal_edildi_${newAnime.id}`)
                                .setLabel('İptal Edildi')
                                .setStyle(ButtonStyle.Danger)
                        );
                    try {
                        const sentMessage = await animeLogChannel.send({ embeds: [addEmbed], components: [addRow] });
                        newAnime.notificationMessageId = sentMessage.id;
                        saveAnimes(animes);
                    } catch (err) {
                        console.error(`Log kanalına mesaj gönderilemedi veya kaydedilemedi: ${err}`);
                        saveAnimes(animes);
                    }
                } else {
                    console.warn(`Anime log kanalı (${ANIME_LOG_CHANNEL_ID}) bulunamadı. Lütfen config.js dosyasını kontrol edin.`);
                    saveAnimes(animes);
                }

                await interaction.reply({ content: `**${animeName}** (ID: \`${newAnime.id}\`) adlı anime başarıyla ekleme sırasına alındı! Detayları log kanalında takip edebilirsiniz.`, flags: [MessageFlags.Ephemeral] });
            }
            else if (interaction.customId.startsWith('finalize_anime_modal_')) { // Anime tamamlama modalı
                await interaction.deferReply({ ephemeral: true });

                const animeId = interaction.customId.split('_')[3];

                const animes = getAnimes();
                const animeIndex = animes.findIndex(a => a.id === animeId);

                if (animeIndex === -1) {
                    return interaction.editReply({ content: 'Bu anime bulunamadı veya silinmiş!', flags: [MessageFlags.Ephemeral] });
                }

                const anime = animes[animeIndex];

                const imdbRating = interaction.fields.getTextInputValue('imdb_rating');
                const episodeDuration = interaction.fields.getTextInputValue('episode_duration');
                const finalLinksRaw = interaction.fields.getTextInputValue('final_links');
                const imageUrl = interaction.fields.getTextInputValue('image_url');

                const parsedImdbRating = imdbRating ? parseFloat(imdbRating) : null;
                const parsedEpisodeDuration = episodeDuration ? parseInt(episodeDuration) : null;

                if (imdbRating && (isNaN(parsedImdbRating) || parsedImdbRating < 0 || parsedImdbRating > 10)) {
                    return interaction.editReply({ content: 'IMDb puanı 0-10 arasında geçerli bir sayı olmalı!', flags: [MessageFlags.Ephemeral] });
                }
                if (episodeDuration && (isNaN(parsedEpisodeDuration) || parsedEpisodeDuration <= 0)) {
                    return interaction.editReply({ content: 'Bölüm süresi geçerli bir sayı olmalı!', flags: [MessageFlags.Ephemeral] });
                }

                const finalLinksParsed = finalLinksRaw.split(',').map(entry => {
                    const parts = entry.trim().split(':');
                    if (parts.length >= 2) {
                        const name = parts[0].trim();
                        const url = parts.slice(1).join(':').trim();
                        try {
                            new URL(url);
                            return { name, url };
                        } catch {
                            return null;
                        }
                    }
                    return null;
                }).filter(entry => entry !== null);


                if (finalLinksParsed.length === 0) {
                    return interaction.editReply({ content: 'En az bir izleme linki sağlamalısınız! (Örn: SiteAdı: Link)', flags: [MessageFlags.Ephemeral] });
                }

                anime.imdbRating = parsedImdbRating;
                anime.duration = parsedEpisodeDuration;
                anime.finalLinks = finalLinksParsed;
                anime.imageUrl = imageUrl || null;
                anime.status = 'Eklendi';

                saveAnimes(animes);

                const animeLogChannel = client.channels.cache.get(ANIME_LOG_CHANNEL_ID);
                if (animeLogChannel && anime.notificationMessageId) {
                    const oldLogMessage = await animeLogChannel.messages.fetch(anime.notificationMessageId).catch(() => null);
                    if (oldLogMessage && !oldLogMessage.deleted) {
                        const updatedLogEmbed = EmbedBuilder.from(oldLogMessage.embeds[0])
                            .setColor('#808080')
                            .setTitle(`✅ Tamamlandı: ${anime.name} - S${anime.season} Bölüm ${anime.episode}`)
                            .setDescription(`**ID:** \`${anime.id}\`\n**Ekleyen:** <@${anime.addedBy}>\n*Bu kayıt tamamlandı ve bildirim kanalı gönderildi.*`)
                            .setFields([])
                            .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();
                        await oldLogMessage.edit({ embeds: [updatedLogEmbed], components: [] }).catch(console.error);
                    }
                }

                const animeNotificationChannel = client.channels.cache.get(ANIME_NOTIFICATION_CHANNEL_ID);
                if (animeNotificationChannel) {
                    const finalEmbed = new EmbedBuilder()
                        .setColor('#28a745')
                        .setTitle(`✅ Yeni Bölüm Yayınlandı: ${anime.name} - S${anime.season} Bölüm ${anime.episode}`)
                        .setDescription(`**ID:** \`${anime.id}\`\n**Ekleyen:** <@${anime.addedBy}>`)
                        .addFields(
                            { name: '👤 Hazırlayanlar', value: anime.contributors.join(', ') || 'Belirtilmemiş', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() });

                    let detailsContent = [];
                    if (anime.imdbRating) {
                        detailsContent.push(`⭐ **IMDb Puanı:** ${anime.imdbRating}`);
                    }
                    if (anime.duration) {
                        detailsContent.push(`⏱️ **Bölüm Süresi:** ${anime.duration} dakika`);
                    }
                    if (anime.totalVotes > 0) {
                        detailsContent.push(`📈 **Ort. Puan:** ${anime.averageRating.toFixed(1)}/10 (${anime.totalVotes} oy)`);
                    }

                    if (detailsContent.length > 0) {
                        finalEmbed.addFields({ name: 'Detaylar', value: detailsContent.join(' | '), inline: false });
                    }

                    if (anime.imageUrl) {
                        finalEmbed.setThumbnail(anime.imageUrl);
                    }

                    if (anime.finalLinks.length > 0) {
                        finalEmbed.addFields({
                            name: '🔗 İzleme Linkleri',
                            value: anime.finalLinks.map(link => `[${link.name}](${link.url})`).join('\n'),
                            inline: false
                        });
                    }

                    const ratingRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`anime_rate_${anime.id}`)
                                .setLabel('⭐ Bölümü Puanla')
                                .setStyle(ButtonStyle.Primary)
                        );
                    try {
                        const newSentMessage = await animeNotificationChannel.send({
                            content: `<@&${ANIME_NOTIFICATION_ROLE_ID}> Yeni bir bölüm yayınlandı!`,
                            embeds: [finalEmbed],
                            components: [ratingRow]
                        });

                        newAnime.finalNotificationMessageId = newSentMessage.id;
                        saveAnimes(animes);

                        const addedByUser = await client.users.fetch(anime.addedBy).catch(() => null);
                        if (addedByUser) {
                            await addedByUser.send(`\`${anime.name}\` (ID: \`${anime.id}\`) adlı animenin ekleme işlemi tamamlandı ve yayınlandı!`).catch(console.error);
                        }
                    } catch (err) {
                        console.error(`Bildirim kanalına mesaj gönderilemedi veya kaydedilemedi: ${err}`);
                        saveAnimes(animes);
                    }

                } else {
                    console.warn(`Anime bildirim kanalı (${ANIME_NOTIFICATION_CHANNEL_ID}) bulunamadı. Lütfen config.js dosyasını kontrol edin.`);
                }

                await interaction.editReply({ content: `**${anime.name}** (ID: \`${anime.id}\`) adlı animenin bilgileri tamamlandı ve bildirim kanalına gönderildi!`, flags: [MessageFlags.Ephemeral] });
            }
            else if (interaction.customId === 'delete_anime_modal') { // Anime silme modalı
                await interaction.deferReply({ ephemeral: true });

                const animeId = interaction.fields.getTextInputValue('anime_id_to_delete').toUpperCase();

                const animes = getAnimes();
                const animeIndex = animes.findIndex(a => a.id === animeId);

                if (animeIndex === -1) {
                    return interaction.editReply({ content: `\`${animeId}\` ID'sine sahip bir anime bulunamadı.`, flags: [MessageFlags.Ephemeral] });
                }

                const deletedAnime = animes.splice(animeIndex, 1)[0];
                saveAnimes(animes);

                const botStats = getBotStats();
                botStats.totalAnimesRemoved++;
                saveBotStats(botStats);

                const animeLogChannel = client.channels.cache.get(ANIME_LOG_CHANNEL_ID);
                if (animeLogChannel && deletedAnime.notificationMessageId) {
                    const logMessage = await animeLogChannel.messages.fetch(deletedAnime.notificationMessageId).catch(() => null);
                    if (logMessage && !logMessage.deleted) {
                        await logMessage.delete().catch(console.error);
                    }
                }

                const animeNotificationChannel = client.channels.cache.get(ANIME_NOTIFICATION_CHANNEL_ID);
                if (animeNotificationChannel && deletedAnime.finalNotificationMessageId) {
                    const finalMessage = await animeNotificationChannel.messages.fetch(deletedAnime.finalNotificationMessageId).catch(() => null);
                    if (finalMessage && !finalMessage.deleted) {
                        await finalMessage.delete().catch(console.error);
                    }
                }

                await interaction.editReply({ content: `\`${deletedAnime.name}\` (ID: \`${deletedAnime.id}\`) adlı anime başarıyla silindi.`, flags: [MessageFlags.Ephemeral] });
            }
            else if (interaction.customId.startsWith('rate_anime_modal_')) { // Anime puanlama modalı
                await interaction.deferReply({ ephemeral: true });

                const animeId = interaction.customId.split('_')[3];
                const ratingValue = interaction.fields.getTextInputValue('rating_value');

                const animes = getAnimes();
                const animeIndex = animes.findIndex(a => a.id === animeId);

                if (animeIndex === -1) {
                    return interaction.editReply({ content: 'Puanlamak istediğiniz anime bulunamadı veya silinmiş!', flags: [MessageFlags.Ephemeral] });
                }

                const anime = animes[animeIndex];
                const parsedRating = parseFloat(ratingValue);

                if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 10) {
                    return interaction.editReply({ content: 'Lütfen 1 ile 10 arasında geçerli bir puan girin (örneğin 8.5).', flags: [MessageFlags.Ephemeral] });
                }

                const existingRatingIndex = anime.userRatings.findIndex(r => r.userId === interaction.user.id);

                if (existingRatingIndex !== -1) {
                    anime.userRatings[existingRatingIndex].rating = parsedRating;

                    anime.totalVotes = anime.userRatings.length;
                    const sumOfRatings = anime.userRatings.reduce((sum, r) => sum + r.rating, 0);
                    anime.averageRating = sumOfRatings / anime.totalVotes;

                    saveAnimes(animes);
                    await interaction.editReply({ content: `Puanınız güncellendi! **${anime.name}** için yeni puanınız: **${parsedRating}**.`, flags: [MessageFlags.Ephemeral] });

                } else {
                    anime.userRatings.push({ userId: interaction.user.id, rating: parsedRating });

                    anime.totalVotes = anime.userRatings.length;
                    const sumOfRatings = anime.userRatings.reduce((sum, r) => sum + r.rating, 0);
                    anime.averageRating = sumOfRatings / anime.totalVotes;

                    saveAnimes(animes);
                    await interaction.editReply({ content: `**${anime.name}** için puanınız kaydedildi: **${parsedRating}**. Teşekkür ederiz!`, flags: [MessageFlags.Ephemeral] });
                }

                if (anime.finalNotificationMessageId && ANIME_NOTIFICATION_CHANNEL_ID) {
                    const animeNotificationChannel = client.channels.cache.get(ANIME_NOTIFICATION_CHANNEL_ID);
                    if (animeNotificationChannel) {
                        const finalMessage = await animeNotificationChannel.messages.fetch(anime.finalNotificationMessageId).catch(() => null);
                        if (finalMessage && !finalMessage.deleted && finalMessage.embeds.length > 0) {
                            const currentEmbed = EmbedBuilder.from(finalMessage.embeds[0]);

                            let detailsField = currentEmbed.data.fields?.find(f => f.name === 'Detaylar');
                            let detailsContent = [];

                            if (anime.imdbRating) {
                                detailsContent.push(`⭐ **IMDb Puanı:** ${anime.imdbRating}`);
                            }
                            if (anime.duration) {
                                detailsContent.push(`⏱️ **Bölüm Süresi:** ${anime.duration} dakika`);
                            }

                            if (anime.totalVotes > 0) {
                                detailsContent.push(`📈 **Ort. Puan:** ${anime.averageRating.toFixed(1)}/10 (${anime.totalVotes} oy)`);
                            }

                            if (detailsField) {
                                detailsField.value = detailsContent.join(' | ');
                            } else if (detailsContent.length > 0) {
                                currentEmbed.addFields({ name: 'Detaylar', value: detailsContent.join(' | '), inline: false });
                            }

                            await finalMessage.edit({ embeds: [currentEmbed] }).catch(console.error);
                        }
                    }
                }
            }
            // Takvim ve diğer modal submit'ler burada devam edecekse, yukarıdaki gibi eklenebilir.
            return;
        }

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`"${interaction.commandName}" komutu bulunamadı.`);
                return;
            }

            try {
                await command.execute(interaction, client);
                const botStats = getBotStats();
                botStats.commandsUsed++;
                saveBotStats(botStats);
            } catch (error) {
                console.error(`Komut çalıştırılırken hata: ${interaction.commandName}`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Bu komutu çalıştırırken bir hata oluştu!', flags: [MessageFlags.Ephemeral] });
                } else {
                    await interaction.reply({ content: 'Bu komutu çalıştırırken bir hata oluştu!', flags: [MessageFlags.Ephemeral] });
                }
            }
        }
        else if (interaction.isButton()) { // Buton etkileşimleri (Anime sistemi ve TKM için)
            console.log(`[Interaction] Buton etkileşimi: Custom ID: ${interaction.customId}`);
            
            // TKM Butonları (Aynı kalacak)
            if (interaction.customId.startsWith('tkm_')) {
                const parts = interaction.customId.split('_');
                const actionType = parts[1];
                let gameId; 

                if (actionType === 'choice') {
                    gameId = parts[2]; 
                    const choice = parts[3]; 
                    console.log(`[TKM Buton] Seçim yapıldı. Game ID: ${gameId}, Choice: ${choice}, Oyuncu ID: ${interaction.user.id}`);
                    await tkmCommand.playRound(interaction, gameId, choice);
                    return; 
                } else {
                    gameId = parts[2]; 
                }

                console.log(`[TKM Buton] Action Type: ${actionType}, Game ID from Custom ID: ${gameId}`);
                console.log(`[TKM Buton] Mevcut aktif oyun sayısı: ${tkmCommand.activeGames.size}`);


                const game = tkmCommand.activeGames.get(gameId);

                if (!game) {
                    console.error(`[TKM Buton Hata] Game ID '${gameId}' için oyun objesi bulunamadı. Butona basan kullanıcı: ${interaction.user.tag} (${interaction.user.id})`);
                    return interaction.reply({ content: 'Bu oyun daveti süresi dolmuş veya oyun bitmiş. (Hata Kodu: I-NG)', ephemeral: true });
                }
                console.log(`[TKM Buton] Game objesi bulundu. Game ID: ${game.gameId}, Durum: ${game.status}, Init ID: ${game.initiatorId}, Opp ID: ${game.opponentId}`);


                if (actionType === 'accept') {
                    if (interaction.user.id !== game.opponentId) {
                        return interaction.reply({ content: 'Bu daveti yalnızca davet edilen kişi kabul edebilir.', ephemeral: true });
                    }
                    if (game.status !== 'pending') {
                        return interaction.reply({ content: 'Bu davet zaten kabul edilmiş veya süresi dolmuş.', ephemeral: true });
                    }

                    if (game.inviteTimeout) {
                        clearTimeout(game.inviteTimeout);
                        game.inviteTimeout = null;
                        console.log(`[TKM Buton] Davet kabul edildi. Timeout temizlendi. Game ID: ${gameId}`);
                    }

                    console.log(`[TKM Buton] Davet kabul edildi. Game ID: ${gameId}`);
                    await tkmCommand.updateGameInviteMessage(game, client, `${interaction.user.username} daveti kabul etti! Oyun başlıyor...`, true);

                    await tkmCommand.startGame(game, client);
                    await interaction.deferUpdate();

                } else if (actionType === 'decline') {
                    if (interaction.user.id !== game.opponentId) {
                        return interaction.reply({ content: 'Bu daveti yalnızca davet edilen kişi reddedebilir.', ephemeral: true });
                    }
                    console.log(`[TKM Buton] Davet reddedildi. Game ID: ${gameId}`);

                    if (game.inviteTimeout) {
                        clearTimeout(game.inviteTimeout);
                        game.inviteTimeout = null;
                        console.log(`[TKM Buton] Davet reddedildi. Timeout temizlendi. Game ID: ${gameId}`);
                    }

                    await tkmCommand.updateGameInviteMessage(game, client, `${interaction.user.username} daveti reddetti.`, true);
                    tkmCommand.activeGames.delete(gameId);
                    console.log(`[TKM Buton] Reddedilen oyun silindi. Game ID: ${gameId}, ActiveGames boyutu: ${tkmCommand.activeGames.size}`);
                    await interaction.deferUpdate();

                } else if (actionType === 'next') {
                    console.log(`[TKM Buton] Sonraki Tur. Game ID: ${gameId}, Oyuncu ID: ${interaction.user.id}`);
                    await tkmCommand.nextRound(interaction, gameId);
                }
                return;
            }

            // ANIME SİSTEMİ BUTONLARI (Eski haline getirildi)
            if (interaction.customId.startsWith('anime_rate_')) {
                const animeId = interaction.customId.split('_')[2];
                const animes = getAnimes();
                const anime = animes.find(a => a.id === animeId);

                if (!anime) {
                    return interaction.reply({ content: 'Bu anime bulunamadı veya silinmiş!', ephemeral: true });
                }

                const ratingModal = new ModalBuilder()
                    .setCustomId(`rate_anime_modal_${animeId}`)
                    .setTitle(`"${anime.name}" Bölümünü Puanla`);

                const ratingInput = new TextInputBuilder()
                    .setCustomId('rating_value')
                    .setLabel('Puan (1-10)')
                    .setPlaceholder('Örn: 8.5')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                ratingModal.addComponents(new ActionRowBuilder().addComponents(ratingInput));

                await interaction.showModal(ratingModal);
                return;
            }

            const requiredRoleIDs = [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID];
            if (!hasRequiredRoles(interaction.member, requiredRoleIDs) && interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: 'Bu butonu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.', flags: [MessageFlags.Ephemeral] });
            }

            if (interaction.customId === 'anime_add') {
                const modal = new ModalBuilder()
                    .setCustomId('add_anime_modal')
                    .setTitle('Yeni Anime Ekle');

                const animeNameInput = new TextInputBuilder()
                    .setCustomId('anime_name')
                    .setLabel('Anime Adı')
                    .setPlaceholder('Solo Leveling')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const animeEpisodeInput = new TextInputBuilder()
                    .setCustomId('anime_episode')
                    .setLabel('Bölüm No')
                    .setPlaceholder('3')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const animeSeasonInput = new TextInputBuilder()
                    .setCustomId('anime_season')
                    .setLabel('Sezon No')
                    .setPlaceholder('1')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const animeLinksInput = new TextInputBuilder()
                    .setCustomId('anime_links')
                    .setLabel('Linkler (Virgülle Ayır)')
                    .setPlaceholder('Gdrive, Vidmoly')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const animeContributorsInput = new TextInputBuilder()
                    .setCustomId('anime_contributors')
                    .setLabel('Hazırlayanlar (Virgülle Ayır)')
                    .setPlaceholder('Çevirmen: Patrol, Encoder: Leeis')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(animeNameInput);
                const secondActionRow = new ActionRowBuilder().addComponents(animeEpisodeInput);
                const thirdActionRow = new ActionRowBuilder().addComponents(animeSeasonInput);
                const fourthActionRow = new ActionRowBuilder().addComponents(animeLinksInput);
                const fifthActionRow = new ActionRowBuilder().addComponents(animeContributorsInput);

                modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

                await interaction.showModal(modal);

            } else if (interaction.customId === 'anime_delete') {
                const deleteModal = new ModalBuilder()
                    .setCustomId('delete_anime_modal')
                    .setTitle('Anime Sil');

                const animeIdInput = new TextInputBuilder()
                    .setCustomId('anime_id_to_delete')
                    .setLabel('Anime ID')
                    .setPlaceholder('ANM-0001')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                deleteModal.addComponents(new ActionRowBuilder().addComponents(animeIdInput));
                await interaction.showModal(deleteModal);

            } else if (interaction.customId === 'anime_list') {
                const animes = getAnimes();

                if (animes.length === 0) {
                    return interaction.reply({ content: 'Sistemde henüz eklenmiş bir anime bulunmuyor.', flags: [MessageFlags.Ephemeral] });
                }

                const animeListText = animes.map(anime =>
                    `**${anime.name}** (ID: \`${anime.id}\`) - S${anime.season} Bölüm ${anime.episode} - Durum: \`${anime.status}\``
                ).join('\n');

                const listEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Sistemdeki Animeler')
                    .setDescription(animeListText.length > 4000 ? animeListText.substring(0, 3997) + '...' : animeListText)
                    .setTimestamp()
                    .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() });

                await interaction.reply({ embeds: [listEmbed], flags: [MessageFlags.Ephemeral] });


            }
            else if (interaction.customId.startsWith('anime_status_')) {
                const parts = interaction.customId.split('_');
                const statusType = parts[2];
                const animeId = parts[3];

                const animes = getAnimes();
                const animeIndex = animes.findIndex(a => a.id === animeId);

                if (animeIndex === -1) {
                    return interaction.reply({ content: 'Bu anime bulunamadı veya silinmiş!', flags: [MessageFlags.Ephemeral] });
                }

                const anime = animes[animeIndex];
                const originalMessage = interaction.message;

                if (interaction.user.id !== OWNER_ID && !interaction.member.roles.cache.has(UPLOADER_ROLE_ID)) {
                    return interaction.reply({ content: 'Bu butonları kullanmaya yetkiniz yok! Sadece Uploader veya Bot Sahibi.', flags: [MessageFlags.Ephemeral] });
                }

                if (statusType === 'eklendi') {
                    const finalModal = new ModalBuilder()
                        .setCustomId(`finalize_anime_modal_${animeId}`)
                        .setTitle(`Anime Bilgilerini Tamamla`);

                    const imdbRatingInput = new TextInputBuilder()
                        .setCustomId('imdb_rating')
                        .setLabel('IMDb Puanı (1-10)')
                        .setPlaceholder('8.5')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false);

                    const episodeDurationInput = new TextInputBuilder()
                        .setCustomId('episode_duration')
                        .setLabel('Bölüm Süresi (Dk)')
                        .setPlaceholder('24')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false);

                    const finalLinksInput = new TextInputBuilder()
                        .setCustomId('final_links')
                        .setLabel('Linkler (Site:Link, Site2:Link2)')
                        .setPlaceholder('AnimeciX:link, OpenAnime:link')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    const imageUrlInput = new TextInputBuilder()
                        .setCustomId('image_url')
                        .setLabel('Görsel URL')
                        .setPlaceholder('https://example.com/poster.jpg')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false);

                    finalModal.addComponents(
                        new ActionRowBuilder().addComponents(imdbRatingInput),
                        new ActionRowBuilder().addComponents(episodeDurationInput),
                        new ActionRowBuilder().addComponents(finalLinksInput),
                        new ActionRowBuilder().addComponents(imageUrlInput)
                    );

                    await interaction.showModal(finalModal);

                } else {
                    const oldStatus = anime.status;
                    let color = '#ffc107';
                    let newStatusText = '';

                    switch (statusType) {
                        case 'ekleniyor':
                            anime.status = 'Ekleniyor';
                            newStatusText = 'Ekleniyor...';
                            color = '#17a2b8';
                            break;
                        case 'iptal_edildi':
                            anime.status = 'İptal Edildi';
                            newStatusText = 'İptal edildi.';
                            color = '#dc3545';
                            break;
                        default:
                            return interaction.reply({ content: 'Geçersiz durum tipi!', flags: [MessageFlags.Ephemeral] });
                    }

                    saveAnimes(animes);

                    const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
                        .setColor(color)
                        .setTitle(`${anime.name} - S${anime.season} Bölüm ${anime.episode}`)
                        .setDescription(`**ID:** \`${anime.id}\`\n**Ekleyen:** <@${anime.addedBy}>`)
                        .setFields(
                            { name: '👤 Hazırlayanlar', value: anime.contributors.join(', ') || 'Belirtilmemiş', inline: true },
                            { name: '✨ Durum', value: `\`\`\`${newStatusText}\`\`\``, inline: true },
                            { name: '🔗 İlk İzleme Linkleri', value: anime.initialLinks.map(link => `[Link](${link})`).join('\n') || 'Yok', inline: false }
                        )
                        .setTimestamp();

                    if (originalMessage.embeds[0].thumbnail) {
                        updatedEmbed.setThumbnail(originalMessage.embeds[0].thumbnail.url);
                    } else if (originalMessage.embeds[0].image) {
                        updatedEmbed.setThumbnail(originalMessage.embeds[0].image.url);
                        updatedEmbed.setImage(null);
                    }

                    const existingButtons = originalMessage.components[0] ? originalMessage.components[0].components : [];
                    const newActionRow = new ActionRowBuilder();

                    const updatedButtons = existingButtons.length > 0 ? existingButtons.map(btn => {
                        const customId = btn.customId;
                        const newBtn = ButtonBuilder.from(btn.data);

                        if (customId && customId.includes(statusType)) {
                            newBtn.setStyle(ButtonStyle.Primary);
                        } else {
                            if (customId && customId.includes('ekleniyor')) newBtn.setStyle(ButtonStyle.Secondary);
                            else if (customId && customId.includes('eklendi')) newBtn.setStyle(ButtonStyle.Success);
                            else if (customId && customId.includes('iptal_edildi')) newBtn.setStyle(ButtonStyle.Danger);
                        }
                        newBtn.setDisabled(false);
                        return newBtn;
                    }) : [
                        new ButtonBuilder()
                            .setCustomId(`anime_status_ekleniyor_${anime.id}`)
                            .setLabel('Ekleniyor')
                            .setStyle(statusType === 'ekleniyor' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                            .setDisabled(false),
                        new ButtonBuilder()
                            .setCustomId(`anime_status_eklendi_${anime.id}`)
                            .setLabel('Eklendi')
                            .setStyle(statusType === 'eklendi' ? ButtonStyle.Primary : ButtonStyle.Success)
                            .setDisabled(false),
                        new ButtonBuilder()
                            .setCustomId(`anime_status_iptal_edildi_${anime.id}`)
                            .setLabel('İptal Edildi')
                            .setStyle(statusType === 'iptal_edildi' ? ButtonStyle.Primary : ButtonStyle.Danger)
                            .setDisabled(false)
                    ];

                    newActionRow.addComponents(updatedButtons);

                    await originalMessage.edit({ embeds: [updatedEmbed], components: [newActionRow] });

                    const addedByUser = await client.users.fetch(anime.addedBy).catch(() => null);
                    if (addedByUser) {
                        await addedByUser.send(`\`${anime.name}\` (ID: \`${anime.id}\`) adlı animenin durumu güncellendi: **${oldStatus}** -> **${anime.status}**`).catch(console.error);
                    }

                    await interaction.reply({ content: `Anime durumu başarıyla **${anime.status}** olarak güncellendi.`, flags: [MessageFlags.Ephemeral] });
                }
            }
        }
        else if (interaction.isStringSelectMenu()) { // StringSelectMenu etkileşimleri
            console.log(`[Interaction] Select Menu etkileşimi: Custom ID: ${interaction.customId}`);

            if (interaction.customId === 'role_select_menu') {
                const selectedRoleIds = interaction.values; // Seçilen rollerin ID'leri bir array olarak gelir
                await processSelectedRoles(interaction, selectedRoleIds);
                return;
            }
        }
    },
};
