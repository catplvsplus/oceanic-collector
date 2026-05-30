import { ChannelTypes, GuildChannel, type AnyGuildChannelWithoutThreads, type AnyTextableChannel, type DeletedPrivateChannel, type Guild, type Message, type PossiblyUncachedMessage, type PossiblyUncachedThread, type PrivateChannel, type Uncached } from 'oceanic.js';
import { Collector, type CollectorOptions } from './Collector.js';

export interface MessageCollectorOptions extends CollectorOptions<Message> {
    channel?: AnyTextableChannel;
    guild?: Guild|Uncached;
}

export class MessageCollector extends Collector<Message> {
    public readonly channel: AnyTextableChannel|null = null;
    public readonly guild: Guild|Uncached|null = null;

    constructor(public readonly options: MessageCollectorOptions) {
        super(options);

        this._onMessageBulkDelete = this._onMessageBulkDelete.bind(this);
        this._onChannelDelete = this._onChannelDelete.bind(this);
        this._onThreadDelete = this._onThreadDelete.bind(this);
        this._onGuildDelete = this._onGuildDelete.bind(this);

        this.channel = options.channel ?? null;
        this.guild = options.guild
            ? options.guild
            : this.channel instanceof GuildChannel
                ? this.channel.guild
                : null;

        this.client.setMaxListeners(this.client.getMaxListeners() + 1);

        if (this.channel) {
            this.client.on('channelDelete', this._onChannelDelete);
            this.client.on('threadDelete', this._onThreadDelete);
        }

        if (this.guild) {
            this.client.on('guildDelete', this._onGuildDelete);
        }

        this.client.on('messageCreate', this.onCollect);
        this.client.on('messageDelete', this.onDispose);
        this.client.on('messageDeleteBulk', this._onMessageBulkDelete);

        this.once('end', () => {
            this.client.off('channelDelete', this._onChannelDelete);
            this.client.off('threadDelete', this._onThreadDelete);
            this.client.off('guildDelete', this._onGuildDelete);
            this.client.off('messageCreate', this.onCollect);
            this.client.off('messageDelete', this.onDispose);
            this.client.off('messageDeleteBulk', this._onMessageBulkDelete);
            this.client.setMaxListeners(this.client.getMaxListeners() - 1);
        });
    }

    protected async _collect(message: Message): Promise<[string, Message] | null> {
        if (this.channel && this.channel.id !== message.channelID) {
            return null;
        }

        if (this.guild && this.guild.id !== message.guildID) {
            return null;
        }

        return [message.id, message];
    }

    protected async _dispose(raw: PossiblyUncachedMessage): Promise<[string, Message] | null> {
        const message = this.collected.get(raw.id);
        if (!message) return null;

        return [message.id, message];
    }

    protected async _onMessageBulkDelete(messages: PossiblyUncachedMessage[]): Promise<void> {
        for (const message of messages) {
            await this.onDispose(message);
        }
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
}