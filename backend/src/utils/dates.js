export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (days) => new Date(Date.now() + days * 86400000);
