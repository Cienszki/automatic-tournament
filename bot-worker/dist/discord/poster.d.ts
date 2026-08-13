import { type Client } from 'discord.js';
import type { Firestore } from 'firebase-admin/firestore';
import type { GatewayConfig } from './config';
export declare function ensurePoster(db: Firestore, client: Client, config: GatewayConfig): Promise<void>;
