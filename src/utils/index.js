export const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
};

export const generateUniqueId = () => {
    return 'id-' + Math.random().toString(36).substr(2, 16);
};

export const isEmpty = (value) => {
    return value === null || value === undefined || value === '';
};