import { ReactionCollector, ReactionCollectorOptions, CollectedMessageReaction } from '../classes/ReactionCollector';
import { Collection } from '@discordjs/collection';

export async function awaitReaction(options: ReactionCollectorOptions & { max?: 1; }): Promise<undefined|CollectedMessageReaction>;
export async function awaitReaction(options: ReactionCollectorOptions & { max?: number; }): Promise<Collection<string, CollectedMessageReaction>>;
export async function awaitReaction(options: ReactionCollectorOptions): Promise<undefined|CollectedMessageReaction|Collection<string, CollectedMessageReaction>> {
    return new Promise((res, rej) => {
        if (options.max === undefined) options.max = 1;

        const collector = new ReactionCollector(options);

        collector.once('end', () => {
            res(options.max === 1 && collector.collection.size === 1 ? collector.collection.first() : collector.collection);
        });
    });
}