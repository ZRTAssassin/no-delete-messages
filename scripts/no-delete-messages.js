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
    game.settings.register('no-delete-messages', 'disableRerolls', {
        name: 'Disable Rerolls',
        hint: 'Prevent players from rerolling tests (Warhammer 40k: Imperium Maledictum)',
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
    NODELETE.debugLog('getChatLogEntryContext | Options before filtering:', options);
    
    if (!game.user.isGM) {
        NODELETE.debugLog('getChatLogEntryContext | User is not GM, filtering context menu options');
        
        // Iterate backwards to safely remove items
        for (let i = options.length - 1; i >= 0; i--) {
            const option = options[i];
            
            // Remove delete option
            if (option.icon?.includes('fa-trash') || option.name === 'Delete') {
                NODELETE.debugLog('getChatLogEntryContext | Removing delete option from context menu');
                options.splice(i, 1);
                continue;
            }
            
            // Remove reroll options if setting is enabled (but not Fate Reroll)
            if (game.settings.get('no-delete-messages', 'disableRerolls')) {
                if ((option.icon?.includes('fa-rotate-right') || option.name?.includes('Reroll')) && 
                    !option.name?.includes('Fate Reroll')) {
                    NODELETE.debugLog('getChatLogEntryContext | Removing reroll option:', option.name);
                    options.splice(i, 1);
                }
            }
        }
        
        NODELETE.debugLog('getChatLogEntryContext | Options after filtering:', options);
    }
});

// Add a MutationObserver to catch context menus when they appear in the DOM
Hooks.once('ready', () => {
    if (game.user.isGM) return;
    
    NODELETE.debugLog('ready | Setting up MutationObserver for context menus');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.id === 'context-menu') {
                    NODELETE.debugLog('MutationObserver | Context menu detected');
                    
                    // Remove delete buttons
                    const deleteItems = node.querySelectorAll('.fa-trash.fa-fw');
                    deleteItems.forEach(item => {
                        const li = item.closest('li');
                        if (li) {
                            NODELETE.debugLog('MutationObserver | Removing delete option');
                            li.remove();
                        }
                    });
                    
                    // Remove reroll buttons if setting is enabled (but not Fate Reroll)
                    if (game.settings.get('no-delete-messages', 'disableRerolls')) {
                        const rerollItems = node.querySelectorAll('.fa-rotate-right.fa-fw');
                        rerollItems.forEach(item => {
                            const li = item.closest('li');
                            const span = li?.querySelector('span');
                            // Only remove if it's NOT "Fate Reroll"
                            if (li && span && !span.textContent.includes('Fate')) {
                                NODELETE.debugLog('MutationObserver | Removing reroll option');
                                li.remove();
                            }
                        });
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    NODELETE.debugLog('ready | MutationObserver set up successfully');
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