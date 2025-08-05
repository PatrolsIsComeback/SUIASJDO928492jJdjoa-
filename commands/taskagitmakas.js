const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { sleep, generateUniqueId } = require('../utils/helpers'); // <<< BURASI ÖNEMLİ! generateUniqueId'nin doğru import edildiğinden emin olun.
const { OWNER_ID } = require('../utils/config');

const activeGames = new Map();

const CHOICES = ['taş', 'kağıt', 'makas'];

function getWinner(player1Choice, player2Choice) {
    if (player1Choice === player2Choice) {
        return 'tie';
    }
    if (
        (player1Choice === 'taş' && player2Choice === 'makas') ||
        (player1Choice === 'kağıt' && player2Choice === 'taş') ||
        (player1Choice === 'makas' && player2Choice === 'kağıt')
    ) {
        return 'player1';
    }
    return 'player2';
}

async function updateGameInviteMessage(game, client, statusText = '', disableButtons = true) {
    if (!game || !game.inviteMessageId || !game.channelId) {
        console.warn(`[TKM] updateGameInviteMessage: Eksik game bilgisi. Game: ${JSON.stringify(game)}`);
        return;
    }

    const channel = client.channels.cache.get(game.channelId);
    if (!channel) {
        console.error(`[TKM] updateGameInviteMessage: Kanal bulunamadı: ${game.channelId}`);
        return;
    }

    try {
        const message = await channel.messages.fetch(game.inviteMessageId);
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🎮 Taş-Kağıt-Makas Oyunu Daveti')
            .setDescription(`**${game.initiatorUsername}** seni Taş-Kağıt-Makas oynamaya davet etti!`)
            .addFields(
                { name: 'Tur Sayısı', value: game.rounds.toString(), inline: true },
                { name: 'Davet Eden', value: `<@${game.initiatorId}>`, inline: true },
                { name: 'Davet Edilen', value: `<@${game.opponentId}>`, inline: true }
            )
            .setFooter({ text: statusText || 'Davet durumu güncellendi.', iconURL: client.user.displayAvatarURL() })
            .setTimestamp(game.timestamp);

        const components = disableButtons ? [] : message.components;
        await message.edit({ embeds: [embed], components: components });
        console.log(`[TKM] Davet mesajı güncellendi. Game ID: ${game.gameId}, Durum: ${statusText}`);
    } catch (error) {
        console.error(`[TKM] Davet mesajı güncellenirken hata oluştu (Mesaj bulunamadı/silindi?). Game ID: ${game.gameId}, Error:`, error.message);
    }
}


async function updateGamePanel(game, client, channel, title, description, showChoices = true, showNextRoundButton = false, disableChoiceButtons = false) {
    if (!game || !channel) {
        console.warn(`[TKM] updateGamePanel: Eksik game veya kanal bilgisi. Game: ${JSON.stringify(game)}, Channel: ${channel ? channel.id : 'null'}`);
        return;
    }

    const initiatorUser = await client.users.fetch(game.initiatorId).catch(() => null);
    const opponentUser = await client.users.fetch(game.opponentId).catch(() => null);

    if (!initiatorUser || !opponentUser) {
        console.error(`[TKM] updateGamePanel: Oyuncu bilgileri alınamadı. Initiator: ${game.initiatorId}, Opponent: ${game.opponentId}`);
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎮 ${title}`)
        .setDescription(description)
        .addFields(
            { name: `1. Oyuncu: ${initiatorUser.username}`, value: `Durum: \`${game.initiatorStatus}\``, inline: true },
            { name: `2. Oyuncu: ${opponentUser.username}`, value: `Durum: \`${game.opponentStatus}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'Güncel Skor', value: `${initiatorUser.username}: ${game.scores.initiator} - ${opponentUser.username}: ${game.scores.opponent}`, inline: true },
            { name: 'Tur', value: `${game.currentRound}/${game.rounds}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() });

    const components = [];
    if (showChoices) {
        const choiceRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tkm_choice_${game.gameId}_taş`) // Custom ID formatı değişti: tkm_choice_GAMEID_SECIM
                    .setLabel('🪨 Taş')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(disableChoiceButtons),
                new ButtonBuilder()
                    .setCustomId(`tkm_choice_${game.gameId}_kağıt`)
                    .setLabel('📄 Kağıt')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(disableChoiceButtons),
                new ButtonBuilder()
                    .setCustomId(`tkm_choice_${game.gameId}_makas`)
                    .setLabel('✂️ Makas')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(disableChoiceButtons)
            );
        components.push(choiceRow);
    }

    if (showNextRoundButton) {
        const nextRoundRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tkm_next_round_${game.gameId}`)
                    .setLabel('Sonraki Tur')
                    .setStyle(ButtonStyle.Success)
            );
        components.push(nextRoundRow);
    }

    try {
        if (game.lastInteractionMessageId) {
            const oldMessage = await channel.messages.fetch(game.lastInteractionMessageId).catch(() => null);
            if (oldMessage && !oldMessage.deleted) {
                await oldMessage.edit({ embeds: [embed], components: components });
                console.log(`[TKM] Oyun paneli güncellendi. Game ID: ${game.gameId}, Message ID: ${game.lastInteractionMessageId}`);
            } else {
                const newMessage = await channel.send({ embeds: [embed], components: components });
                game.lastInteractionMessageId = newMessage.id;
                console.log(`[TKM] Oyun paneli eski mesaj bulunamadığı için yeni gönderildi. Game ID: ${game.gameId}, Yeni Message ID: ${newMessage.id}`);
            }
        } else {
            const newMessage = await channel.send({ embeds: [embed], components: components });
            game.lastInteractionMessageId = newMessage.id;
            console.log(`[TKM] Oyun paneli ilk kez gönderildi. Game ID: ${game.gameId}, Message ID: ${newMessage.id}`);
        }
    } catch (error) {
        console.error(`[TKM] Oyun paneli güncellenirken/gönderilirken hata oluştu. Game ID: ${game.gameId}, Error:`, error.message);
    }
}


async function startGame(game, client) {
    console.log(`[TKM] Oyunu Başlatılıyor - Game ID: ${game.gameId}, Durum: ${game.status}`);
    game.status = 'playing';
    game.initiatorChoice = null;
    game.opponentChoice = null;
    game.initiatorStatus = 'Seçiyor...';
    game.opponentStatus = 'Seçiyor...';

    const channel = client.channels.cache.get(game.channelId);
    if (!channel) {
        console.error(`[TKM] startGame: Kanal bulunamadı: ${game.channelId}`);
        return;
    }

    await updateGamePanel(
        game,
        client,
        channel,
        `Taş-Kağıt-Makas - ${game.currentRound}. Tur`,
        'Seçiminizi aşağıdaki butonlardan yapın.',
        true,
        false
    );
    console.log(`[TKM] Oyun paneli başlatıldı/güncellendi. Game ID: ${game.gameId}`);
}

async function playRound(interaction, gameId, choice) {
    console.log(`[TKM] playRound çağrıldı. Game ID: ${gameId}, Choice: ${choice}, User: ${interaction.user.id}`);
    const game = activeGames.get(gameId);

    if (!game) {
        console.error(`[TKM] playRound: Game ID ${gameId} bulunamadı veya null. activeGames boyutu: ${activeGames.size}`);
        return interaction.reply({ content: 'Bu oyun şu an aktif değil veya bitmiş. (Hata Kodu: PR-NG)', ephemeral: true });
    }

    if (game.status !== 'playing') {
        console.warn(`[TKM] playRound: Game ID ${gameId} durumu 'playing' değil: ${game.status}`);
        return interaction.reply({ content: 'Bu oyun şu an aktif değil veya bitmiş. (Hata Kodu: PR-NS)', ephemeral: true });
    }

    const playerMakingChoiceId = interaction.user.id;

    if (playerMakingChoiceId !== game.initiatorId && playerMakingChoiceId !== game.opponentId) {
        return interaction.reply({ content: 'Bu oyunda oynamıyorsunuz.', ephemeral: true });
    }

    if (playerMakingChoiceId === game.initiatorId) {
        if (game.initiatorChoice) {
            return interaction.reply({ content: 'Zaten seçiminizi yaptınız!', ephemeral: true });
        }
        game.initiatorChoice = choice;
        game.initiatorStatus = `Seçti (${choice})`;
    } else if (playerMakingChoiceId === game.opponentId) {
        if (game.opponentChoice) {
            return interaction.reply({ content: 'Zaten seçiminizi yaptınız!', ephemeral: true });
        }
        game.opponentChoice = choice;
        game.opponentStatus = `Seçti (${choice})`;
    }

    await updateGamePanel(
        game,
        interaction.client,
        interaction.channel,
        `Taş-Kağıt-Makas - ${game.currentRound}. Tur`,
        'Seçimler bekleniyor...',
        true,
        false,
        (game.initiatorChoice && game.opponentChoice) ? false : true
    );

    await interaction.deferUpdate();

    if (game.initiatorChoice && game.opponentChoice) {
        const winner = getWinner(game.initiatorChoice, game.opponentChoice);

        const initiatorUser = await interaction.client.users.fetch(game.initiatorId);
        const opponentUser = await interaction.client.users.fetch(game.opponentId);

        let roundResultText = '';
        if (winner === 'tie') {
            roundResultText = `Her iki oyuncu da **${game.initiatorChoice}** seçti! Tur berabere.`;
        } else if (winner === 'player1') {
            game.scores.initiator++;
            roundResultText = `${initiatorUser.username} (**${game.initiatorChoice}**) ${opponentUser.username} (**${game.opponentChoice}**) karşısında turu kazandı!`;
        } else {
            game.scores.opponent++;
            roundResultText = `${opponentUser.username} (**${game.opponentChoice}**) ${initiatorUser.username} (**${game.initiatorChoice}**) karşısında turu kazandı!`;
        }

        await updateGamePanel(
            game,
            interaction.client,
            interaction.channel,
            `Taş-Kağıt-Makas - ${game.currentRound}. Tur Sonucu`,
            roundResultText,
            false,
            true
        );
        console.log(`[TKM] Tur ${game.currentRound} tamamlandı. Game ID: ${game.gameId}`);
    }
}

async function nextRound(interaction, gameId) {
    console.log(`[TKM] nextRound çağrıldı. Game ID: ${gameId}, User: ${interaction.user.id}`);
    const game = activeGames.get(gameId);

    if (!game) {
        console.error(`[TKM] nextRound: Game ID ${gameId} bulunamadı veya null. activeGames boyutu: ${activeGames.size}`);
        return interaction.reply({ content: 'Bu oyun şu an aktif değil veya bitmiş. (Hata Kodu: NR-NG)', ephemeral: true });
    }

    if (game.status !== 'playing') {
        console.warn(`[TKM] nextRound: Game ID ${gameId} durumu 'playing' değil: ${game.status}`);
        return interaction.reply({ content: 'Bu oyun şu an aktif değil veya bitmiş. (Hata Kodu: NR-NS)', ephemeral: true });
    }

    if (interaction.user.id !== game.initiatorId && interaction.user.id !== game.opponentId) {
        return interaction.reply({ content: 'Bu butonu sadece oyunculardan biri kullanabilir.', ephemeral: true });
    }

    await interaction.deferUpdate();

    game.currentRound++;
    game.initiatorChoice = null;
    game.opponentChoice = null;
    game.initiatorStatus = 'Seçiyor...';
    game.opponentStatus = 'Seçiyor...';

    const initiatorUser = await interaction.client.users.fetch(game.initiatorId);
    const opponentUser = await interaction.client.users.fetch(game.opponentId);

    const channel = interaction.client.channels.cache.get(game.channelId);
    if (!channel) {
        console.error(`[TKM] nextRound: Kanal bulunamadı: ${game.channelId}`);
        return;
    }

    if (game.currentRound <= game.rounds) {
        await updateGamePanel(
            game,
            interaction.client,
            channel,
            `Taş-Kağıt-Makas - ${game.currentRound}. Tur`,
            'Seçiminizi aşağıdaki butonlardan yapın.',
            true,
            false
        );
        console.log(`[TKM] Tur ${game.currentRound} başlatıldı. Game ID: ${game.gameId}`);
    } else {
        let finalResultText = '';
        let finalColor = '#7289DA';

        if (game.scores.initiator > game.scores.opponent) {
            finalResultText = `Tebrikler ${initiatorUser.username}, oyunu **${game.scores.initiator} - ${game.scores.opponent}** skorla kazandın!`;
            finalColor = '#2ECC71';
        } else if (game.scores.opponent > game.scores.initiator) {
            finalResultText = `Tebrikler ${opponentUser.username}, oyunu **${game.scores.opponent} - ${game.scores.initiator}** skorla kazandın!`;
            finalColor = '#2ECC71';
        } else {
            finalResultText = `Oyun berabere bitti! Skor: **${game.scores.initiator} - ${game.scores.opponent}**.`;
            finalColor = '#F1C40F';
        }

        const gameEndEmbed = new EmbedBuilder()
            .setColor(finalColor)
            .setTitle('🏆 Taş-Kağıt-Makas Oyunu Bitti!')
            .setDescription(finalResultText)
            .addFields(
                { name: 'Nihai Skor', value: `${initiatorUser.username}: ${game.scores.initiator} - ${opponentUser.username}: ${game.scores.opponent}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'SomeSub Bot', iconURL: interaction.client.user.displayAvatarURL() });

        if (channel && game.lastInteractionMessageId) {
            try {
                const oldMessage = await channel.messages.fetch(game.lastInteractionMessageId);
                if (!oldMessage.deleted) {
                    await oldMessage.edit({ embeds: [gameEndEmbed], components: [] });
                } else {
                    await channel.send({ embeds: [gameEndEmbed] });
                }
            } catch (error) {
                console.error(`[TKM] Oyun sonu mesajı güncellenirken/gönderilirken hata: ${error.message}`);
                await channel.send({ embeds: [gameEndEmbed] }).catch(console.error);
            }
        }
        activeGames.delete(gameId);
        console.log(`[TKM] Oyun sona erdi. Game ID: ${game.gameId}`);
    }
}


module.exports = {
    activeGames,
    startGame,
    playRound,
    nextRound,
    updateGameInviteMessage,

    data: new SlashCommandBuilder()
        .setName('tkm')
        .setDescription('Birine taş-kağıt-makas oynamaya davet et!')
        .addUserOption(option =>
            option.setName('oyuncu')
                .setDescription('Meydan okuyacağın oyuncu.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('tur')
                .setDescription('Kaç tur oynanacak? (Varsayılan: 3)')
                .setRequired(false)),

    prefix: {
        name: 'tkm',
        aliases: ['taskagitmakas', 'rockpaperscissors'],
        description: 'Birine taş-kağıt-makas oynamanızı sağlar.',
        usage: '!tkm <@oyuncu> [tur_sayısı]',
        async execute(message, args) {
            const targetUser = message.mentions.users.first();
            if (!targetUser) {
                return message.reply('Lütfen meydan okuyacağınız birini etiketleyin!');
            }

            if (targetUser.bot) {
                return message.reply('Botlarla taş-kağıt-makas oynayamazsın!');
            }
            if (targetUser.id === message.author.id) {
                return message.reply('Kendinle taş-kağıt-makas oynayamazsın!');
            }

            const rounds = parseInt(args[1]) || 3;
            if (isNaN(rounds) || rounds <= 0 || rounds > 10) {
                return message.reply('Tur sayısı 1 ile 10 arasında bir sayı olmalı.');
            }

            for (const [gameIdIter, gameIter] of activeGames.entries()) {
                if ((gameIter.initiatorId === message.author.id || gameIter.opponentId === message.author.id) && gameIter.status !== 'ended') {
                    return message.reply('Zaten aktif bir Taş-Kağıt-Makas oyununuz var. Lütfen mevcut oyununuzu bitirin veya başka bir oyun başlatmak için bekleyin.');
                }
                if ((gameIter.initiatorId === targetUser.id || gameIter.opponentId === targetUser.id) && gameIter.status !== 'ended') {
                    return message.reply(`${targetUser.username} zaten aktif bir Taş-Kağıt-Makas oyununda. Lütfen oyununun bitmesini bekleyin.`);
                }
            }


            const gameId = generateUniqueId('TKM', 5);

            const invitationTimeoutDuration = 60 * 1000;

            const newGame = {
                gameId: gameId,
                initiatorId: message.author.id,
                initiatorUsername: message.author.username,
                opponentId: targetUser.id,
                opponentUsername: targetUser.username,
                status: 'pending',
                rounds: rounds,
                currentRound: 1,
                initiatorChoice: null,
                opponentChoice: null,
                initiatorStatus: 'Bekleniyor...',
                opponentStatus: 'Bekleniyor...',
                scores: { initiator: 0, opponent: 0 },
                lastInteractionMessageId: null,
                channelId: message.channel.id,
                inviteMessageId: null,
                timestamp: Date.now(),
                inviteTimeout: null
            };
            activeGames.set(gameId, newGame);

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🎮 Taş-Kağıt-Makas Oyunu Daveti')
                .setDescription(`**${message.author.username}** seni Taş-Kağıt-Makas oynamaya davet etti!\n\n${targetUser}, kabul etmek için aşağıdaki düğmeye tıkla.`)
                .addFields(
                    { name: 'Tur Sayısı', value: rounds.toString(), inline: true },
                    { name: 'Davet Eden', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Davet Edilen', value: `<@${targetUser.id}>`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Davet geçerlilik süresi: 60 saniye', iconURL: message.client.user.displayAvatarURL() });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tkm_accept_${gameId}`)
                        .setLabel('Daveti Kabul Et')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`tkm_decline_${gameId}`)
                        .setLabel('Daveti Reddet')
                        .setStyle(ButtonStyle.Danger)
                );

            const sentMessage = await message.reply({ embeds: [embed], components: [row] });
            activeGames.get(gameId).inviteMessageId = sentMessage.id;
            console.log(`[TKM] Yeni oyun daveti gönderildi. Game ID: ${gameId}, Invite Message ID: ${sentMessage.id}`);

            newGame.inviteTimeout = setTimeout(async () => {
                const game = activeGames.get(gameId);
                if (game && game.status === 'pending') {
                    console.log(`[TKM] Davet süresi doldu. Game ID: ${gameId}`);
                    await updateGameInviteMessage(game, message.client, 'Davet süresi doldu.', true);
                    activeGames.delete(gameId);
                    console.log(`[TKM] Süresi dolan oyun silindi. Game ID: ${gameId}, ActiveGames boyutu: ${activeGames.size}`);
                } else if (game) {
                    console.log(`[TKM] Davet süresi doldu, ancak oyun zaten başladı veya bitti. Game ID: ${gameId}, Durum: ${game.status}`);
                }
            }, invitationTimeoutDuration);
        }
    }
};
