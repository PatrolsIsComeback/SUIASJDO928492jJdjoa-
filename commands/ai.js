// commands/ai.js

const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { PREFIX } = require('../utils/config'); // PREFIX'in doğru şekilde import edildiğinden emin olun

// --- AYARLANABİLİR BÖLÜM BAŞLANGICI ---

const AI_CHANNEL_ID = ["1397298035964383373", "1397996638093709442"]; // YAPAY ZEKAYI KULLANMAK İSTEDİĞİN KANAL ID'LERİNİ BURAYA EKLE!
const GEMINI_API_KEY = 'AIzaSyB0wxgzdZntAXdbgpqApEl0rc3ZdPr72yA'; // SENİN GEMINI API ANAHTARIN

const MAX_CHAT_HISTORY_MESSAGES = 6;

const SYSTEM_INSTRUCTION = `Sen Discord sunucusunda bir yapay zeka asistanısın. Seni kim yapti gibi sorulara ise : Yapimcim : S4Patrol.devv diye cevap vereceksin üstüne eklemeler yapabilirsin tabii sunucuda en sevdigin kisi ise S4Patrol.devv. Kullanıcıların sorularına yardımcı ol, bilgi ver ve gerektiğinde sohbet et. Türkçe ve akıcı bir dil kullan. Kullanıcı sana bir şey soruyorsa, doğrudan soruyu yanıtla. Örneğin, "İstiklal Marşı nedir?" diye sorulduğunda doğrudan marş hakkında bilgi ver, Google'a yönlendirme yapma. Bilgiye dayalı, yardımsever ve sohbet edebilir bir tonda ol. Kullanıcıların komutlarını veya prefixleri kullanma beklentisi içinde olmadığını unutma, sadece doğal dil ile iletişim kur. Cevaplarını açık, net ve anlaşılır tut.`;

// --- AYARLANABİLİR BÖLÜM BİTİŞİ ---

if (!global.userChatHistory) {
    global.userChatHistory = new Map();
}

module.exports = {
    prefix: {
        name: 'ai',
        aliases: ['yapayzeka'],
        description: 'Yapay zeka ile sohbet etmenizi sağlar.',
        usage: `${PREFIX}ai [mesajınız] veya ${PREFIX}yapayzeka [mesajınız]`,
        
        async execute(message, args) {
            // Birden fazla kanalda çalışmasını sağla
            // message.channel.id'nin AI_CHANNEL_ID dizisinde olup olmadığını kontrol et
            if (!AI_CHANNEL_ID.includes(message.channel.id)) {
                // Eğer farklı bir kanalda kullanılırsa, sessizce çık.
                return;
            }

            const userMessage = args.join(' ').trim();
            const userId = message.author.id;

            if (!userMessage) {
                const embed = new EmbedBuilder()
                    .setColor('#FFD700') // Altın sarısı
                    .setTitle('Yapay Zeka Asistanı')
                    .setDescription(`Merhaba! Ben bir yapay zeka asistanıyım. Nasıl yardımcı olabilirim? \n\nÖrnek: \`${PREFIX}ai merhaba\` veya \`${PREFIX}yapayzeka Türkiye'nin başkenti neresidir?\``)
                    .setTimestamp()
                    .setFooter({ text: 'SomeSub Bot', iconURL: message.client.user.displayAvatarURL() });
                
                return await message.reply({ embeds: [embed] }).catch(err => console.error("Yardım embed'i gönderilemedi:", err));
            }

            const thinkingEmbed = new EmbedBuilder()
                .setColor('#ADD8E6') // Açık mavi
                .setDescription('Yapay zeka düşünüyorum... Lütfen bekleyin.')
                .setTimestamp()
                .setFooter({ text: 'SomeSub Bot', iconURL: message.client.user.displayAvatarURL() });

            let replyMessage;
            try {
                replyMessage = await message.reply({ embeds: [thinkingEmbed], fetchReply: true });
            } catch (err) {
                console.error("Düşünüyor embed'i gönderilemedi:", err);
                return;
            }

            try {
                let currentUserHistory = global.userChatHistory.get(userId) || [];

                // Sistem talimatını sadece başlangıçta veya her yeni sohbette ekle
                // Bunu, sohbet geçmişini sıfırladığımızda veya ilk mesajda ekleyebiliriz.
                // Mevcut yapıda, her çağrıda sistem talimatı ve "Anladım, dinliyorum." modeli ekleniyor.
                // Bu, bağlam penceresini daha çabuk doldurabilir.
                // Daha verimli bir yaklaşım için, SYSTEM_INSTRUCTION'ı ayrı bir 'system' rolü olarak yönetmek daha iyidir.
                // Ancak Gemini API'sının 'contents' formatında direkt 'system' rolü yoktur, 'user' veya 'model' kullanılır.
                // Bu yüzden, ilk mesajlarda veya sohbet geçmişi sıfırlandığında 'user' rolüyle SYSTEM_INSTRUCTION eklemek en uygunu.

                const contents = [];

                // Sohbet geçmişi boşsa veya çok uzunsa sıfırlama mantığı eklenebilir.
                // Basitçe: Eğer geçmiş boşsa, sistem talimatı ile başla.
                if (currentUserHistory.length === 0) {
                    contents.push(
                        { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION }] },
                        { role: 'model', parts: [{ text: 'Anladım, dinliyorum.' }] } // Modelin ilk tepkisi
                    );
                }
                
                // Mevcut sohbet geçmişini ekle
                contents.push(...currentUserHistory);

                // Kullanıcının mevcut mesajını ekle
                contents.push({ role: 'user', parts: [{ text: userMessage }] });

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: contents,
                    })
                });

                const data = await response.json();

                let aiResponse;
                let isError = false;

                if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                    aiResponse = data.candidates[0].content.parts[0].text;
                    
                    if (aiResponse.length > 2000) {
                        aiResponse = aiResponse.substring(0, 1997) + '...';
                    }

                    // Sohbet geçmişine ekle
                    currentUserHistory.push({
                        role: 'user',
                        parts: [{ text: userMessage }]
                    });
                    currentUserHistory.push({
                        role: 'model',
                        parts: [{ text: aiResponse }]
                    });

                    // Sohbet geçmişini MAX_CHAT_HISTORY_MESSAGES limitinde tut
                    // Her kullanıcı mesajı ve her bot yanıtı ayrı bir 'part' olarak sayıldığı için
                    // toplam parts sayısı 2 * MAX_CHAT_HISTORY_MESSAGES'ı geçmemeli.
                    // Bu durumda MAX_CHAT_HISTORY_MESSAGES zaten toplam part sayısı gibi davranıyor.
                    // Yani her user-model çifti 2 part eder.
                    // Eğer MAX_CHAT_HISTORY_MESSAGES 6 ise, bu 3 user-model çifti eder.
                    while (currentUserHistory.length > MAX_CHAT_HISTORY_MESSAGES) {
                        currentUserHistory.shift(); // En eski mesajı kaldır
                    }
                    global.userChatHistory.set(userId, currentUserHistory);

                } else if (data.error) {
                    aiResponse = `API Hatası: ${data.error.message || 'Bilinmeyen Hata'}`;
                    console.error('Gemini API Hatası:', data.error);
                    console.error('API Error Response (Detailed):', JSON.stringify(data.error, null, 2));
                    isError = true;
                } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                    aiResponse = `Üzgünüm, bu isteği yanıtlayamıyorum çünkü içerik politikalarımı ihlal ediyor olabilir. (Engelleme Nedeni: ${data.promptFeedback.blockReason})`;
                    console.warn('Gemini İçerik Engelleme:', data.promptFeedback.blockReason, 'İsteyen:', message.author.tag, 'Mesaj:', userMessage);
                    isError = true;
                } else {
                    aiResponse = 'Yapay zeka yanıtını işlerken beklenmeyen bir sorun oluştu. Lütfen daha sonra tekrar deneyin.';
                    console.log('Beklenmeyen API Yanıt Yapısı (Detailed):', JSON.stringify(data, null, 2));
                    isError = true;
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor(isError ? '#FF0000' : '#7289DA')
                    .setTitle(isError ? 'Hata!' : 'Yapay Zeka Cevabı')
                    .setDescription(aiResponse)
                    .setTimestamp()
                    .setFooter({ text: 'SomeSub Bot', iconURL: message.client.user.displayAvatarURL() });

                await replyMessage.edit({ embeds: [resultEmbed] }).catch(err => console.error("Yanıt embed'i düzenlenemedi:", err));

            } catch (error) {
                console.error('Yapay zeka API çağrısında genel bir hata oluştu:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Kritik Hata!')
                    .setDescription('Yapay zeka ile iletişim kurarken kritik bir sorun oluştu. Lütfen bot sahibine bildirin veya daha sonra tekrar deneyin.')
                    .setTimestamp()
                    .setFooter({ text: 'SomeSub Bot', iconURL: message.client.user.displayAvatarURL() });
                
                await replyMessage.edit({ embeds: [errorEmbed] }).catch(err => console.error("Kritik hata embed'i düzenlenemedi:", err));
            }
        },
    },
};