// scripts/no-delete-messages.js
const NODELETE = {
    debugLog: function (message) {
        let log = false;
        if (log) {
            console.log("No Delete Messages | ", message);
        }
    },
    
    sendWhisper: async function(content) {
        const gmUsers = game.users.filter(user => user.isGM).map(user => user.id);
        await ChatMessage.create({
            content: content,
            type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
            whisper: gmUsers
        });
    }
}

Hooks.once('init', () => {
    NODELETE.debugLog('Initializing module');

    // Override the delete method
    libWrapper.register('no-delete-messages', 'ChatMessage.prototype.delete', async function(wrapped, ...args) {
        const user = game.users.get(game.userId);
        
        if (!user.isGM) {
            NODELETE.debugLog('Preventing programmatic deletion by non-GM');
            const attemptContent = `${user.name} attempted to programmatically delete the following message:<br><br>${this.content}`;
            await NODELETE.sendWhisper(attemptContent);
            return false;
        }
        
        return wrapped(...args);
    }, 'MIXED');
});

Hooks.on('renderChatMessage', (message, html, data) => {
    NODELETE.debugLog('Processing chat message:', message);
    
    if (!game.user.isGM) {
        NODELETE.debugLog('User is not GM, removing delete button');
        
        const deleteButton = html.find('.fa-trash.fa-fw');
        if (deleteButton.length) {
            deleteButton.closest('li').remove();
            NODELETE.debugLog('Delete button removed');
        }
    }
});

Hooks.on('getChatLogEntryContext', (html, options) => {
    NODELETE.debugLog('Processing context menu');

    if (!game.user.isGM) {
        NODELETE.debugLog('User is not GM, filtering context menu options');
        
        options.forEach((option, i) => {
            if (option.icon?.includes('fa-trash') || option.name === 'Delete') {
                NODELETE.debugLog('Removing delete option from context menu');
                options.splice(i, 1);
            }
        });
    }
});

Hooks.on('preDeleteChatMessage', async (message, options, userId) => {
    NODELETE.debugLog('Attempting to delete message:', message);
    
    const user = game.users.get(userId);
    if (!user.isGM) {
        NODELETE.debugLog('Preventing non-GM from deleting message');
        
        const attemptContent = `${user.name} attempted to delete the following message:<br><br>${message.content}`;
        await NODELETE.sendWhisper(attemptContent);
        
        return false;
    }
    
    NODELETE.debugLog('Allowing deletion');
    return true;
});