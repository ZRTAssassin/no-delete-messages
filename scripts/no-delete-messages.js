const NODELETE = {
    debugLog: function (message) {
        if (!game.settings.get('no-delete-messages', 'enableLogging')) return;
        console.log("No Delete Messages | ", message);
    },

    sendWhisper: async function (content) {
        if (!game.settings.get('no-delete-messages', 'enableWhispers')) return;
        const gmUsers = game.users.filter(user => user.isGM).map(user => user.id);
        await ChatMessage.create({
            content: content,
            type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
            whisper: gmUsers
        });
    }
}

Hooks.once('init', () => {
    game.settings.register('no-delete-messages', 'enableWhispers', {
        name: 'Enable GM Notifications',
        hint: 'Send whispered notifications to GMs when users attempt to delete messages',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    game.settings.register('no-delete-messages', 'enableLogging', {
        name: 'Enable Debug logging',
        hint: 'View logs in the console when events fire.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
    NODELETE.debugLog('Initializing module');

    // Override the delete method
    libWrapper.register('no-delete-messages', 'ChatMessage.prototype.delete', async function (wrapped, ...args) {
        const user = game.users.get(game.userId);

        if (!user.isGM) {
            NODELETE.debugLog('ChatMessage.prototype.delete | Preventing programmatic deletion by non-GM');
            const attemptContent = `${user.name} attempted to programmatically delete the following message:<br><br>${this.content}`;
            await NODELETE.sendWhisper(attemptContent);
            return false;
        }

        return wrapped(...args);
    }, 'MIXED');
});

Hooks.on('renderChatMessage', (message, html, data) => {
    NODELETE.debugLog('renderChatMessage | Processing chat message:', message);

    if (!game.user.isGM) {
        NODELETE.debugLog('renderChatMessage | User is not GM, removing delete button');

        const deleteButton = html.find('.fa-trash.fa-fw');
        if (deleteButton.length) {
            deleteButton.closest('li').remove();
            NODELETE.debugLog('renderChatMessage | Delete button removed');
        }
    }
});

Hooks.on('getChatLogEntryContext', (html, options) => {
    NODELETE.debugLog('getChatLogEntryContext | Processing context menu');

    if (!game.user.isGM) {
        NODELETE.debugLog('getChatLogEntryContext | User is not GM, filtering context menu options');

        options.forEach((option, i) => {
            if (option.icon?.includes('fa-trash') || option.name === 'Delete') {
                NODELETE.debugLog('getChatLogEntryContext | Removing delete option from context menu');
                options.splice(i, 1);
            }
        });
    }
});

Hooks.on('preDeleteChatMessage', async (message, options, userId) => {
    NODELETE.debugLog('preDeleteChatMessage | Attempting to delete message:', message);

    const user = game.users.get(userId);
    if (!user.isGM) {
        NODELETE.debugLog('preDeleteChatMessage | Preventing non-GM from deleting message');

        const attemptContent = `${user.name} attempted to delete the following message:<br><br>${message.content}`;
        await NODELETE.sendWhisper(attemptContent);

        return false;
    }

    NODELETE.debugLog('preDeleteChatMessage | Allowing deletion');
    return true;
});