import { ChannelTypes, GuildChannel, Message, type AnyGuildChannelWithoutThreads, type AnyInteractionGateway, type AnyTextableChannel, type DeletedPrivateChannel, type Guild, type PossiblyUncachedMessage, type PossiblyUncachedThread, type PrivateChannel, type Uncached, type User } from 'oceanic.js';
import { Collector, type CollectorEvents, type CollectorOptions } from './Collector.js';
import { Collection } from '@discordjs/collection';

export interface InteractionCollectorOptions<T extends AnyInteractionGateway> extends CollectorOptions<T> {
    types?: T['type'][];
    message?: Message;
    channel?: AnyTextableChannel;
    guild?: Guild|Uncached;
    interactionTypes?: T['type'][];
    maxUsers?: number;
}

export interface InteractionCollectorEvents<T extends AnyInteractionGateway> extends CollectorEvents<T> {
    userCreate: [user: User, interaction: T];
    userDelete: [user: User, interaction: T];
}

export class InteractionCollector<T extends AnyInteractionGateway> extends Collector<T, InteractionCollectorEvents<T>> {
    public readonly message: Message|null = null;
    public readonly channel: AnyTextableChannel|null = null;
    public readonly guild: Guild|Uncached|null = null

    public users: Collection<string, User> = new Collection();

    constructor(public readonly options: InteractionCollectorOptions<T>) {
        super(options);

        this._onMessageDelete = this._onMessageDelete.bind(this);
        this._onMessageDeleteBulk = this._onMessageDeleteBulk.bind(this);
        this._onChannelDelete = this._onChannelDelete.bind(this);
        this._onThreadDelete = this._onThreadDelete.bind(this);
        this._onGuildDelete = this._onGuildDelete.bind(this);

        this.message = options.message ?? null;
        this.channel = options.channel
            ? options.channel
            : this.message
                ? this.message.channel ?? null
                : null;

        this.guild = options.guild
            ? options.guild
            : this.channel instanceof GuildChannel
                ? this.channel.guild
                : this.message instanceof Message
                    ? this.message.guild
                    : null;

        this.client.setMaxListeners(this.client.getMaxListeners() + 1);
        this.setMaxListeners(this.getMaxListeners() + 1);

        if (this.message) {
            this.client.on('messageDelete', this._onMessageDelete);
            this.client.on('messageDeleteBulk', this._onMessageDeleteBulk);
        }

        if (this.channel) {
            this.client.on('channelDelete', this._onChannelDelete);
            this.client.on('threadDelete', this._onThreadDelete);
        }

        if (this.guild) {
            this.client.on('guildDelete', this._onGuildDelete);
        }

        this.client.on('interactionCreate', this.onCollect);

        this.once('end', () => {
            this.client.off('messageDelete', this._onMessageDelete);
            this.client.off('messageDeleteBulk', this._onMessageDeleteBulk);
            this.client.off('channelDelete', this._onChannelDelete);
            this.client.off('threadDelete', this._onThreadDelete);
            this.client.off('guildDelete', this._onGuildDelete);
            this.client.off('interactionCreate', this.onCollect);
            this.client.setMaxListeners(this.client.getMaxListeners() - 1);
            this.setMaxListeners(this.getMaxListeners() - 1);
        });

        this.on('collect', (interaction) => {
            if (this.users.has(interaction.user.id)) return;

            this.users.set(interaction.user.id, interaction.user);
            this._emit('userCreate', interaction.user, interaction);
        });

        this.on('dispose', (interaction) => {
            if (!this.users.has(interaction.user.id)) return;

            this.users.delete(interaction.user.id);
            this._emit('userDelete', interaction.user, interaction);
        });
    }

    public isEnded(): boolean {
        if (this.options.maxUsers && this.users.size >= this.options.maxUsers) {
            this.stop('user limit');
            return this.ended;
        }

        return super.isEnded();
    }

    public async _collect(interaction: AnyInteractionGateway): Promise<[string, T]|null> {
        if (!this._isInteractionRelevant(interaction)) {
            return null;
        }

        return [interaction.id, interaction as T];
    }

    public async _dispose(raw: AnyInteractionGateway): Promise<[string, T]|null> {
        const interaction = this.collected.get(raw.id);
        if (!interaction) return null;

        return [interaction.id, interaction];
    }

    public empty(): void {
        this._collected.clear();
        this.users.clear();
        this.isEnded();
    }

    protected _onMessageDelete(message: PossiblyUncachedMessage): void {
        if (!this.message || this.message.id !== message.id) return;
        this.stop('message deleted');
    }

    protected _onMessageDeleteBulk(messages: PossiblyUncachedMessage[]): void {
        const deleted = messages.find(m => this.message && this.message.id === m.id);
        if (!deleted) return;

        this.stop('message deleted');
    }

    protected _onChannelDelete(channel: AnyGuildChannelWithoutThreads|PrivateChannel|DeletedPrivateChannel): void {
        if (!this.channel || this.channel.id !== channel.id) return;
        if (
            this.channel.type !== ChannelTypes.PUBLIC_THREAD &&
            this.channel.type !== ChannelTypes.PRIVATE_THREAD &&
            this.channel.type !== ChannelTypes.ANNOUNCEMENT_THREAD ||
            this.channel.parentID !== channel.id
        ) return;

        this.stop('channel deleted');
    }

    protected _onThreadDelete(channel: PossiblyUncachedThread): void {
        if (!this.channel || this.channel.id !== channel.id) return;
        this.stop('channel deleted');
    }

    protected _onGuildDelete(guild: Guild|Uncached): void {
        if (!this.guild || this.guild.id !== guild.id) return;
        this.stop('guild deleted');
    }

    protected _isInteractionRelevant(interaction: AnyInteractionGateway): boolean {
        if (
            this.options.types?.length &&
            !this.options.types.includes(interaction.type)
        ) {
            return false;
        }

        if (
            this.message &&
            'message' in interaction &&
            interaction.message &&
            this.message.id !== interaction.message.id
        ) {
            return false;
        }

        if (
            this.channel &&
            this.channel.id !== interaction.channelID
        ) {
            return false;
        }

        if (
            this.guild &&
            this.guild.id !== interaction.guildID
        ) {
            return false;
        }

        return true;
    }
}