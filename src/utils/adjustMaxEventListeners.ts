import EventEmitter from 'events';

export function incrementMaxEventListeners(emitter: EventEmitter): number {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) emitter.setMaxListeners(maxListeners + 1);

    return emitter.getMaxListeners();
}

export function decrementMaxEventListeners(emitter: EventEmitter): number {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) emitter.setMaxListeners(maxListeners - 1);

    return emitter.getMaxListeners();
}