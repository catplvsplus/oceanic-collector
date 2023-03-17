import { Client } from 'oceanic.js';
import { MessageCollector } from '../dist/index.mjs';

/**
 * 
 * @param {Client} client 
 */
export function messageCollector(client) {
    client.on('messageCreate', async message => {
        if (message.content !== 'mc') return;

        const collector = new MessageCollector({
            channel: message.channel,
            client,
            time: 20000,
            max: 10
        });

        console.log(`Started MessageCollector!`);

        collector.on('collect', async (collected) => console.log(`Collected Message: ${collected.id}`));
        collector.on('disposed', async (collected) => console.log(`Disposed Message: ${collected.id}`));

        collector.on('end', async (collection, reason) => {
            console.log('MessageCollector ended!', collection);

            await client.rest.channels.createMessage(message.channelID, {
                content: reason || 'No reason',
                embeds: [
                    {
                        description: collection.toJSON().join('\n')
                    }
                ]
            });
        });
    });
}