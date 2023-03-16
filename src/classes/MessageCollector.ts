import { AnyGuildChannelWithoutThreads, AnyTextChannel, ChannelTypes, DeletedPrivateChannel, Guild, Message, PossiblyUncachedMessage, PossiblyUncachedThread, PrivateChannel, TextableChannel, Uncached } from 'oceanic.js';
import { Collector, CollectorOptions } from './Collector';
import { decrementMaxEventListeners, incrementMaxEventListeners } from '../utils/adjustMaxEventListeners';

export interface MessageCollectorOptions extends CollectorOptions<Message> {
    channel: AnyTextChannel;
}

export class MessageCollector extends Collector<Message> {
    readonly channel: AnyTextChannel;

    constructor(options: MessageCollectorOptions) {
        super(options);

        this.channel = options.channel;

        this._handleMessageDeleteBulk = this._handleMessageDeleteBulk.bind(this);
        this._handleChannelDelete = this._handleChannelDelete.bind(this);
        this._handleThreadDelete = this._handleThreadDelete.bind(this);
        this._handleGuildDelete = this._handleGuildDelete.bind(this);

        this.client.on('messageCreate', this.handleCollect);
        this.client.on('messageDelete', this.handleDispose);
        this.client.on('messageDeleteBulk', this._handleMessageDeleteBulk);
        this.client.on('channelDelete', this._handleChannelDelete);
        this.client.on('threadDelete', this._handleThreadDelete);
        this.client.on('guildDelete', this._handleGuildDelete);

        incrementMaxEventListeners(this.client);

        this.once('end', () => {
            this.client.removeListener('messageCreate', this.handleCollect);
            this.client.removeListener('messageDelete', this.handleDispose);
            this.client.removeListener('messageDeleteBulk', this._handleMessageDeleteBulk);
            this.client.removeListener('channelDelete', this._handleChannelDelete);
            this.client.removeListener('threadDelete', this._handleThreadDelete);
            this.client.removeListener('guildDelete', this._handleGuildDelete);

            decrementMaxEventListeners(this.client);
        });
    }

    protected async _handleMessageDeleteBulk(messages: PossiblyUncachedMessage[]): Promise<void> {
        for (const message of messages) {
            this.handleDispose(message);
        }
    }

    protected async _handleChannelDelete(channel: AnyGuildChannelWithoutThreads|PrivateChannel|DeletedPrivateChannel): Promise<void> {
        if (channel.id === this.channel.id) this.stop('channelDelete');
    }

    protected async _handleThreadDelete(thread: PossiblyUncachedThread): Promise<void> {
        if (thread.id === this.channel.id) this.stop('threadDelete');
    }

    protected async _handleGuildDelete(guild: Uncached|Guild): Promise<void> {
        if (!(this.channel.type === ChannelTypes.DM || this.channel.type === ChannelTypes.GROUP_DM) && guild.id === this.channel.guildID) this.stop('guildDelete');
    }

    protected async _collect(collected: Message): Promise<string | null> {
        return collected.channelID === this.channel.id ? collected.id : null;
    }

    protected async _dispose(collected: PossiblyUncachedMessage): Promise<string | null> {
        return collected.channelID === this.channel.id ? collected.id : null;
    }
}