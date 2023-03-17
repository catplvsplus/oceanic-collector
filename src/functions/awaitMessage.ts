import { Message } from 'oceanic.js';
import { MessageCollector, MessageCollectorOptions } from '../classes/MessageCollector';
import { Collection } from '@discordjs/collection';

export async function awaitMessage(options: MessageCollectorOptions & { max?: 1; }): Promise<undefined|Message>;
export async function awaitMessage(options: MessageCollectorOptions & { max?: number; }): Promise<Collection<string, Message>>;
export async function awaitMessage(options: MessageCollectorOptions): Promise<undefined|Message|Collection<string, Message>> {
    return new Promise((res, rej) => {
        const collector = new MessageCollector(options);

        collector.once('end', () => {
            res(options.max === 1 && collector.collection.size === 1 ? collector.collection.first() : collector.collection);
        });
    });
}