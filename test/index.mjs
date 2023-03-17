import { Client } from 'oceanic.js';
import 'dotenv/config';
import { messageCollector } from './message.mjs';
import { reactionCollector } from './reaction.mjs';

// @ts-check

const client = new Client({
    auth: `Bot ${process.env.TOKEN}`,
    gateway: {
        intents: ['ALL']
    },
});

messageCollector(client);
reactionCollector(client);

await client.connect();