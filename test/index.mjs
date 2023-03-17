import { Client } from 'oceanic.js';
import 'dotenv/config';
import { messageCollector } from './message.mjs';
import { reactionCollector } from './reaction.mjs';
import { interactionCollector } from './interaction.mjs';

const client = new Client({
    auth: `Bot ${process.env.TOKEN}`,
    gateway: {
        intents: ['ALL']
    },
});

messageCollector(client);
reactionCollector(client);
interactionCollector(client);

await client.connect();