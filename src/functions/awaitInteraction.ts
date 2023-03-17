import { AnyInteractionGateway } from 'oceanic.js';
import { InteractionCollector, InteractionCollectorOptions } from '../classes/InteractionCollector';
import { Collection } from '@discordjs/collection';

export async function awaitInteraction<T extends AnyInteractionGateway = AnyInteractionGateway>(options: InteractionCollectorOptions & { max?: 1; }): Promise<undefined|T>;
export async function awaitInteraction<T extends AnyInteractionGateway = AnyInteractionGateway>(options: InteractionCollectorOptions & { max?: number; }): Promise<Collection<string, T>>;
export async function awaitInteraction<T extends AnyInteractionGateway = AnyInteractionGateway>(options: InteractionCollectorOptions): Promise<undefined|T|Collection<string, T>> {
    return new Promise((res, rej) => {
        const collector = new InteractionCollector(options);

        collector.once('end', () => {
            res(options.max === 1 && collector.collection.size === 1 ? collector.collection.first() as T|undefined : collector.collection as Collection<string, T>);
        });
    });
}