// utils/newsChecker.js

const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { getSystemSettings, saveSystemSettings } = require('./db');

// --- AYARLANABİLİR BÖLÜM BAŞLANGICI ---

const ANIME_NEWS_CHANNEL_ID = '1397673419461496882';
const ANIME_NEWS_ROLE_ID = '1397999380404899900';

const RSS_FEEDS = [
    { name: 'Donanım Haber Anime', url: 'http://www.donanimhaber.com/rss/animeler/', language: 'tr' },
    { name: 'Anime News Network', url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us', language: 'en' }
];

// İlk taramada ne kadar eski haberlerin kontrol edileceğini belirler (ŞU AN İÇİN 1 MİLİSANİYE)
// Bu değer SADECE sentNews.json'ı doğru başlatmak için kullanılır.
const INITIAL_MAX_NEWS_AGE_MS = 1; // Botun ilk çalıştığında geçmişe dönük HİÇBİR ŞEY ATMAMASINI sağlar

const GEMINI_API_KEY = 'AIzaSyDhCrWSPIffTa-xuT3cknLNuXTeh6nTbb8'; // Gemini API anahtarınızı buraya girin
const GEMINI_MODEL_ID = 'gemini-1.5-flash';
const CRON_SCHEDULE = '0 * * * *'; // Her saatin 0. dakikasında

// HABER VERİTABANI YOLU
const NEWS_DB_PATH = path.join(__dirname, '..', 'data', 'sentNews.json');

// --- AYARLANABİLİR BÖLÜM BİTİŞİ ---

let newsMetadata = {
    lastCheckedNews: {},
    initialScanCompleted: false
};
let currentNewsJob = null;

function loadNewsMetadata() {
    try {
        if (fs.existsSync(NEWS_DB_PATH)) {
            const data = fs.readFileSync(NEWS_DB_PATH, 'utf8');
            newsMetadata = JSON.parse(data);
            newsMetadata.lastCheckedNews = newsMetadata.lastCheckedNews || {};
            newsMetadata.initialScanCompleted = newsMetadata.initialScanCompleted || false;
            console.log(`[NEWS_DB] Haber meta veritabanı yüklendi. Initial Scan Completed: ${newsMetadata.initialScanCompleted}`);
        } else {
            fs.writeFileSync(NEWS_DB_PATH, JSON.stringify(newsMetadata, null, 2));
            console.log('[NEWS_DB] Yeni haber meta veritabanı oluşturuldu.');
        }
    } catch (error) {
        console.error('[NEWS_DB_HATASI] Haber meta veritabanı yüklenirken/oluşturulurken hata:', error);
        newsMetadata = { lastCheckedNews: {}, initialScanCompleted: false }; // Hata durumunda sıfırla
    }
}

function saveNewsMetadata() {
    try {
        fs.writeFileSync(NEWS_DB_PATH, JSON.stringify(newsMetadata, null, 2));
        console.log('[NEWS_DB] Haber meta veritabanı kaydedildi.');
    } catch (error) {
        console.error('[NEWS_DB_HATASI] Haber meta veritabanı kaydedilirken hata:', error);
    }
}

async function translateText(text, targetLanguage = 'tr') {
    if (!GEMINI_API_KEY || !text || text.trim() === '') return text;
    if (text.length > 3000) {
        text = text.substring(0, 3000);
        console.warn('[GEMINI] Çevirilecek metin çok uzun, kısaltıldı.');
    }

    try {
        const nowInIstanbul = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const prompt = `Translate the following text to Turkish. Respond ONLY with the translated text, without any additional conversational phrases, explanations, or formatting. **Do not translate proper nouns, titles, or names of anime/manga series.** If the text is already in Turkish or cannot be translated, return the original text.\n\nText:\n"${text}"` +
                       `\n\n${nowInIstanbul} anındaki Türkiye saati ile bu çeviriyi yap.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[GEMINI_HTTP_HATASI] HTTP Hatası: ${response.status} ${response.statusText} - Yanıt: ${errorBody}`);
            return text;
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            let translated = data.candidates[0].content.parts[0].text.trim();
            if (translated.toLowerCase().includes("translate the following text") || translated.length < 5) {
                console.warn('[GEMINI] Çeviri başarısız veya anlamsız. Orijinal metin döndürüldü.');
                return text;
            }
            return translated;
        } else if (data.error) {
            console.error('[GEMINI_API_HATASI] Gemini API Hatası Yanıtı:', data.error);
        } else {
            console.error('[GEMINI_API_HATASI] Gemini yanıt yapısı beklenmiyor veya çeviri yok:', data);
        }
    } catch (error) {
        console.error('[GEMINI_KRİTİK_HATA] Gemini çeviri isteği sırasında kritik hata oluştu:', error);
    }
    return text;
}

async function fetchImageFromPage(url) {
    if (!url) return null;

    try {
        const response = await fetch(url, { timeout: 5000 });
        if (!response.ok) {
            console.warn(`[GÖRSEL ÇEKME] URL'den içerik alınamadı (${url}): ${response.status} ${response.statusText}`);
            return null;
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10 MB limit
            console.warn(`[GÖRSEL ÇEKME] Çok büyük sayfa boyutu (${contentLength} byte) nedeniyle görsel çekme atlandı: ${url}`);
            return null;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);

        let ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
            console.log(`[GÖRSEL ÇEKME] Og:image bulundu: ${ogImage.substring(0, Math.min(ogImage.length, 50))}...`);
            return ogImage;
        }

        let twitterImage = $('meta[name="twitter:image"]').attr('content');
        if (twitterImage) {
            console.log(`[GÖRSEL ÇEKME] Twitter:image bulundu: ${twitterImage.substring(0, Math.min(twitterImage.length, 50))}...`);
            return twitterImage;
        }

        let mainImage = $('article img, .post-content img, .entry-content img').first().attr('src');
        if (mainImage) {
            if (mainImage.startsWith('//')) mainImage = `http:${mainImage}`;
            else if (mainImage.startsWith('/')) mainImage = new URL(mainImage, url).href;
            
            console.log(`[GÖRSEL ÇEKME] Ana img etiketi bulundu: ${mainImage.substring(0, Math.min(mainImage.length, 50))}...`);
            return mainImage;
        }

    } catch (error) {
        console.error(`[GÖRSEL ÇEKME_KRİTİK_HATA] URL'den görsel çekilirken hata oluştu (${url}):`, error.message);
    }
    return null;
}

async function checkAndSendNews(client) {
    let settings = getSystemSettings();
    if (!settings.haberSistemi.active) {
        console.log('[HABER] Haber sistemi kapalı olduğu için kontrol atlandı.');
        return;
    }

    console.log('[HABER] Anime haberleri kontrol ediliyor...');
    loadNewsMetadata(); // Yeni meta verileri yükle

    const parser = new Parser();
    const newsChannel = client.channels.cache.get(ANIME_NEWS_CHANNEL_ID);

    if (!newsChannel) {
        console.error(`[HABER_HATA] Hata: Haber kanalı bulunamadı! ID: ${ANIME_NEWS_CHANNEL_ID}. Lütfen CHANNEL_ID'yi doğru girdiğinizden emin olun.`);
        settings.haberSistemi.active = false;
        saveSystemSettings(settings);
        stopNewsChecker();
        return;
    }

    let newNewsCount = 0;
    const now = Date.now();

    for (const feedConfig of RSS_FEEDS) {
        const feedUrl = feedConfig.url;
        const lastProcessed = newsMetadata.lastCheckedNews[feedUrl] || { lastProcessedDate: 0, lastProcessedGuid: '' };
        let latestNewsDateForFeed = lastProcessed.lastProcessedDate;
        let latestNewsGuidForFeed = lastProcessed.lastProcessedGuid;
        let foundNewerThanLastProcessed = false;

        console.log(`[RSS] ${feedConfig.name} (${feedUrl}) beslemesi işleniyor. Son İşlenen Tarih: ${new Date(latestNewsDateForFeed).toLocaleString()}, GUID: ${latestNewsGuidForFeed}`);

        try {
            const feed = await parser.parseURL(feedUrl);
            const items = feed.items.slice(0, 50); // Sadece en yeni 50 haberi al

            // Haberleri en eskiden en yeniye doğru sırala
            items.sort((a, b) => {
                const dateA = a.isoDate ? new Date(a.isoDate).getTime() : 0;
                const dateB = b.isoDate ? new Date(b.isoDate).getTime() : 0;
                return dateA - dateB;
            });

            for (const item of items) {
                const newsIdentifier = item.link || item.guid;
                const newsDate = item.isoDate ? new Date(item.isoDate).getTime() : 0;

                if (!newsIdentifier) {
                    console.warn(`[RSS] Haber kimliği bulunamadı, atlandı: ${item.title || 'Başlıksız'}`);
                    continue;
                }

                // İlk çalıştırma veya kaynaktan hiç haber alınmamışsa
                if (!newsMetadata.initialScanCompleted) {
                    if (now - newsDate > INITIAL_MAX_NEWS_AGE_MS) {
                        console.log(`[HABER_ATLA] İlk tarama modunda eski haber atlandı: "${item.title}" (Yaş: ${((now - newsDate) / 1000 / 60).toFixed(2)} dakika, Limit: ${INITIAL_MAX_NEWS_AGE_MS / 1000 / 60} dakika)`);
                        continue;
                    }
                } else {
                    // Normal çalışma modunda, sadece son kontrol edilen tarihten ve GUID'den sonraki haberleri gönder
                    if (newsDate <= latestNewsDateForFeed) {
                         // Eğer tarih aynıysa, GUID kontrolü yap
                        if (newsDate === latestNewsDateForFeed && newsIdentifier === latestNewsGuidForFeed) {
                            console.log(`[HABER_ATLA] Zaten gönderilmiş veya işlenmiş haber atlandı (Tarih ve GUID aynı): "${item.title}"`);
                            continue;
                        } else if (newsDate < latestNewsDateForFeed) {
                            console.log(`[HABER_ATLA] Zaten gönderilmiş veya işlenmiş haber atlandı (Daha eski tarih): "${item.title}"`);
                            continue;
                        }
                    }
                }

                // Bu haberi gönderilecek olarak işaretle
                foundNewerThanLastProcessed = true;

                let newsTitle = item.title || 'Başlıksız Haber';
                let newsDescription = item.contentSnippet || item.summary || 'Açıklama mevcut değil.';

                console.log(`[HABER_İŞLENİYOR] Yeni haber bulundu: "${newsTitle.substring(0, Math.min(newsTitle.length, 70))}..."`);

                if (feedConfig.language === 'en' && GEMINI_API_KEY) {
                    console.log(`[ÇEVİRİ] Çevriliyor (Başlık): "${newsTitle.substring(0, Math.min(newsTitle.length, 50))}..."`);
                    newsTitle = await translateText(newsTitle);

                    console.log(`[ÇEVİRİ] Çevriliyor (Açıklama): "${newsDescription.substring(0, Math.min(newsDescription.length, 50))}..."`);
                    newsDescription = await translateText(newsDescription);
                }

                let finalImageUrl = item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image') ? item.enclosure.url :
                                    item.media && item.media.content && item.media.content['$'] && item.media.content['$'].url ? item.media.content['$'].url :
                                    item.itunes && item.itunes.image ? item.itunes.image : null;

                if (!finalImageUrl && item.link) {
                    console.log(`[GÖRSEL ÇEKME] RSS'ten görsel gelmedi, sayfadan çekilmeye çalışılıyor: ${item.link}`);
                    finalImageUrl = await fetchImageFromPage(item.link);
                    if (finalImageUrl) {
                        console.log(`[GÖRSEL ÇEKME] Sayfadan görsel başarıyla çekildi: ${finalImageUrl.substring(0, Math.min(finalImageUrl.length, 50))}...`);
                    } else {
                        console.warn(`[GÖRSEL ÇEKME] Sayfadan görsel çekilemedi: ${item.link}`);
                    }
                }

                const newsEmbed = new EmbedBuilder()
                    .setColor('#FF5733')
                    .setTitle(newsTitle.length > 256 ? newsTitle.substring(0, 253) + '...' : newsTitle)
                    .setURL(item.link || item.guid)
                    .setDescription(newsDescription.length > 2048 ? newsDescription.substring(0, 2045) + '...' : newsDescription)
                    .setTimestamp(item.isoDate ? new Date(item.isoDate) : new Date())
                    .setFooter({ text: `${item.sourceName || feedConfig.name} Kaynağı`, iconURL: client.user.displayAvatarURL() });

                if (finalImageUrl) {
                    newsEmbed.setImage(finalImageUrl);
                }

                const messageOptions = { embeds: [newsEmbed] };
                if (ANIME_NEWS_ROLE_ID && ANIME_NEWS_ROLE_ID !== 'ROL_ID_BURAYA_GIRIN') {
                    messageOptions.content = `<@&${ANIME_NEWS_ROLE_ID}> Yeni Anime Haberi!`;
                }
                
                await newsChannel.send(messageOptions).catch(err => console.error(`[DİSCORD_GÖNDERİM_HATASI] Haber embed'i gönderilemedi (${newsIdentifier}):`, err));
                
                // En son işlenen haberin tarihini ve GUID'yi güncelle
                // Bu noktada kaydedilen tarih ve GUID, o an RSS'ten okuduğumuz en yeni haberin bilgileri olacak.
                if (newsDate > latestNewsDateForFeed) {
                    latestNewsDateForFeed = newsDate;
                    latestNewsGuidForFeed = newsIdentifier;
                    console.log(`[PROGRESS] ${feedConfig.name} için son işlenen tarih/GUID güncellendi: ${new Date(latestNewsDateForFeed).toLocaleString()} / ${latestNewsGuidForFeed}`);
                }
                
                newNewsCount++;
                await new Promise(resolve => setTimeout(resolve, 10000)); // Her 10 saniyede bir haber gönder
            }

            // Kaynak için en son işlenen tarihi ve GUID'yi kaydet
            // Döngü bittiğinde en yeni olanı kaydeder.
            if (foundNewerThanLastProcessed || newsMetadata.initialScanCompleted === false) { // İlk tarama yapılıyorsa veya yeni haber bulunduysa kaydet
                newsMetadata.lastCheckedNews[feedUrl] = {
                    lastProcessedDate: latestNewsDateForFeed,
                    lastProcessedGuid: latestNewsGuidForFeed
                };
                console.log(`[RSS_SON] ${feedConfig.name} için final lastCheckedNews kaydedildi: ${new Date(newsMetadata.lastCheckedNews[feedUrl].lastProcessedDate).toLocaleString()} / ${newsMetadata.lastCheckedNews[feedUrl].lastProcessedGuid}`);
            }


        } catch (error) {
            console.error(`[RSS_OKUMA_HATASI] RSS beslemesi okunurken veya işlenirken hata oluştu (${feedConfig.name}):`, error);
        }
    }

    // İlk tarama tamamlandı bayrağını ayarla
    if (!newsMetadata.initialScanCompleted) {
        newsMetadata.initialScanCompleted = true;
        console.log('[HABER] İlk haber taraması tamamlandı. Artık sadece yeni haberler kontrol edilecek.');
    }

    saveNewsMetadata(); // Meta verileri kaydet

    console.log(`[HABER] Anime haberleri kontrolü tamamlandı. Yeni gönderilen haber sayısı: ${newNewsCount}`);

    settings.haberSistemi.lastCheck = Date.now();

    try {
        const nextExecutionDate = cron.parseExpression(CRON_SCHEDULE).next();
        settings.haberSistemi.nextCheck = nextExecutionDate.getTime();
    } catch (e) {
        console.error('[CRON_HATA] CRON zamanlaması hesaplanırken hata:', e);
        settings.haberSistemi.nextCheck = null;
    }

    saveSystemSettings(settings);
}

function startNewsChecker(client) {
    if (currentNewsJob) {
        console.log('[SERVİS] Haber kontrolcüsü zaten çalışıyor.');
        return;
    }
    console.log(`[SERVİS] Haber kontrolcüsü ${CRON_SCHEDULE} zamanlamasıyla başlatılıyor.`);

    checkAndSendNews(client).then(() => {
        currentNewsJob = cron.schedule(CRON_SCHEDULE, () => {
            let settingsOnSchedule = getSystemSettings();
            if (settingsOnSchedule.haberSistemi.active) {
                checkAndSendNews(client);
            } else {
                console.log('[SERVİS] Zamanlanmış kontrol tetiklendi ama haber sistemi pasif, durduruluyor.');
                stopNewsChecker();
            }
        });
    }).catch(err => {
        console.error('[SERVİS_KRİTİK_HATA] İlk haber kontrolü sırasında hata oluştu, zamanlayıcı başlatılamadı:', err);
    });
}

function stopNewsChecker() {
    if (currentNewsJob) {
        currentNewsJob.stop();
        currentNewsJob = null;
        console.log('[SERVİS] Haber kontrolcüsü durduruldu.');
        let settings = getSystemSettings();
        settings.haberSistemi.nextCheck = null;
        saveSystemSettings(settings);
    } else {
        console.log('[SERVİS] Haber kontrolcüsü zaten durdurulmuş.');
    }
}

function getCurrentNewsJob() {
    return currentNewsJob;
}

module.exports = {
    startNewsChecker,
    stopNewsChecker,
    getCurrentNewsJob,
    RSS_FEEDS
};