// utils/functions.js
const { UPLOADER_ROLE_ID, TRANSLATOR_ROLE_ID } = require('./config');

module.exports = {
    hasRequiredRoles(member, roleIDs) {
        // Kontrol edilecek rol ID'leri
        const checkRoleIDs = Array.isArray(roleIDs) ? roleIDs : [roleIDs];

        // Üyenin bu rollerden herhangi birine sahip olup olmadığını kontrol et
        return checkRoleIDs.some(roleID => member.roles.cache.has(roleID));
    },
    generateAnimeID() {
        // Basit bir benzersiz ID oluşturma (şimdilik)
        return Math.random().toString(36).substring(2, 9).toUpperCase();
    }
};