import { Collection, type ReadonlyCollection } from '@discordjs/collection';
import { AsyncEventEmitter } from '@vladfrangu/async_event_emitter';
import type { Client } from 'oceanic.js';

export interface CollectorOptions<T> {
    /**
     * The maximum number of items to collect before ending the collector. If not provided, there is no limit.
     */
    max?: number;
    /**
     * A function that filters collected items. If the function returns false, the item will not be collected.
     * @param value The value to be filtered.
     * @returns A boolean or a Promise that resolves to a boolean indicating whether the item should be collected.
     */
    filter?: (value: T) => Promise<boolean>|boolean;
    /**
     * The time in milliseconds to wait before ending the collector. If not provided, there is no time limit.
     */
    time?: number;
    /**
     * The time in milliseconds to wait before ending the collector due to inactivity. If not provided, there is no idle time limit.
     */
    idle?: number;
    /**
     * Whether to dispose of collected items when deleted.
     * @default false
     */
    dispose?: boolean;
    /**
     * The client instance that the collector is associated with.
     */
    client: Client;
}

export interface CollectorEvents<T> extends Record<string, unknown[]> {
    collect: [value: T];
    dispose: [value: T];
    ignore: [value: T];
    end: [collected: ReadonlyCollection<string, T>, reason: string];
};

export abstract class Collector<T, E extends CollectorEvents<T> = CollectorEvents<T>> extends AsyncEventEmitter<E> {
    protected _collected: Collection<string, T> = new Collection();

    protected _timeout: NodeJS.Timeout|null = null;
    protected _idleTimeout: NodeJS.Timeout|null = null;
    protected _endReason: string|null = null;

    public ended: boolean = false;
    public received: number = 0;
    public lastCollectedTimestamp: number|null = null;

    get collected(): ReadonlyCollection<string, T> {
        return this._collected;
    }

    get endReason(): string|null {
        return this._endReason;
    }

    get lastCollectedAt(): Date|null {
        return this.lastCollectedTimestamp ? new Date(this.lastCollectedTimestamp) : null;
    }

    get next() {
        return new Promise((res, rej) => {
            if (this.isEnded()) {
                rej(new Error('Collector has already ended'));
                return;
            }

            const clean = () => {
                this._off('collect', onCollect);
                this._off('end', onEnd);
            }

            const onCollect = (value: T) => {
                clean();
                res(value);
            }

            const onEnd = (collected: ReadonlyCollection<string, T>, reason: string) => {
                clean();
                rej(new Error(`Collector ended with reason: ${reason}`));
            }

            this._once('collect', onCollect);
            this._once('end', onEnd);
        });
    }

    public readonly client!: Client;

    constructor(public readonly options: CollectorOptions<T>) {
        super();

        this._off = this._off.bind(this);
        this._on = this._on.bind(this);
        this._once = this._once.bind(this);
        this._emit = this._emit.bind(this);
        this.onCollect = this.onCollect.bind(this);
        this.onDispose = this.onDispose.bind(this);

        Object.defineProperty(this, 'client', { value: options.client });

        this.resetTimeout();
        this.resetIdle();
    }

    public async onCollect(...args: unknown[]): Promise<boolean> {
        const result = await this._collect(...args);
        if (!result) return false;

        const [id, value] = result;

        if (
            this.options.filter &&
            !(await Promise.resolve(this.options.filter(value)))
        ) {
            this._emit('ignore', value);
            return false;
        }

        this.received++;
        this._collected.set(id, value);

        this._emit('collect', value);
        this.lastCollectedTimestamp = Date.now();

        this.resetIdle();
        this.isEnded();
        return true;
    }

    public async onDispose(...args: unknown[]): Promise<boolean> {
        if (!this.options.dispose) return false;

        const result = await this._dispose(...args);
        if (!result) return false;

        const [id, value] = result;

        if (
            (this.options.filter &&
            !(await Promise.resolve(this.options.filter(value)))) ||
            !this._collected.has(id)
        ) {
            return false;
        }

        this._collected.delete(id);
        this._emit('dispose', value);
        this.isEnded();
        return true;
    }

    public stop(reason?: string): void {
        if (this.ended) return;

        this.resetTimeout(null);
        this.resetIdle(null);

        this._endReason = reason ?? 'user';
        this.ended = true;

        this._emit('end', this.collected, this._endReason);
    }

    public isEnded(): boolean {
        if (this.options.max && this.collected.size >= this.options.max) {
            this.stop('limit');
            return this.ended;
        }

        return this.ended;
    }

    public resetTimeout(time?: number|null): void {
        time = time !== null
            ?  time ?? this.options.time
            : null;

        if (this._timeout) {
            clearTimeout(this._timeout);
        }

        this._timeout = time && Number.isFinite(time)
            ? setTimeout(() => this.stop('time'), time).unref()
            : null;
    }

    public resetIdle(idle?: number|null): void {
        idle = idle !== null
            ?  idle ?? this.options.idle
            : null;

        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout);
        }

        this._idleTimeout = idle && Number.isFinite(idle)
            ? setTimeout(() => this.stop('idle'), idle).unref()
            : null;
    }

    public async *[Symbol.asyncIterator]() {
        const queue: T[] = [];
        const onCollect = (item: T) => queue.push(item);

        this._on('collect', onCollect);

        try {
            while (queue.length || !this.ended) {
                if (queue.length) {
                    yield queue.shift();
                } else {
                    await new Promise(resolve => {
                        const tick = () => {
                            this._off('collect', tick);
                            this._off('end', tick);
                            resolve(void 0);
                        };

                        this._on('collect', tick);
                        this._on('end', tick);
                    });
                }
            }
        } finally {
            this._off('collect', onCollect);
        }
    }

    protected abstract _collect(...args: unknown[]): Promise<[string, T]|null>;
    protected abstract _dispose(...args: unknown[]): Promise<[string, T]|null>;

    //#region Event Emitter Wrappers - These are for type safety

    protected _off<Event extends keyof E>(event: Event, listener: (...args: E[Event]) => void) {
        // @ts-expect-error - This is a protected method, so we know the types are correct
        this.off(event, listener);
    }

    protected _on<Event extends keyof E>(event: Event, listener: (...args: E[Event]) => void) {
        // @ts-expect-error - This is a protected method, so we know the types are correct
        this.on(event, listener);
    }

    protected _once<Event extends keyof E>(event: Event, listener: (...args: E[Event]) => void) {
        // @ts-expect-error - This is a protected method, so we know the types are correct
        this.once(event, listener);
    }

    protected _emit<Event extends keyof E>(event: Event, ...args: E[Event]) {
        // @ts-expect-error - This is a protected method, so we know the types are correct
        this.emit(event, ...args);
    }

    //#endregion
}