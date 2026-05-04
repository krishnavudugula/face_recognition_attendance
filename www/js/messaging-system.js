/**
 * Messaging System - In-app messaging and chatbot
 * Handles direct messages, announcements, and AI assistant bot
 */

class MessagingSystem {
    constructor() {
        const configuredBase = window.CONFIG?.API_URL
            || (window.API_BASE_URL ? `${window.API_BASE_URL}/api` : null)
            || 'http://127.0.0.1:5000/api';
        this.API_URL = configuredBase.replace(/\/$/, '');
        this.currentUser = JSON.parse(localStorage.getItem('user') || 'null');
        this.messages = [];
        this.conversations = {};  // Store conversations by user_id
        this.selectedContact = null;  // Currently selected person to message
        this.unreadCount = 0;
        this.isOpen = false;
        this.POLL_INTERVAL = 5000; // Poll for new messages every 5 seconds
        this.clearedMessages = new Set(); // Track message IDs cleared by this user
        this.loadClearedMessagesFromStorage();
        
        this.init();
    }

    loadClearedMessagesFromStorage() {
        try {
            const stored = localStorage.getItem(`clearedMessages_${this.currentUser?.user_id}`);
            this.clearedMessages = stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (e) {
            console.error('Error loading cleared messages:', e);
            this.clearedMessages = new Set();
        }
    }

    saveClearedMessagesToStorage() {
        try {
            localStorage.setItem(`clearedMessages_${this.currentUser?.user_id}`, JSON.stringify(Array.from(this.clearedMessages)));
        } catch (e) {
            console.error('Error saving cleared messages:', e);
        }
    }

    async init() {
        if (!this.currentUser) return;

        // Create messaging UI
        this.createMessagingUI();

        // Load initial messages
        await this.loadMessages();

        // Start polling for new messages
        this.startPolling();

        // Register FCM token if available
        if (window.Capacitor) {
            this.registerFCMToken();
        }
    }

    createMessagingUI() {
        const isAdmin = this.currentUser?.role === 'admin';
        const chatHTML = `
            <div id="messagingSystem" class="messaging-system">
                <button id="chatBubbleBtn" class="chat-bubble-btn" aria-label="Open chat" title="Open messages">
                    <span class="chat-icon">💬</span>
                    <span id="unreadBadge" class="unread-badge" style="display: none;"></span>
                </button>

                <div id="chatWindow" class="chat-window ${isAdmin ? 'admin-chat-window' : ''}" style="display: none;">
                    <div class="chat-header">
                        <div class="chat-header-title">
                            <h3>${isAdmin ? 'Messaging & Alerts' : 'Messages'}</h3>
                            <p id="headerStatus" class="header-status">Loading...</p>
                        </div>
                        <div class="chat-header-actions">
                            <button id="refreshMessagesBtn" class="chat-btn" title="Refresh messages">🔄</button>
                            <button id="preferencesBtn" class="chat-btn" title="Notification preferences">⚙️</button>
                            <button id="closeChatBtn" class="chat-btn" title="Close">✕</button>
                        </div>
                    </div>

                    <div class="chat-tabs">
                        <button class="chat-tab-btn active" data-tab="messages" title="Messages">
                            📧 Messages
                        </button>
                        <button class="chat-tab-btn" data-tab="alerts" title="Alerts">
                            🚨 Alerts
                        </button>
                        <button class="chat-tab-btn" data-tab="assistant" title="AI Assistant">
                            🤖 Assistant
                        </button>
                        ${isAdmin ? `<button class="chat-tab-btn" data-tab="send-alert" title="Send Alert">📣 Send Alert</button>` : ''}
                    </div>

                    <div id="messagesTab" class="chat-tab-content active">
                        <div id="contactListView" class="messages-list" style="display: flex; flex-direction: column; height: 100%;">
                            <div style="padding: 12px; border-bottom: 1px solid #E5E7EB; display: flex; gap: 8px; background: #F9FAFB;">
                                <input id="contactSearchInput" type="text" placeholder="Search or Type name/ID..." style="flex: 1; padding: 10px 12px; border: 1.5px solid #E5E7EB; border-radius: 8px; font-size: 13px; font-weight: 500; background: white; color: #1F2937; transition: all 0.3s;">
                                <button id="newMessageBtn" style="padding: 10px 12px; background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: all 0.3s; white-space: nowrap;">➕ New</button>
                            </div>
                            
                            <div id="contactsList" style="flex: 1; overflow-y: auto; padding: 10px;">
                                <div style="padding: 32px 16px; text-align: center; color: #9CA3AF; font-weight: 500;">No conversations yet. Click "New" to message someone.</div>
                            </div>
                        </div>
                        
                        <div id="conversationView" style="display: none; flex-direction: column; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #FFFFFF; z-index: 1000;">
                            <div style="padding: 14px 12px; border-bottom: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 100%);">
                                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                                    <button id="backToContactsBtn" style="background: #F3F4F6; border: 1px solid #E5E7EB; font-size: 16px; cursor: pointer; width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #1F2937; flex-shrink: 0;">←</button>
                                    <div style="flex: 1; min-width: 0;">
                                        <h4 id="conversationHeaderName" style="margin: 0; font-size: 14px; font-weight: 700; color: #1F2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></h4>
                                        <p id="conversationHeaderId" style="margin: 2px 0 0 0; font-size: 11px; color: #9CA3AF; font-weight: 500;"></p>
                                    </div>
                                </div>
                                <button id="clearConversationBtn" style="background: #FEE2E2; border: 1px solid #FECACA; font-size: 14px; cursor: pointer; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #DC2626; flex-shrink: 0; padding: 0;" title="Clear this conversation">🗑️</button>
                            </div>
                            
                            <div id="conversationMessages" style="flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth;">
                                <div style="text-align: center; color: #9CA3AF; padding: 32px 16px; font-weight: 500;">Loading conversation...</div>
                            </div>
                            
                            <div style="padding: 12px; border-top: 1px solid #E5E7EB; display: flex; gap: 10px; background: #F9FAFB;">
                                <input id="personalMessageInput" type="text" placeholder="Type a message..." style="flex: 1; padding: 10px 12px; border: 1.5px solid #E5E7EB; border-radius: 8px; font-size: 13px; font-weight: 500; background: white; color: #1F2937; transition: all 0.3s;">
                                <button id="sendPersonalMessageBtn" style="padding: 10px 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s; white-space: nowrap;">Send</button>
                            </div>
                        </div>
                    </div>

                    <div id="alertsTab" class="chat-tab-content">
                        <div id="alertsList" class="alerts-list">
                            <div class="loading-spinner">Loading alerts...</div>
                        </div>
                    </div>

                    <div id="assistantTab" class="chat-tab-content">
                        <div id="assistantChat" class="assistant-chat">
                            <div class="assistant-welcome">
                                <div class="assistant-avatar">🤖</div>
                                <h4>Hello! I'm your Assistant</h4>
                                <p>I can help you with:</p>
                                <ul>
                                    <li>📅 Holiday information</li>
                                    <li>❓ FAQ and policies</li>
                                    <li>📢 Announcements</li>
                                    <li>💡 Quick tips</li>
                                </ul>
                            </div>
                            <div id="assistantMessages" class="assistant-messages"></div>
                        </div>
                        <div class="chat-input">
                            <input id="assistantInput" type="text" placeholder="Ask me anything..." class="chat-input-field">
                            <button id="sendAssistantBtn" class="send-btn">📤</button>
                        </div>
                    </div>

                    ${isAdmin ? `
                    <div id="send-alertTab" class="chat-tab-content">
                        <div class="send-alert-form" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; height: 100%; overflow-y: auto;">
                            <div>
                                <label style="display: block; margin-bottom: 10px; font-weight: 700; color: #1F2937; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Send To:</label>
                                <div id="facultyList" style="display: flex; flex-direction: column; gap: 8px; max-height: 140px; overflow-y: auto; border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 12px; background: #F9FAFB;\">
                                    <div class="loading-spinner">Loading faculty...</div>
                                </div>
                                <button id="sendToAllBtn" style="width: 100%; margin-top: 12px; padding: 12px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 13px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.5px;\">📢 Send to All Faculty</button>
                            </div>
                            
                            <div style="border-top: 1.5px solid #E5E7EB; padding-top: 16px;\">
                                <label style="display: block; margin-bottom: 8px; font-weight: 700; color: #1F2937; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;\">Alert Title:</label>
                                <input id="alertTitle" type="text" placeholder="e.g., Important Notice\" style="width: 100%; padding: 10px 14px; border: 1.5px solid #E5E7EB; border-radius: 10px; font-family: inherit; color: #1F2937; background: #FFFFFF; font-weight: 500; font-size: 13px; transition: all 0.3s;\">
                                
                                <label style="display: block; margin: 14px 0 8px 0; font-weight: 700; color: #1F2937; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;\">Alert Message:</label>
                                <textarea id="alertMessage" placeholder="Type alert message...\" style="width: 100%; padding: 10px 14px; border: 1.5px solid #E5E7EB; border-radius: 10px; font-family: inherit; color: #1F2937; background: #FFFFFF; resize: none; height: 100px; font-weight: 500; font-size: 13px; transition: all 0.3s;\"></textarea>
                                
                                <button id="sendAlertBtn" style="width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 13px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.5px;\">✓ Send Alert</button>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
        this.attachEventListeners();
    }

    attachEventListeners() {
        const chatBubble = document.getElementById('chatBubbleBtn');
        const closeBtn = document.getElementById('closeChatBtn');

        // NEW: Open the professional chat page instead of popup
        chatBubble?.addEventListener('click', () => {
            window.location.href = '../pages/chat_page.html';
        });
        closeBtn?.addEventListener('click', () => this.toggleChat());

        // Tab switching
        document.querySelectorAll('.chat-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Refresh messages
        document.getElementById('refreshMessagesBtn')?.addEventListener('click', () => {
            this.loadMessages();
        });

        // Preferences
        document.getElementById('preferencesBtn')?.addEventListener('click', () => {
            this.openPreferences();
        });

        // Assistant bot
        document.getElementById('sendAssistantBtn')?.addEventListener('click', () => {
            this.sendAssistantMessage();
        });

        document.getElementById('assistantInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAssistantMessage();
        });

        // ===== PERSONAL MESSAGING =====
        document.getElementById('newMessageBtn')?.addEventListener('click', () => {
            this.showContactSearch();
        });

        document.getElementById('contactSearchInput')?.addEventListener('input', (e) => {
            this.searchContacts(e.target.value);
        });

        document.getElementById('backToContactsBtn')?.addEventListener('click', () => {
            this.showContactList();
        });

        document.getElementById('clearConversationBtn')?.addEventListener('click', () => {
            if (this.selectedContact && confirm(`Clear conversation with ${this.selectedContact.user_name}? This will only clear it for you.`)) {
                this.clearConversation(this.selectedContact.user_id);
            }
        });

        document.getElementById('sendPersonalMessageBtn')?.addEventListener('click', () => {
            this.sendPersonalMessage();
        });

        document.getElementById('personalMessageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendPersonalMessage();
        });

        // Admin: Send alert functionality
        if (this.currentUser?.role === 'admin') {
            document.getElementById('sendAlertBtn')?.addEventListener('click', () => {
                this.sendAlert('selected');
            });

            document.getElementById('sendToAllBtn')?.addEventListener('click', () => {
                this.sendAlert('all');
            });

            const sendAlertTab = document.querySelector('[data-tab="send-alert"]');
            if (sendAlertTab) {
                sendAlertTab.addEventListener('click', () => {
                    this.loadFacultyList();
                });
            }
        }

        // Close chat when clicking outside
        window.addEventListener('click', (e) => {
            if (!e.target.closest('#messagingSystem') && this.isOpen) {
                this.toggleChat();
            }
        });
    }

    toggleChat() {
        const chatWindow = document.getElementById('chatWindow');
        this.isOpen = !this.isOpen;
        chatWindow.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            this.loadMessages();
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.chat-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.chat-tab-content').forEach(tab => {
            tab.classList.toggle('active', tab.id === `${tabName}Tab`);
        });

        if (tabName === 'alerts') {
            this.loadAlerts();
        } else if (tabName === 'messages') {
            this.loadMessages();
        }
    }

    async loadMessages() {
        try {
            const response = await fetch(`${this.API_URL}/messages/${this.currentUser.user_id}?page=1`);
            if (!response.ok) throw new Error(`Failed to load messages: HTTP ${response.status}`);
            
            const data = await response.json();

            if (data.success) {
                this.messages = data.messages || [];
                this.buildConversations();
                this.renderContactList();
                this.updateUnreadCount();
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    buildConversations() {
        this.conversations = {};

        this.messages.forEach(msg => {
            // Skip messages that have been cleared by this user
            if (this.clearedMessages.has(msg.id)) {
                return;
            }

            let otherUserId, otherUserName;
            
            if (msg.sender_id === this.currentUser.user_id) {
                otherUserId = msg.recipient_id;
                otherUserName = msg.recipient_name;
            } else {
                otherUserId = msg.sender_id;
                otherUserName = msg.sender_name;
            }
            
            if (!otherUserId) return; 

            if (!this.conversations[otherUserId]) {
                this.conversations[otherUserId] = {
                    user_id: otherUserId,
                    user_name: otherUserName,
                    messages: [],
                    unread: 0
                };
            }

            this.conversations[otherUserId].messages.push(msg);
            
            if (msg.sender_id === otherUserId && !msg.is_read) {
                this.conversations[otherUserId].unread++;
            }
        });

        Object.keys(this.conversations).forEach(userId => {
            this.conversations[userId].messages.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            );
        });
    }

    renderContactList() {
        const container = document.getElementById('contactsList');
        if (!container) return;

        const conversationsList = Object.values(this.conversations);

        if (conversationsList.length === 0) {
            container.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8; font-weight: 500;">No conversations yet. Click "New" to start.</div>';
            return;
        }

        conversationsList.sort((a, b) => {
            const aTime = new Date(a.messages[0]?.created_at || 0);
            const bTime = new Date(b.messages[0]?.created_at || 0);
            return bTime - aTime;
        });

        const html = conversationsList.map(conv => {
            const lastMsg = conv.messages[0];
            const unreadIndicator = conv.unread > 0 ? `<div class="contact-unread">${conv.unread}</div>` : '';
            const initials = conv.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            return `
                <div class="contact-card" onclick="window.messagingSystem?.openConversation('${conv.user_id}', '${this.escapeHtml(conv.user_name)}')">
                    <div class="contact-avatar">${initials}</div>
                    <div class="contact-info">
                        <div class="contact-name">${this.escapeHtml(conv.user_name)}</div>
                        <div class="contact-preview">${this.escapeHtml(lastMsg?.content?.substring(0, 40) || 'No messages')}</div>
                    </div>
                    <div class="contact-meta">
                        ${unreadIndicator}
                        <div class="contact-time">${this.formatTime(lastMsg?.created_at)}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    async loadAlerts() {
        try {
            const response = await fetch(`${this.API_URL}/alerts/pinned/${this.currentUser.user_id}`);
            const data = await response.json();

            if (data.success) {
                this.renderAlerts(data.alerts || []);
            }
        } catch (error) {
            console.error('Failed to load alerts:', error);
        }
    }

    renderAlerts(alerts) {
        const container = document.getElementById('alertsList');
        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = '<div class="empty-state">No pinned alerts</div>';
            return;
        }

        const html = alerts.map(alert => `
            <div class="alert-item alert-${alert.type}">
                <div class="alert-header">
                    <strong>${alert.title}</strong>
                    <span class="alert-time">${this.formatTime(alert.created_at)}</span>
                </div>
                <div class="alert-content">${alert.message}</div>
                <div class="alert-actions">
                    <button class="unpin-btn" onclick="window.messagingSystem?.unpinAlert(${alert.id})">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    showContactList() {
        document.getElementById('contactListView').style.display = 'flex';
        document.getElementById('conversationView').style.display = 'none';
        this.selectedContact = null;
        document.getElementById('contactSearchInput').value = '';
        this.renderContactList();
    }

    showContactSearch() {
        const searchInput = document.getElementById('contactSearchInput');
        searchInput?.focus();
        this.searchContacts('');
    }

    async searchContacts(query) {
        const container = document.getElementById('contactsList');
        if (!container) return;

        if (!query.trim()) {
            this.renderContactList();
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/users/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);
            
            const data = await response.json();

            if (data.success && data.users && data.users.length > 0) {
                const users = data.users.filter(u => u.user_id !== this.currentUser.user_id);

                if (users.length === 0) {
                    container.innerHTML = '<div style="padding: 16px; text-align: center; color: #9ca3af;">No users found.</div>';
                    return;
                }

                const html = users.map(user => `
                    <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; cursor: pointer; background: #f9fafb; transition: all 0.2s;" onclick="window.messagingSystem?.openConversation('${user.user_id}', '${this.escapeHtml(user.name)}')">
                        <div style="font-weight: 600; color: #111827;">${user.name}</div>
                        <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${user.user_id} • ${user.role}</div>
                    </div>
                `).join('');

                container.innerHTML = html;
            } else {
                container.innerHTML = '<div style="padding: 16px; text-align: center; color: #9ca3af;">No users found.</div>';
            }
        } catch (error) {
            console.error('Search failed:', error);
            container.innerHTML = '<div style="padding: 16px; text-align: center; color: #ef4444;">Error searching users</div>';
        }
    }

    async openConversation(userId, userName) {
        this.selectedContact = { user_id: userId, name: userName };

        document.getElementById('conversationHeaderName').textContent = userName;
        document.getElementById('conversationHeaderId').textContent = userId;

        document.getElementById('contactListView').style.display = 'none';
        document.getElementById('conversationView').style.display = 'flex';

        await this.loadConversation(userId);

        const input = document.getElementById('personalMessageInput');
        if (input) input.value = '';
        input?.focus();
    }

    clearConversation(userId) {
        // Get all messages with this user and mark them as cleared for the current user only
        const conversation = this.conversations[userId];
        if (!conversation) {
            alert('Conversation not found');
            return;
        }

        // Add all message IDs from this conversation to the cleared set
        conversation.messages.forEach(msg => {
            this.clearedMessages.add(msg.id);
        });

        // Save to localStorage
        this.saveClearedMessagesToStorage();

        // Also try to send request to backend to delete for this user
        this.deleteConversationOnBackend(userId);

        // Rebuild conversations to remove cleared messages
        this.buildConversations();

        // Go back to contact list
        this.showContactList();
    }

    async deleteConversationOnBackend(userId) {
        try {
            // Try to delete on backend - this request may or may not be supported
            const response = await fetch(`${this.API_URL}/messages/${this.currentUser.user_id}/with/${userId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                console.log('Backend deletion not supported, using local deletion only');
            }
        } catch (error) {
            // Backend doesn't support deletion - local deletion is sufficient
            console.log('Local deletion only:', error.message);
        }
    }

    async loadConversation(userId) {
        try {
            const container = document.getElementById('conversationMessages');
            if (!container) return;

            container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">Loading messages...</div>';

            const response = await fetch(`${this.API_URL}/messages/${this.currentUser.user_id}/with/${userId}`);
            if (!response.ok) throw new Error(`Failed to load conversation`);
            
            const data = await response.json();
            let messages = data.messages || [];
            
            // Filter out messages that have been cleared by this user
            messages = messages.filter(msg => !this.clearedMessages.has(msg.id));
            
            if (messages.length === 0) {
                container.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8; font-weight:500;">Start the conversation!</div>';
                return;
            }

            container.innerHTML = ''; 

            messages.forEach(msg => {
                const isFromCurrentUser = msg.sender_id === this.currentUser.user_id;
                const wrapperClass = isFromCurrentUser ? 'msg-bubble-sent' : 'msg-bubble-received';

                const wrapper = document.createElement('div');
                wrapper.className = `msg-bubble-wrapper ${wrapperClass}`;
                wrapper.innerHTML = `
                    <div class="msg-bubble" title="Long press to delete">
                        <div class="msg-content">${this.escapeHtml(msg.content)}</div>
                        <span class="msg-time">${this.formatTime(msg.created_at)}</span>
                    </div>
                `;

                // Attach long press event strictly to the bubble element
                this.setupLongPress(wrapper.querySelector('.msg-bubble'), msg.id);
                container.appendChild(wrapper);
            });

            container.scrollTop = container.scrollHeight;
        } catch (error) {
            console.error('Failed to load conversation:', error);
            const container = document.getElementById('conversationMessages');
            if (container) container.innerHTML = '<div style="padding: 16px; text-align: center; color: #ef4444;">Error loading conversation</div>';
        }
    }

    setupLongPress(element, messageId) {
        let pressTimer;
        
        const start = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return; // Left click only
            pressTimer = window.setTimeout(() => {
                this.deleteMessage(messageId);
            }, 700); // 700ms long press threshold
        };
        
        const cancel = () => {
            if (pressTimer !== null) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        element.addEventListener('mousedown', start);
        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
        element.addEventListener('touchend', cancel);
        element.addEventListener('touchcancel', cancel);
    }

    async deleteMessage(messageId) {
        if (confirm("Do you want to delete this message?")) {
            try {
                const response = await fetch(`${this.API_URL}/messages/${messageId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: this.currentUser.user_id })
                });
                
                const data = await response.json();
                if (data.success) {
                    if (this.selectedContact) {
                        await this.loadConversation(this.selectedContact.user_id);
                    }
                    this.loadMessages(); // Refresh contact list preview
                } else {
                    alert("Failed to delete message.");
                }
            } catch (err) {
                console.error("Error deleting message:", err);
            }
        }
    }

    async sendPersonalMessage() {
        if (!this.selectedContact) {
            alert('No contact selected');
            return;
        }

        const input = document.getElementById('personalMessageInput');
        const message = input?.value.trim();

        if (!message) return;

        try {
            const response = await fetch(`${this.API_URL}/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: this.currentUser.user_id,
                    recipient_id: this.selectedContact.user_id,
                    title: 'Direct Message',
                    content: message,
                    is_broadcast: false,
                    message_type: 'direct_message'
                })
            });

            const data = await response.json();

            if (data.success) {
                input.value = '';
                await this.loadConversation(this.selectedContact.user_id);
                this.loadMessages();
            } else {
                alert('Failed to send message');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Error sending message');
        }
    }

    async sendAssistantMessage() {
        const input = document.getElementById('assistantInput');
        const message = input?.value.trim();

        if (!message) return;

        const messagesContainer = document.getElementById('assistantMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML += `
                <div class="assistant-message user-message">
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        }

        if (input) input.value = '';

        const response = await this.getAssistantResponse(message);

        if (messagesContainer) {
            messagesContainer.innerHTML += `
                <div class="assistant-message bot-message">
                    <p>${this.escapeHtml(response)}</p>
                </div>
            `;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    async getAssistantResponse(query) {
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('holiday')) {
            return '📅 For holiday information, please check the Holidays section in the admin dashboard or contact your administrator.';
        } else if (lowerQuery.includes('late') || lowerQuery.includes('permission')) {
            return '🕐 You can request Late Permission through the Permissions tab. Submit your request and wait for admin approval.';
        } else if (lowerQuery.includes('help') || lowerQuery.includes('how')) {
            return '💡 I\'m here to help! You can ask me about holidays, permissions, policies, or any general questions about the attendance system.';
        } else if (lowerQuery.includes('attendance')) {
            return '✓ To check your attendance, go to the Reports section to view your attendance history and status.';
        } else {
            return '🤖 I\'m an AI assistant. I can help with holidays, permissions, policies, and general questions. For specific issues, please contact your administrator.';
        }
    }

    async markAsRead(messageId) {
        try {
            await fetch(`${this.API_URL}/messages/${messageId}/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.currentUser.user_id })
            });

            this.loadMessages();
        } catch (error) {
            console.error('Failed to mark message as read:', error);
        }
    }

    async unpinAlert(alertId) {
        try {
            await fetch(`${this.API_URL}/alerts/${alertId}/unpin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.currentUser.user_id })
            });

            this.loadAlerts();
        } catch (error) {
            console.error('Failed to unpin alert:', error);
        }
    }

    updateUnreadCount() {
        const unreadCount = this.messages.filter(m => !m.is_read).length;
        this.unreadCount = unreadCount;

        const badge = document.getElementById('unreadBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    openPreferences() {
        window.alertPreferencesPanel?.show();
    }

    async registerFCMToken() {
        try {
            if (!window.Capacitor?.isPluginAvailable('PushNotifications')) return;

            const { PushNotifications } = window.Capacitor.Plugins;
            const result = await PushNotifications.requestPermissions();

            if (result.receive === 'granted') {
                await PushNotifications.register();
                PushNotifications.addListener('registration', (token) => {
                    this.saveFCMToken(token.value);
                });
            }
        } catch (error) {
            console.error('FCM registration failed:', error);
        }
    }

    async saveFCMToken(token) {
        try {
            await fetch(`${this.API_URL}/fcm/register_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.currentUser.user_id,
                    fcm_token: token,
                    device_info: window.navigator.userAgent
                })
            });
        } catch (error) {
            console.error('Failed to save FCM token:', error);
        }
    }

    startPolling() {
        setInterval(() => {
            if (this.isOpen) {
                this.loadMessages();
            }
        }, this.POLL_INTERVAL);
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadFacultyList() {
        try {
            const facultyList = document.getElementById('facultyList');
            if (!facultyList) return;

            facultyList.innerHTML = '<div style="color: var(--theme-text); padding: 8px;">Loading faculty...</div>';

            const response = await fetch(`${this.API_URL}/users/faculty`);
            if (!response.ok) throw new Error(`Failed to load faculty`);
            
            const data = await response.json();

            if (data.success && data.faculty && data.faculty.length > 0) {
                facultyList.innerHTML = data.faculty.map(faculty => `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer; border-radius: 4px;">
                        <input type="checkbox" class="faculty-checkbox" value="${faculty.user_id}" data-name="${faculty.name}">
                        <span>${faculty.name} (${faculty.user_id})</span>
                    </label>
                `).join('');
            } else if (data.faculty && data.faculty.length === 0) {
                facultyList.innerHTML = '<div style="color: var(--theme-text); padding: 8px; font-weight: 500;">📌 No faculty registered yet.</div>';
            } else {
                facultyList.innerHTML = '<div style="color: var(--theme-text); padding: 8px;">Error: ' + (data.error || 'Unknown error') + '</div>';
            }
        } catch (error) {
            console.error('Failed to load faculty list:', error);
            const facultyList = document.getElementById('facultyList');
            if (facultyList) {
                facultyList.innerHTML = '<div style="color: #ef4444; padding: 8px;">❌ Error loading faculty list. Check console.</div>';
            }
        }
    }

    async sendAlert(type) {
        try {
            const title = document.getElementById('alertTitle')?.value;
            const message = document.getElementById('alertMessage')?.value;

            if (!title || !message) {
                alert('Please enter both title and message');
                return;
            }

            let recipientIds = [];

            if (type === 'all') {
                const response = await fetch(`${this.API_URL}/users/faculty`);
                const data = await response.json();
                recipientIds = data.faculty.map(f => f.user_id);
            } else if (type === 'selected') {
                const checkboxes = document.querySelectorAll('.faculty-checkbox:checked');
                if (checkboxes.length === 0) {
                    alert('Please select at least one faculty member');
                    return;
                }
                recipientIds = Array.from(checkboxes).map(cb => cb.value);
            }

            // CRITICAL FIX: Send directly to the Notification/Alerts database, NOT messages
            for (const recipientId of recipientIds) {
                await fetch(`${this.API_URL}/admin/alerts/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_id: this.currentUser.user_id,
                        recipient_id: recipientId,
                        title: title,
                        content: message
                    })
                });
            }

            document.getElementById('alertTitle').value = '';
            document.getElementById('alertMessage').value = '';
            document.querySelectorAll('.faculty-checkbox').forEach(cb => cb.checked = false);

            alert(`✓ Alert successfully blasted to the Alerts Tab for ${recipientIds.length} faculty member(s).`);
        } catch (error) {
            console.error('Failed to send alert:', error);
            alert('Failed to send alert. Please try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.messagingSystem = new MessagingSystem();
});