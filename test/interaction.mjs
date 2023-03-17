import { ButtonStyles, Client, ComponentTypes, InteractionTypes } from "oceanic.js";
import { InteractionCollector } from '../dist/index.mjs';

// @ts-check

/**
 * 
 * @param {Client} client 
 */
export function interactionCollector(client) {
    client.on('messageCreate', async message => {
        if (message.content !== 'ic') return;

        const reply = await message.channel.createMessage({
            messageReference: {
                failIfNotExists: true,
                channelID: message.channelID,
                guildID: message.guildID,
                messageID: message.id
            },
            content: 'Interactions',
            components: [
                {
                    type: ComponentTypes.ACTION_ROW,
                    components: [
                        {
                            type: ComponentTypes.BUTTON,
                            customID: 'test1',
                            style: ButtonStyles.SECONDARY,
                            label: 'Test 1'
                        },
                        {
                            type: ComponentTypes.BUTTON,
                            customID: 'test2',
                            style: ButtonStyles.SECONDARY,
                            label: 'Test 2'
                        }
                    ]
                }
            ]
        });

        const collector = new InteractionCollector({
            type: InteractionTypes.MESSAGE_COMPONENT,
            message: reply,
            client,
            time: 20000,
            max: 10
        });

        console.log(`Started InteractionCollector!`);

        collector.on('collect', interaction => {
            console.log(`Collected interaction: ${interaction.id}`);
            interaction.deferUpdate();
        });

        collector.on('userCreate', user => console.log(`user interact: ${user.id}`));

        collector.on('end', async (collection, reason) => {
            console.log('MessageCollector ended!');

            await reply.edit({
                content: reason || 'No reason',
                components: [],
                embeds: [
                    {
                        description: collection.toJSON().join('\n') || 'None'
                    }
                ]
            });
        });
    });
}