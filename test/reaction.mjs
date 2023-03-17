import { Client } from 'oceanic.js';
import { ReactionCollector } from '../dist/index.mjs';

/**
 * 
 * @param {Client} client 
 */
export function reactionCollector(client) {
    client.on('messageCreate', async message => {
        if (message.content !== 'rc') return;

        const reply = await client.rest.channels.createMessage(message.channelID, {
            messageReference: message,
            content: 'Reaction collector'
        });

        const collector = new ReactionCollector({
            client,
            message,
            filter: m => !m.message.author.bot,
            max: 10
        });

        console.log(`Started ReactionCollector!`);

        collector.on('collect', async (collected) => console.log(`Collected Reaction: ${collected.id}`));

        collector.on('end', async (collection, reason) => {
            console.log('ReactionCollector ended!');

            await client.rest.channels.createMessage(message.channelID, {
                content: reason || 'No reason',
                embeds: [
                    {
                        description: collection.toArray().join('\n')
                    }
                ]
            });
        });
    });
}