import { PlayerRoles, TeamStatus } from './definitions';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays, format } from 'date-fns';

// --- UTILITY ---
export const generatePassword = (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

export { PlayerRoles, TeamStatus, Timestamp, addDays, format };
