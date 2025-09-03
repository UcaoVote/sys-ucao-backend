// helpers/activityHelpers.js
export const getSafeLimit = (value, fallback = 10) => {
    const parsed = parseInt(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;

    const days = Math.floor(hours / 24);
    return `Il y a ${days} j`;
};

export const getIconForAction = (type) => {
    const icons = {
        LOGIN: 'sign-in-alt',
        VOTE: 'vote-yea',
        CREATE: 'plus-circle',
        UPDATE: 'edit',
        DELETE: 'trash-alt',
        INFO: 'info-circle'
    };
    return icons[type] || 'info-circle';
};