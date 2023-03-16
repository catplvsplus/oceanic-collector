import { Client } from 'oceanic.js';
import 'dotenv/config';
import { messageCollector } from './message.mjs';

// @ts-check

const client = new Client({
    auth: `Bot ${process.env.TOKEN}`,
    gateway: {
        intents: ['ALL']
    }
});

messageCollector(client);

await client.connect();