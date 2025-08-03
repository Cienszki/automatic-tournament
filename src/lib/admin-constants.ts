import { PlayerRoles } from './definitions';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays, format } from 'date-fns';

// Define TeamStatus here instead of importing from definitions
export type TeamStatus = 'pending' | 'verified' | 'rejected' | 'warning' | 'banned';
export const generatePassword = (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

export { PlayerRoles, Timestamp, addDays, format };
