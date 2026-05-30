import { ChannelTypes, GuildChannel, Message, type AnyGuildChannelWithoutThreads, type AnyTextableChannel, type DeletedPrivateChannel, type EventReaction, type Guild, type Member, type PossiblyUncachedMessage, type PossiblyUncachedThread, type PrivateChannel, type Uncached, type User } from 'oceanic.js';
import { Collector, type CollectorEvents, type CollectorOptions } from './Collector.js';
import { Collection } from '@discordjs/collection';

export interface MessageReaction extends EventReaction {
    id: string;
    lastReactorUserID: string;
    lastReactorUser: User|Member|null;
    messageID: string;
    message: PossiblyUncachedMessage;
    channelID: string;
    channel: Uncached|AnyTextableChannel;
    guildID: string|null;
    guild: Guild|Uncached|null;
}

export interface MessageReactor {
    id: string;
    reactions: string[];
}

export interface ReactionCollectorOptions extends CollectorOptions<MessageReaction>{
    message?: Message;
    channel?: AnyTextableChannel;
    guild?: Guild|Uncached;
    maxEmojis?: number;
    maxUsers?: number;
}

export interface ReactionCollectorEvents extends CollectorEvents<MessageReaction> {
    userCreate: [userID: string, reactions: string[]];
    userDelete: [userID: string];
}

export class ReactionCollector extends Collector<MessageReaction, ReactionCollectorEvents> {
    public readonly message: Message|null = null;
    public readonly channel: AnyTextableChannel|null = null;
    public readonly guild: Guild|Uncached|null = null;

    public users: Collection<string, MessageReactor> = new Collection();

    constructor(public readonly options: ReactionCollectorOptions) {
        super(options);

        this._onMessageDelete = this._onMessageDelete.bind(this);
        this._onMessageDeleteBulk = this._onMessageDeleteBulk.bind(this);
        this._onChannelDelete = this._onChannelDelete.bind(this);
        this._onThreadDelete = this._onThreadDelete.bind(this);
        this._onGuildDelete = this._onGuildDelete.bind(this);

        this.message = options.message ?? null;
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

        this.client.on('messageReactionAdd', this.onCollect);
        this.client.on('messageReactionRemove', this.onDispose);

        this.once('end', () => {
            this.client.off('messageDelete', this._onMessageDelete);
            this.client.off('messageDeleteBulk', this._onMessageDeleteBulk);
            this.client.off('channelDelete', this._onChannelDelete);
            this.client.off('threadDelete', this._onThreadDelete);
            this.client.off('guildDelete', this._onGuildDelete);
            this.client.off('messageReactionAdd', this.onCollect);
            this.client.off('messageReactionRemove', this.onDispose);
            this.client.setMaxListeners(this.client.getMaxListeners() - 1);
        });
    }

    public async _collect(message: PossiblyUncachedMessage, reactor: Uncached|User|Member, reaction: EventReaction): Promise<[string, MessageReaction] | null> {
        if (this.message && this.message.id !== message.id) {
            return null;
        }

        if (this.channel && this.channel.id !== message.channelID) {
            return null;
        }

        if (this.guild && this.guild.id !== message.guildID) {
            return null;
        }

        return [
            ReactionCollector.getEmojiID(reaction),
            this.getMessageReaction(message, reactor, reaction)
        ];
    }

    public async _dispose(message: PossiblyUncachedMessage, reactor: Uncached|User|Member, reaction: EventReaction): Promise<[string, MessageReaction] | null> {
        const emojiID = ReactionCollector.getEmojiID(reaction);
        const reactionData = this.collected.get(emojiID);
        if (!reactionData) return null;

        return [emojiID, reactionData];
    }

    public async onCollect(message: PossiblyUncachedMessage, reactor: Uncached|User|Member, reaction: EventReaction): Promise<boolean> {
        const isRelevent = await super.onCollect(message, reactor, reaction);
        if (!isRelevent) return isRelevent;

        const user = this.users.get(reactor.id) ?? { id: reactor.id, reactions: [] };

        user.reactions.push(ReactionCollector.getEmojiID(reaction));

        if (!this.users.has(reactor.id)) {
            this.emit('userCreate', user.id, user.reactions);
            this.users.set(reactor.id, user);
        }

        return true;
    }

    public isEnded(): boolean {
        if (this.options.maxEmojis && this.collected.size >= this.options.maxEmojis) {
            this.stop('emoji limit');
            return this.ended;
        }

        if (this.options.maxUsers && this.users.size >= this.options.maxUsers) {
            this.stop('user limit');
            return this.ended;
        }

        return super.isEnded();
    }

    public async onDispose(message: PossiblyUncachedMessage, reactor: Uncached|User|Member, reaction: EventReaction): Promise<boolean> {
        const isRelevent = await super.onDispose(message, reactor, reaction);
        if (!isRelevent) return isRelevent;

        const user = this.users.get(reactor.id);
        if (!user) return false;

        const index = user.reactions.indexOf(ReactionCollector.getEmojiID(reaction));
        if (index !== -1) user.reactions.splice(index, 1);

        if (user.reactions.length === 0) {
            this.users.delete(reactor.id);
            this.emit('userDelete', user.id);
        }

        return true;
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
        if (!this.channel) return;

        if (this.channel.id === channel.id) {
            this.stop('channel deleted');
            return;
        }

        if (
            (this.channel.type === ChannelTypes.PUBLIC_THREAD ||
                this.channel.type === ChannelTypes.PRIVATE_THREAD ||
                this.channel.type === ChannelTypes.ANNOUNCEMENT_THREAD) &&
            this.channel.parentID === channel.id
        ) {
            this.stop('channel deleted');
        }
    }

    protected _onThreadDelete(channel: PossiblyUncachedThread): void {
        if (!this.channel || this.channel.id !== channel.id) return;
        this.stop('channel deleted');
    }

    protected _onGuildDelete(guild: Guild|Uncached): void {
        if (!this.guild || this.guild.id !== guild.id) return;
        this.stop('guild deleted');
    }

    public getMessageReaction(message: PossiblyUncachedMessage, reactor: Uncached|User|Member, reaction: EventReaction): MessageReaction {
        return {
            id: ReactionCollector.getEmojiID(reaction),
            lastReactorUserID: reactor.id,
            lastReactorUser: 'username' in reactor ? reactor : null,
            messageID: message.id,
            message,
            channelID: message.channelID,
            channel: message.channel ?? { id: message.channelID },
            guildID: message.guildID ?? null,
            guild: message.guildID ? { id: message.guildID } : null,
            ...reaction
        };
    }

    public static getEmojiID(event: EventReaction): string {
        return event.emoji.id || event.emoji.name;
    }
}