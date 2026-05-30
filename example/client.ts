// @ts-check
import { ButtonStyles, Client, ComponentTypes, InteractionTypes, type ComponentInteraction } from 'oceanic.js';
import { InteractionCollector, MessageCollector, ReactionCollector } from '../';
import '@dotenvx/dotenvx/config';

const client = new Client({
    auth: `Bot ${process.env.DISCORD_TOKEN}`,
    gateway: {
        intents: ['GUILDS', 'GUILD_MESSAGES', 'MESSAGE_CONTENT', 'GUILD_MESSAGE_REACTIONS']
    }
});

client.on('ready', () => {
    console.log('Bot is ready!');
});

client.on('error', (error) => {
    console.error('An error occurred:', error);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    console.log(`Received message: ${message.content}`);

    if (message.content === '!ping') {
        await message.channel?.createMessage({ content: 'Pong!' });
    }

    if (message.content === '!interaction-collect') {
        const msg = await message.channel?.createMessage({
            content: 'Click the button below to interact!',
            components: [
                {
                    type: ComponentTypes.ACTION_ROW,
                    components: [
                        {
                            type: ComponentTypes.BUTTON,
                            label: 'Click Me',
                            style: ButtonStyles.PRIMARY,
                            customID: 'click_me_button'
                        }
                    ]
                }
            ]
        });

        const collector = new InteractionCollector<ComponentInteraction>({
            message: msg,
            types: [InteractionTypes.MESSAGE_COMPONENT],
            time: 20000, // Collect interactions for 20 seconds
            max: 5,     // Collect a maximum of 5 interactions
            client
        });

        collector.on('collect', async (interaction) => {
            console.log('Collected interaction from user:', interaction.user.globalName);
            await interaction.deferUpdate();
        });

        collector.on('end', async (collected, reason) => {
            console.log(`Collector ended. Reason: ${reason}. Collected ${collected.size} interactions.`);
            await msg?.edit({ content: 'Interaction collection ended!', components: [] });
        });
    }

    if (message.content === '!reaction-collect') {
        const msg = await message.channel?.createMessage({ content: 'React to this message with 👍!' });
        const collector = new ReactionCollector({
            message: msg,
            time: 20000, // Collect reactions for 20 seconds
            max: 5,     // Collect a maximum of 5 reactions
            client
        });

        console.log(collector);

        collector.on('collect', (reaction) => {
            console.log(`Collected reaction: ${reaction.emoji.name} from user: ${reaction.lastReactorUser?.username || reaction.lastReactorUserID}`);
        });

        collector.on('end', (collected, reason) => {
            console.log(`Collector ended. Reason: ${reason}. Collected ${collected.size} reactions.`);
        });
    }

    if (message.content === '!message-collect') {
        const collector = new MessageCollector({
            time: 20000, // Collect messages for 20 seconds
            max: 5,     // Collect a maximum of 5 messages
            filter: (msg) => msg.author.id === message.author.id, // Only collect messages from the original author
            client
        });

        collector.on('collect', (collectedMessage) => {
            console.log(`Collected message: ${collectedMessage.content} from user: ${collectedMessage.author.globalName}`);
        });

        collector.on('end', (collected, reason) => {
            console.log(`Collector ended. Reason: ${reason}. Collected ${collected.size} messages.`);
        });
    }
});

client.connect();