import { Client, Collection, TypedEmitter } from 'oceanic.js';

export interface CollectorOptions<Collected> {
    max?: number;
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

    readonly collection: Collection<string, Collected> = new Collection();

    public ended: boolean = false;
    public endReason: string|null = null;
    public lastCollectedTimestamp: number|null = null;

    get max() { return this.options.max; }
    get filter() { return this.options.filter ?? (() => true); }
    get time() { return this.options.time; }
    get idle() { return this.options.idle; }
    get dispose() { return this.options.dispose; }
    get client() { return this.options.client; }
    get lastCollectedAt() { return this.lastCollectedTimestamp ? new Date(this.lastCollectedTimestamp) : null; }

    constructor(readonly options: CollectorOptions<Collected>) {
        super();

        this.handleCollect = this.handleCollect.bind(this);
        this.handleDispose = this.handleDispose.bind(this);

        if (this.time) this._timeout = setTimeout(() => this.stop('time'), this.time).unref();
        if (this.idle) this._idleTimeout = setTimeout(() => this.stop('idle'), this.idle).unref();
    }

    public async handleCollect(collected: Collected): Promise<void> {
        const collectedId = await this._collect(collected);
        if (!collectedId) return;

        if (!await this.filter(collected)) {
            this.emit('ignore', collected);
            return;
        }

        this.collection.set(collectedId, collected);

        this.emit('collect', collected);
        this.lastCollectedTimestamp = Date.now();

        if (this._idleTimeout) this.resetIdle();
        this.checkEnd();
    }

    public async handleDispose(disposed: Collected): Promise<void> {
        if (this.dispose !== false) return;

        const disposedId = await this._dispose(disposed);
        if (!disposedId || !(await this.filter(disposed)) || !this.collection.has(disposedId)) return;

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

        this.endReason = reason ?? null;
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

    protected abstract _collect(collected: Collected): Promise<string|null>;
    protected abstract _dispose(collected: Collected): Promise<string|null>;
}