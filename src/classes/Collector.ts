import { Client, Collection, TypedEmitter } from 'oceanic.js';

export interface CollectorOptions<Collected> {
    max?: number;
    maxProcessed?: number;
    filter?: (collected: Collected) => boolean|Promise<boolean>;
    time?: number;
    idle?: number;
    /**
     * @default true
     */
    dispose?: boolean;
    client: Client;
}

export interface CollectorEvents<Collected> {
    collect: [collected: Collected];
    dispose: [disposed: Collected];
    ignore: [ignored: Collected];
    end: [collection: Collection<string, Collected>, reason: string|null];
}

export abstract class Collector<Collected> extends TypedEmitter<CollectorEvents<Collected>> {
    private _timeout: NodeJS.Timeout|null = null;
    private _idleTimeout: NodeJS.Timeout|null = null;
    private _endReason: string|null = null;

    readonly collection: Collection<string, Collected> = new Collection();

    public ended: boolean = false;
    public received: number = 0;
    public lastCollectedTimestamp: number|null = null;

    get max() { return this.options.max; }
    get maxProcessed() { return this.options.maxProcessed; }
    get filter() { return this.options.filter ?? (() => true); }
    get time() { return this.options.time; }
    get idle() { return this.options.idle; }
    get dispose() { return this.options.dispose; }
    get client() { return this.options.client; }
    get lastCollectedAt() { return this.lastCollectedTimestamp ? new Date(this.lastCollectedTimestamp) : null; }

    get endReason() {
        if (this.max && this.collection.size >= this.max) return 'limit';
        if (this.maxProcessed && this.received >= this.maxProcessed) return 'processedLimit';

        return this._endReason;
    }

    get next() {
        return new Promise((res, rej) => {
            if (this.ended) {
                rej(this.collection);
                return;
            }

            const cleanup = () => {
                this.removeListener('collect', onCollect);
                this.removeListener('end', onEnd);
            };

            const onCollect = (collected: Collected) => {
                cleanup();
                res(collected);
            }

            const onEnd = () => {
                cleanup();
                rej(this.collection);
            }

            this.once('collect', onCollect);
            this.once('end', onEnd);
        });
    }

    constructor(readonly options: CollectorOptions<Collected>) {
        super();

        this.handleCollect = this.handleCollect.bind(this);
        this.handleDispose = this.handleDispose.bind(this);

        if (this.time) this._timeout = setTimeout(() => this.stop('time'), this.time).unref();
        if (this.idle) this._idleTimeout = setTimeout(() => this.stop('idle'), this.idle).unref();
    }

    public async handleCollect(collected: any): Promise<void> {
        const collectedId = await this._collect(collected);
        if (!collectedId) return;

        if (!await this.filter(collected)) {
            this.emit('ignore', collected);
            return;
        }

        this.collection.set(collectedId, collected);
        this.received++;

        this.emit('collect', collected);
        this.lastCollectedTimestamp = Date.now();

        if (this._idleTimeout) this.resetIdle();
        this.checkEnd();
    }

    public async handleDispose(disposed: any): Promise<void> {
        if (this.dispose !== false) return;

        const disposedId = await this._dispose(disposed);
        if (!disposedId || !this.collection.has(disposedId)) return;

        this.collection.delete(disposedId);
        this.emit('dispose', disposed);
        this.checkEnd();
    }

    public stop(reason?: string|null): void {
        if (this.ended) return;

        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }

        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout);
            this._idleTimeout = null;
        }

        this._endReason = reason ?? null;
        this.ended = true;

        this.emit('end', this.collection, this.endReason);
    }

    public checkEnd(): boolean {
        if (!this.endReason && !this.ended) return false;
        this.stop(this.endReason);

        return true;
    }

    public resetTimer(options: Pick<CollectorOptions<Collected>, 'time' | 'idle'>): void {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = setTimeout(() => this.stop('time'), options.time ?? this.time).unref();
        }

        if (this._idleTimeout) this.resetIdle(options.idle);
    }

    public resetIdle(idle?: number): void {
        if (!this._idleTimeout) return;

        clearTimeout(this._idleTimeout);
        this._idleTimeout = setTimeout(() => this.stop('idle'), idle ?? this.idle).unref();
    }

    public toArray(): Collected[] {
        return this.collection.toArray();
    }

    protected abstract _collect(collected: Collected): Promise<string|null>;
    protected abstract _dispose(collected: Collected): Promise<string|null>;
}