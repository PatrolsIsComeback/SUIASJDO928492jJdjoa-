// commands/anime-takvimi.js

const { SlashCommandBuilder } = require('discord.js');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getAnimes } = require('../utils/db');
const { OWNER_ID, UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID } = require('../utils/config');
const { hasRequiredRoles } = require('../utils/functions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anime-takvimi')
        .setDescription('Anime takvimi komutları.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Takvime yeni bir anime ekle.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('düzenle')
                .setDescription('Mevcut bir anime kaydını düzenle.')
                .addStringOption(option =>
                    option.setName('anime_id')
                        .setDescription('Düzenlenecek animenin ID\'si (Örn: ANM-0001)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listele')
                .setDescription('Takvimdeki tüm animeleri listele.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Takvimden bir anime kaydını sil.')
                .addStringOption(option =>
                    option.setName('anime_id')
                        .setDescription('Silinecek animenin ID\'si (Örn: ANM-0001)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bitir')
                .setDescription('Bir animenin yayınını tamamla ve bildirim gönder.')
                .addStringOption(option =>
                    option.setName('anime_id')
                        .setDescription('Tamamlanacak animenin ID\'si (Örn: ANM-0001)')
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        // console.log(`[AnimeTakvimiCommand] ${interaction.options.getSubcommand()} alt komutu çağrıldı.`); // Debug log spamı önlemek için yorum satırı
        // Yetki kontrolü: Sadece belirlenen yetkili rollere sahip olanlar veya bot sahibi kullanabilir.
        const requiredRoleIDs = [UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID];
        if (!hasRequiredRoles(interaction.member, requiredRoleIDs) && interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'Bu komutu kullanmaya yetkiniz yok! Yalnızca yetkili ekip üyeleri ve bot sahibi kullanabilir.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'ekle') {
            // console.log('[AnimeTakvimiCommand] "ekle" alt komutu. Modal oluşturuluyor...'); // Debug log spamı önlemek için yorum satırı
            const modal = new ModalBuilder()
                .setCustomId('addAnimeModal')
                .setTitle('Yeni Anime Ekle');

            const animeNameInput = new TextInputBuilder()
                .setCustomId('animeName')
                .setLabel('Anime Adı')
                .setPlaceholder('Örn: Solo Leveling') // Kısaltıldı
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const episodeInput = new TextInputBuilder()
                .setCustomId('episode')
                .setLabel('Bölüm No')
                .setPlaceholder('Örn: 12') // Kısaltıldı
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const seasonInput = new TextInputBuilder()
                .setCustomId('season')
                .setLabel('Sezon No')
                .setPlaceholder('Örn: 1') // Kısaltıldı
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const releaseDateInput = new TextInputBuilder()
                .setCustomId('releaseDate')
                .setLabel('Çıkış Tarihi') // Daha da kısaltıldı
                .setPlaceholder('YYYY-MM-DD (2025-07-22)') // Daha kısa ve net
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const translateTimeInput = new TextInputBuilder()
                .setCustomId('translateTime')
                .setLabel('Tah. Çeviri Süresi') // Daha da kısaltıldı
                .setPlaceholder('Örn: 2 saat')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(animeNameInput),
                new ActionRowBuilder().addComponents(episodeInput),
                new ActionRowBuilder().addComponents(seasonInput),
                new ActionRowBuilder().addComponents(releaseDateInput),
                new ActionRowBuilder().addComponents(translateTimeInput)
            );
            try {
                await interaction.showModal(modal);
                // console.log('[AnimeTakvimiCommand] Modal başarıyla gösterildi.'); // Debug log spamı önlemek için yorum satırı
            } catch (error) {
                console.error('[AnimeTakvimiCommand] "ekle" modali gösterilirken hata:', error);
                await interaction.reply({ content: `Anime ekleme formu açılırken bir hata oluştu: \`${error.message}\`. Lütfen bot sahibine danışın.`, ephemeral: true });
            }

        } else if (subcommand === 'düzenle') {
            const animeId = interaction.options.getString('anime_id').toUpperCase();
            const animes = getAnimes();
            const animeToEdit = animes.find(anime => anime.id === animeId);

            if (!animeToEdit) {
                return interaction.reply({ content: `ID'si **${animeId}** olan bir anime bulunamadı.`, ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`editAnimeModal_${animeId}`)
                .setTitle(`"${animeToEdit.name}" Düzenle`);

            const animeNameInput = new TextInputBuilder()
                .setCustomId('animeName')
                .setLabel('Anime Adı')
                .setPlaceholder('Örn: Solo Leveling')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(animeToEdit.animeName || '');

            const episodeInput = new TextInputBuilder()
                .setCustomId('episode')
                .setLabel('Bölüm No')
                .setPlaceholder('Örn: 12')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(String(animeToEdit.episode || ''));

            const seasonInput = new TextInputBuilder()
                .setCustomId('season')
                .setLabel('Sezon No')
                .setPlaceholder('Örn: 1')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(String(animeToEdit.season || ''));

            const releaseDateInput = new TextInputBuilder()
                .setCustomId('releaseDate')
                .setLabel('Çıkış Tarihi')
                .setPlaceholder('YYYY-MM-DD (2025-07-22)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(animeToEdit.releaseDate || '');

            const translateTimeInput = new TextInputBuilder()
                .setCustomId('translateTime')
                .setLabel('Tah. Çeviri Süresi')
                .setPlaceholder('Örn: 2 saat')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(animeToEdit.translateTime || '');

            modal.addComponents(
                new ActionRowBuilder().addComponents(animeNameInput),
                new ActionRowBuilder().addComponents(episodeInput),
                new ActionRowBuilder().addComponents(seasonInput),
                new ActionRowBuilder().addComponents(releaseDateInput),
                new ActionRowBuilder().addComponents(translateTimeInput)
            );

            try {
                await interaction.showModal(modal);
            } catch (error) {
                console.error('[AnimeTakvimiCommand] "düzenle" modali gösterilirken hata:', error);
                await interaction.reply({ content: `Anime düzenleme formu açılırken bir hata oluştu: \`${error.message}\`.`, ephemeral: true });
            }

        } else if (subcommand === 'listele') {
            const animes = getAnimes();

            if (animes.length === 0) {
                return interaction.reply({ content: 'Takvimde henüz eklenmiş bir anime bulunmuyor.', ephemeral: true });
            }

            let response = '### 🗓️ Anime Takvimi:\n\n';
            animes.forEach(anime => {
                response += `**ID:** \`${anime.id}\` | **${anime.animeName}** S${anime.season} Bölüm ${anime.episode}\n` +
                            `   - Çıkış: \`${anime.releaseDate || 'Belirtilmemiş'}\` | Çeviri: \`${anime.translateTime || 'Belirtilmemiş'}\`\n\n`;
            });

            if (response.length > 2000) {
                response = response.substring(0, 1990) + '... (Liste çok uzun, daha fazla öğe var.)';
            }

            await interaction.reply({ content: response, ephemeral: true });

        } else if (subcommand === 'sil') {
            const animeId = interaction.options.getString('anime_id').toUpperCase();
            const animes = getAnimes();
            const initialLength = animes.length;
            const updatedAnimes = animes.filter(anime => anime.id !== animeId);

            if (updatedAnimes.length === initialLength) {
                return interaction.reply({ content: `ID'si **${animeId}** olan bir anime bulunamadı.`, ephemeral: true });
            }

            require('fs').writeFileSync('./data/animes.json', JSON.stringify(updatedAnimes, null, 2));
            await interaction.reply({ content: `ID'si **${animeId}** olan anime takvimden başarıyla silindi.`, ephemeral: true });

        } else if (subcommand === 'bitir') {
            const animeId = interaction.options.getString('anime_id').toUpperCase();

            const animes = getAnimes();
            const animeToFinalize = animes.find(a => a.id === animeId);

            if (!animeToFinalize) {
                return interaction.reply({ content: 'Bu ID\'ye sahip bir anime bulunamadı.', ephemeral: true });
            }

            const finalModal = new ModalBuilder()
                .setCustomId(`finalize_anime_modal_${animeId}`)
                .setTitle(`"${animeToFinalize.name}" Bitirme Bilgileri`);

            const imdbRatingInput = new TextInputBuilder()
                .setCustomId('imdb_rating')
                .setLabel('IMDb Puanı (1-10)')
                .setPlaceholder('8.5')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(String(animeToFinalize.imdbRating || ''));

            const episodeDurationInput = new TextInputBuilder()
                .setCustomId('episode_duration')
                .setLabel('Bölüm Süresi (Dakika)')
                .setPlaceholder('24')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(String(animeToFinalize.duration || ''));

            const finalLinksInput = new TextInputBuilder()
                .setCustomId('final_links')
                .setLabel('Linkler (Site:Link, Site2:Link2)') // Daha açık ve kısa
                .setPlaceholder('AnimeciX:link, OpenAnime:link')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setValue(animeToFinalize.finalLinks.map(link => `${link.name}: ${link.url}`).join(', ') || '');

            const imageUrlInput = new TextInputBuilder()
                .setCustomId('image_url')
                .setLabel('Görsel URL')
                .setPlaceholder('https://example.com/poster.jpg')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(animeToFinalize.imageUrl || '');

            finalModal.addComponents(
                new ActionRowBuilder().addComponents(imdbRatingInput),
                new ActionRowBuilder().addComponents(episodeDurationInput),
                new ActionRowBuilder().addComponents(finalLinksInput),
                new ActionRowBuilder().addComponents(imageUrlInput)
            );

            try {
                await interaction.showModal(finalModal);
            } catch (error) {
                console.error('[AnimeTakvimiCommand] "bitir" modali gösterilirken hata:', error);
                await interaction.reply({ content: `Anime bitirme formu açılırken bir hata oluştu: \`${error.message}\`.`, ephemeral: true });
            }
        }
    },
};
