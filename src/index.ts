import { Client, InteractionTypes } from 'oceanic.js';
import { InteractionCollector } from '.';

export * from './classes/Collector';
export * from './classes/InteractionCollector';
export * from './classes/MessageCollector';
export * from './classes/ReactionCollector';

new InteractionCollector({ client: {} as Client, interactionType: InteractionTypes.APPLICATION_COMMAND })