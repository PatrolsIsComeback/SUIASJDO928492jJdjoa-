// index.js (Sizin verdiğiniz kodun güncellenmiş hali)

const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const { TOKEN, PREFIX, OWNER_ID, HANGMAN_CATEGORY_ID, ADAM_ASMACA_CREATE_ROOM_CHANNEL_ID } = require('./utils/config');
const fs = require('node:fs');
const path = require('node:path');

const { startNewsChecker, stopNewsChecker } = require('./utils/newsChecker');
const { getSystemSettings, saveSystemSettings } = require('./utils/db'); // db.js'den geldiğini varsayıyorum
const hangmanManager = require('./utils/hangmanManager');
const unvanSystem = require('./utils/unvanSystem'); // Unvan sistemini dahil et


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.prefixCommands = new Collection();

client.userChatHistory = new Map();

const slashCommands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }

    if (command.prefix && 'name' in command.prefix && 'execute' in command.prefix) {
        client.prefixCommands.set(command.prefix.name, command.prefix);
        if (command.prefix.aliases && Array.isArray(command.prefix.aliases)) {
            command.prefix.aliases.forEach(alias => {
                client.prefixCommands.set(alias, command.prefix);
            });
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.once('ready', async () => {
    console.log(`Hazır! ${client.user.tag} olarak giriş yapıldı.`);

    console.log(`[index.js] Adam Asmaca kategori ID'si ayarlandı: ${HANGMAN_CATEGORY_ID}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log(`Toplam ${slashCommands.length} adet uygulama (/) komutu yenileniyor.`);
        
        // Buraya botun olduğu sunucunun ID'sını GİR!
        const guildId = '1257274392120004651'; // Sizin verdiğiniz Guild ID

        const data = await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId), 
            { body: slashCommands }, 
        );

        console.log(`Başarıyla ${data.length} adet uygulama (/) komutu yüklendi ve sunucuya kaydedildi.`);
    } catch (error) {
        console.error('Uygulama (/) komutları kaydedilirken hata oluştu:', error);
    }

    const settings = getSystemSettings(); 
    if (settings.haberSistemi.active) {
        startNewsChecker(client); 
        console.log('Haber sistemi ayarları aktif: Başlatıldı.');
    } else {
        console.log('Haber sistemi ayarlarda kapalı olduğu için otomatik başlatılmadı.');
    }

    if (settings.hangmanSystem && typeof settings.hangmanSystem.active === 'boolean') {
        hangmanManager.setHangmanSystemStatus(settings.hangmanSystem.active);
        console.log(`Adam Asmaca sistemi açılışta ${settings.hangmanSystem.active ? 'aktif' : 'pasif'} olarak ayarlandı.`);
    } else {
        hangmanManager.setHangmanSystemStatus(false);
        console.log('Adam Asmaca sistemi ayarı bulunamadı, varsayılan olarak pasif ayarlandı.');
    }
});


// !!! BURASI ÖNEMLİ: interactionCreate event'ini buraya taşıyoruz veya bu bloğu ekliyoruz.
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    // Unvan filtreleme menüsünden geliyorsa
    if (interaction.customId.startsWith('select_unvan_filter_')) {
        const targetUserId = interaction.customId.split('_')[3]; // customId'den kullanıcı ID'sini al
        const filterType = interaction.values[0]; // Seçilen filtre tipi
        const targetUser = await client.users.fetch(targetUserId).catch(() => null);

        if (!targetUser) {
            return interaction.reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
        }

        const unvanData = unvanSystem.getUserUnvanData(targetUser.id);
        const allTitles = unvanSystem.getAllTitles();
        let filteredTitles = [];
        let embedTitle = '';
        let embedDescription = '';

        switch (filterType) {
            case 'all_titles':
                filteredTitles = allTitles;
                embedTitle = `📜 Tüm Unvanlar`;
                embedDescription = `**${targetUser.username}** için mevcut tüm unvanlar:`;
                break;
            case 'awarded_titles':
                filteredTitles = allTitles.filter(title => unvanData.awardedTitles.includes(title.id));
                embedTitle = `🏆 Kazanılan Unvanlar`;
                embedDescription = `**${targetUser.username}**'ın kazandığı unvanlar:`;
                break;
            case 'available_titles':
                filteredTitles = allTitles.filter(title => !unvanData.awardedTitles.includes(title.id));
                embedTitle = `⏳ Kazanılabilir Unvanlar`;
                embedDescription = `**${targetUser.username}**'ın henüz kazanmadığı unvanlar:`;
                break;
            case 'xp_titles':
                filteredTitles = allTitles.filter(title => title.type === 'xp');
                embedTitle = `✨ XP Unvanları`;
                embedDescription = `XP ile kazanılan unvanlar:`;
                break;
            case 'activity_titles':
                filteredTitles = allTitles.filter(title => title.type === 'activity');
                embedTitle = `🏃 Aktivite Unvanları`;
                embedDescription = `Aktivite ile kazanılan unvanlar:`;
                break;
            case 'activity_time_based_titles':
                filteredTitles = allTitles.filter(title => title.type === 'activity_time_based');
                embedTitle = `🌙 Zaman Tabanlı Aktivite Unvanları`;
                embedDescription = `Belirli saat aralıklarında aktivite ile kazanılan unvanlar:`;
                break;
            default:
                filteredTitles = allTitles;
                embedTitle = `📜 Tüm Unvanlar`;
                embedDescription = `**${targetUser.username}** için mevcut tüm unvanlar:`;
                break;
        }

        const responseEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(embedTitle)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(embedDescription)
            .setFooter({ text: 'SomeSub Bot | Unvanlar', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        if (filteredTitles.length === 0) {
            responseEmbed.setDescription('Bu kategoriye ait unvan bulunamadı.');
        } else {
            for (const title of filteredTitles) {
                const userHasTitle = unvanData.awardedTitles.includes(title.id);
                let progressText = '';

                if (userHasTitle) {
                    progressText = '✅ **Kazanıldı!**';
                } else {
                    const currentProgress = await unvanSystem.calculateTitleProgress(targetUser.id, title, client);
                    if (title.type === 'xp') {
                        progressText = `Durum: \`${currentProgress}/${title.requirements.totalXP}\` XP`;
                    } else if (title.type === 'activity') {
                         // activityMessages'ın bir array olduğunu varsayarak
                        const progressActiveMinutes = currentProgress.activeMinutes || 0;
                        const progressMessages = currentProgress.messages || 0;
                        progressText = `Durum: **${progressActiveMinutes}/${title.requirements.timeWindowMinutes}** dakika, **${progressMessages}/${title.requirements.minMessages}** mesaj`;
                    } else if (title.type === 'activity_time_based') {
                        progressText = `Durum: **${currentProgress}/${title.requirements.messageCount}** mesaj (Saat: ${title.requirements.startTime}-${title.requirements.endTime})`;
                    } else {
                        progressText = 'Durum: Bilinmiyor';
                    }
                }
                responseEmbed.addFields({
                    name: `**${title.name}**`,
                    value: `${title.description}\n${progressText}`,
                    inline: false
                });
            }
        }
        await interaction.update({ embeds: [responseEmbed], components: [interaction.message.components[0]] });
    }
    // Eğer başka interaction türleriniz varsa (örneğin butonlar, slash komutları), buraya ekleyebilirsiniz.
    // Örnek: if (interaction.isCommand()) { ... }
    // Örnek: if (interaction.isButton()) { ... }
});


client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);

    if (!command) return;

    try {
        // messageCreate event'indeki komutların args, message, client parametrelerini doğru alması için:
        // Komut dosyalarınızda da bu parametreleri bekliyor olmalısınız.
        await command.execute(message, args, client); 
    } catch (error) {
        console.error(`Prefix komutu "${commandName}" yürütülürken bir hata oluştu:`, error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Hata!')
            .setDescription(`\`${PREFIX}${commandName}\` komutunu çalıştırırken bir sorun oluştu. Lütfen daha sonra tekrar dene.`)
            .setTimestamp()
            .setFooter({ text: 'SomeSub Bot', iconURL: client.user.displayAvatarURL() });
        await message.reply({ embeds: [errorEmbed] }).catch(err => console.error("Hata embed'i gönderilemedi:", err));
    }
});


client.login(TOKEN);

process.on('unhandledRejection', async (error) => {
    console.error('[UNHANDLED REJECTION]', error);
    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    if (owner) owner.send(`[UNHANDLED REJECTION] Botta bir hata oluştu: \n\`\`\`js\n${error.stack}\n\`\`\``).catch(console.error);
});

process.on('uncaughtException', async (error) => {
    console.error('[UNCAUGHT EXCEPTION]', error);
    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    if (owner) owner.send(`[UNCAUGHT EXCEPTION] Botta kritik bir hata oluştu: \n\`\`\`js\n${error.stack}\n\`\`\``).catch(console.error);
    process.exit(1);
});
