/**
 * FaceAttend Chat Interface — Professional, Mobile-First Chat System
 * Standalone chat page handler with premium UI/UX
 */

class ChatInterface {
  constructor() {
    this.API = window.CONFIG?.API_URL || 
               (window.API_BASE_URL ? `${window.API_BASE_URL}/api` : null) || 
               'http://127.0.0.1:5000/api';
    this.API = this.API.replace(/\/$/, '');

    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this.isAdmin = this.user?.role === 'admin';
    
    this.conversations = {};
    this.currentChat = null;
    this.currentChatUser = null;
    this.currentChatUserRole = null;
    this.alerts = [];
    this.activeTab = 'messages';
    this.searchQuery = '';
    this.selectedAlertPriority = 'info';
    this.pollInterval = null;
    this.isMobileView = window.matchMedia('(max-width: 767px)').matches;
    this.headerMenuOpen = false;
    this.broadcastRecipients = [];
    this.broadcastSelectedRecipients = new Set();
    this.allUsers = [];
    this.userSearchCache = new Map();
    this.userSuggestionDebounce = null;
    this.userSuggestionAbortController = null;
    this.selectedUserForNewConversation = null;

    if (!this.user) this.showSessionExpired();
    else this.init();
  }

  async init() {
    this.buildUI();
    this.bindGlobalListeners();
    await Promise.all([
      this.loadConversations(),
      this.loadAllUsers()
    ]);
    this.attachEventListeners();
    this.startPolling();
    this.updateHeaderSubtitle('Messages');
  }

  bindGlobalListeners() {
    window.addEventListener('resize', () => {
      this.isMobileView = window.matchMedia('(max-width: 767px)').matches;
      if (!this.isMobileView) this.exitChatView(false);
    });

    window.addEventListener('beforeunload', () => {
      if (this.pollInterval) clearInterval(this.pollInterval);
    });
  }

  buildUI() {
    const isAdmin = this.isAdmin;
    const html = `
      <div class="chat-container">
        <!-- Mobile Header -->
        <div class="chat-header-mobile">
          <button class="btn-back" id="btnBack" title="Back">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="header-title-section">
            <h1 class="header-title">FaceAttend Chat</h1>
            <p class="header-subtitle" id="headerSubtitle">Messages</p>
          </div>
          <button class="btn-menu" id="btnMenu" title="Menu">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </div>

        <!-- Main Container with Split View for Desktop -->
        <div class="chat-main">
          <!-- Conversations Panel -->
          <div class="conversations-panel" id="convPanel">
            <!-- Tabs -->
            <div class="tabs-navigation">
              <button class="tab-btn active" data-tab="messages">
                <i class="fas fa-comment-dots"></i>
                <span>Messages</span>
              </button>
              <button class="tab-btn" data-tab="alerts">
                <i class="fas fa-bell"></i>
                <span>Alerts</span>
                <span class="tab-badge" id="alertBadge" style="display: none;">0</span>
              </button>
              <button class="tab-btn" data-tab="assistant">
                <i class="fas fa-sparkles"></i>
                <span>AI</span>
              </button>
              ${isAdmin ? `
                <button class="tab-btn" data-tab="broadcast">
                  <i class="fas fa-megaphone"></i>
                  <span>Broadcast</span>
                </button>
              ` : ''}
            </div>

            <!-- Search Bar -->
            <div class="search-container">
              <div class="search-input-wrapper">
                <i class="fas fa-search"></i>
                <input type="text" id="searchInput" placeholder="Search conversations…" class="search-input">
              </div>
              <button class="btn-new-chat" id="btnNewChat" title="New message">
                <i class="fas fa-plus"></i>
              </button>
            </div>

            <!-- Conversations List -->
            <div class="conversations-list" id="convList">
              <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No conversations yet</p>
                <button class="btn-primary-sm" id="btnStartChat">Start Chatting</button>
              </div>
            </div>
          </div>

          <!-- Chat Area -->
          <div class="chat-area" id="chatArea">
            <div class="chat-empty">
              <div class="empty-illustration">
                <i class="fas fa-comments"></i>
              </div>
              <h2>Select a conversation</h2>
              <p>Choose from your messages to get started</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div class="modal-overlay" id="modalOverlay"></div>
      
      <!-- New Message Modal -->
      <div class="modal" id="newMessageModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Start a conversation</h3>
            <button class="btn-close" onclick="chatInterface.hideAllModals()">&times;</button>
          </div>
          <div class="modal-body">
            <input type="text" id="userIdInput" placeholder="Enter user ID or name" class="input-field">
            <div class="suggestions" id="userSuggestions"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="chatInterface.hideAllModals()">Cancel</button>
            <button class="btn-primary" id="btnConfirmMessage">Send Message</button>
          </div>
        </div>
      </div>

      <!-- Permission Request Modal -->
      <div class="modal" id="permissionRequestModal">
        <div class="modal-content modal-large">
          <div class="modal-header">
            <h3>Request Permission</h3>
            <button class="btn-close" onclick="chatInterface.hideAllModals()">&times;</button>
          </div>
          <div class="modal-body permission-form">
            <form id="permissionForm">
              <div class="form-group">
                <label for="permissionType">Permission Type</label>
                <select id="permissionType" class="input-field" required>
                  <option value="">Select a type...</option>
                  <option value="late_arrival">Late Arrival</option>
                  <option value="early_departure">Early Departure</option>
                  <option value="full_day_absence">Full Day Absence</option>
                  <option value="half_day">Half Day Leave</option>
                  <option value="custom">Custom Request</option>
                </select>
              </div>

              <div class="form-group" id="customTypeGroup" style="display: none;">
                <label for="customType">Describe your request</label>
                <input type="text" id="customType" class="input-field" placeholder="e.g., Medical appointment, Personal emergency, etc.">
              </div>

              <div class="form-group" id="customDaysGroup" style="display: none;">
                <label for="customDaysCount">How many days?</label>
                <input type="number" id="customDaysCount" class="input-field" min="1" max="31" value="1">
                <small>For custom requests, the selected date is treated as the first day and the system saves consecutive dates.</small>
              </div>

              <div class="form-group">
                <label for="permissionDate">Date</label>
                <input type="date" id="permissionDate" class="input-field" required>
              </div>

              <div id="timeRangeGroup" style="display: none;">
                <div class="form-row">
                  <div class="form-group">
                    <label for="startTime">Start Time</label>
                    <input type="time" id="startTime" class="input-field">
                  </div>
                  <div class="form-group">
                    <label for="endTime">End Time</label>
                    <input type="time" id="endTime" class="input-field">
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label for="permissionReason">Reason / Description</label>
                <textarea id="permissionReason" class="input-field" rows="4" placeholder="Please explain the reason for your request..." required></textarea>
              </div>

              <div class="form-group">
                <label for="permissionDocument">
                  <i class="fas fa-file-upload"></i> Attach Document / Proof (Optional)
                </label>
                <div class="file-upload-wrapper">
                  <input type="file" id="permissionDocument" class="input-field file-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                  <span id="fileName" class="file-name"></span>
                </div>
                <small>Accepted: PDF, DOC, DOCX, JPG, PNG (Max 5MB)</small>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="permissionFullDay"> Request for full day
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="chatInterface.hideAllModals()">Cancel</button>
            <button class="btn-primary" id="btnSubmitPermission">Submit Request</button>
          </div>
        </div>
      </div>

      <!-- Toast Notifications -->
      <div class="toast-container" id="toastContainer"></div>

      <!-- Header Menu -->
      <div class="header-menu" id="headerMenu">
        <button class="header-menu-item" id="menuRefresh">
          <i class="fas fa-rotate"></i>
          <span>Refresh</span>
        </button>
        <button class="header-menu-item" id="menuClearCurrent">
          <i class="fas fa-trash"></i>
          <span>Clear current chat</span>
        </button>
        <button class="header-menu-item" id="menuClose">
          <i class="fas fa-xmark"></i>
          <span>Close menu</span>
        </button>
      </div>
    `;
    
    document.body.innerHTML = html;
  }

  attachEventListeners() {
    // Back button
    document.getElementById('btnBack').addEventListener('click', () => this.handleBackAction());

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.switchTab(this.activeTab);
      });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderConversations();
    });

    // New chat
    document.getElementById('btnNewChat').addEventListener('click', () => {
      this.showModal('newMessageModal');
    });

    document.getElementById('btnMenu').addEventListener('click', () => this.toggleHeaderMenu());

    const btnStartChat = document.getElementById('btnStartChat');
    if (btnStartChat) {
      btnStartChat.addEventListener('click', () => this.showModal('newMessageModal'));
    }

    // Modal overlay click
    document.getElementById('modalOverlay').addEventListener('click', () => {
      this.hideAllModals();
    });

    // Confirm new message
    document.getElementById('btnConfirmMessage').addEventListener('click', () => {
      const userId = document.getElementById('userIdInput').value.trim();
      if (userId) this.startConversation(userId);
    });

    // User Autocomplete
    const userIdInput = document.getElementById('userIdInput');
    if (userIdInput) {
      userIdInput.addEventListener('input', (e) => {
        this.queueUserSuggestionSearch(e.target.value);
      });
      
      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        const suggestionsDiv = document.getElementById('userSuggestions');
        if (suggestionsDiv && !userIdInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
          suggestionsDiv.classList.remove('active');
        }
      });
    }

    const menuRefresh = document.getElementById('menuRefresh');
    const menuClearCurrent = document.getElementById('menuClearCurrent');
    const menuClose = document.getElementById('menuClose');

    if (menuRefresh) {
      menuRefresh.addEventListener('click', async () => {
        this.hideHeaderMenu();
        if (this.activeTab === 'alerts') await this.loadAlerts();
        else await this.loadConversations();
        this.showToast('Refreshed', 'success');
      });
    }

    if (menuClearCurrent) {
      menuClearCurrent.addEventListener('click', async () => {
        this.hideHeaderMenu();
        await this.clearCurrentConversation();
      });
    }

    if (menuClose) {
      menuClose.addEventListener('click', () => this.hideHeaderMenu());
    }

    document.addEventListener('click', (event) => {
      const menu = document.getElementById('headerMenu');
      const trigger = document.getElementById('btnMenu');
      if (!menu || !trigger || !this.headerMenuOpen) return;
      if (menu.contains(event.target) || trigger.contains(event.target)) return;
      this.hideHeaderMenu();
    });
  }

  async loadConversations() {
    try {
      const res = await fetch(`${this.API}/messages/${this.user.user_id}`);
      const data = await res.json();
      
      this.conversations = {};
      (data.messages || []).forEach(msg => {
        const otherId = msg.sender_id === this.user.user_id ? msg.recipient_id : msg.sender_id;
        const otherName = msg.sender_id === this.user.user_id ? (msg.recipient_name || otherId) : (msg.sender_name || otherId);
        const otherRole = msg.sender_id === this.user.user_id ? (msg.recipient_role || null) : (msg.sender_role || null);
        
        if (!this.conversations[otherId]) {
          this.conversations[otherId] = {
            id: otherId,
            name: otherName,
            role: otherRole,
            messages: [],
            unread: 0,
            lastMessage: null,
            lastTime: null
          };
        } else if (!this.conversations[otherId].role && otherRole) {
          this.conversations[otherId].role = otherRole;
        }
        
        this.conversations[otherId].messages.push(msg);
        if (msg.sender_id !== this.user.user_id && !msg.is_read) {
          this.conversations[otherId].unread++;
        }
        
        this.conversations[otherId].lastMessage = msg.content;
        this.conversations[otherId].lastTime = this.getMessageTimestamp(msg);
      });

      Object.values(this.conversations).forEach(conv => {
        conv.messages.sort((a, b) => this.getMessageDate(a) - this.getMessageDate(b));
        const lastMsg = conv.messages[conv.messages.length - 1];
        conv.lastMessage = lastMsg?.content || null;
        conv.lastTime = this.getMessageTimestamp(lastMsg);
      });

      this.conversations = Object.fromEntries(
        Object.values(this.conversations)
            .sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
          .map(conv => [conv.id, conv])
      );

      this.renderConversations();
    } catch (err) {
      console.error('Failed to load conversations:', err);
      const list = document.getElementById('convList');
      if (list && !Object.keys(this.conversations).length) {
        list.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-plug-circle-xmark"></i>
            <p>Unable to load chats</p>
          </div>
        `;
      }
      this.showToast('Failed to load conversations', 'error');
    }
  }

  async loadAllUsers() {
    try {
      // Fallback list only (live search uses /users/search?q=...)
      const res = await fetch(`${this.API}/users/faculty`);
      if (!res.ok) throw new Error('Faculty list not available');
      const data = await res.json();
      this.allUsers = data.faculty || [];
    } catch (err) {
      console.warn('Failed to load users for autocomplete:', err);
      // Final fallback: use locally known conversations
      this.allUsers = Object.values(this.conversations).map(c => ({
        user_id: c.id,
        name: c.name,
        role: 'user'
      }));
    }
  }

  queueUserSuggestionSearch(query) {
    this.selectedUserForNewConversation = null;

    if (this.userSuggestionDebounce) {
      clearTimeout(this.userSuggestionDebounce);
      this.userSuggestionDebounce = null;
    }

    const normalized = String(query || '').trim();
    if (!normalized) {
      this.hideUserSuggestions();
      return;
    }

    this.userSuggestionDebounce = setTimeout(() => {
      this.updateUserSuggestions(normalized);
    }, 220);
  }

  hideUserSuggestions() {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;
    suggestionsDiv.classList.remove('active');
    suggestionsDiv.innerHTML = '';
  }

  showUserSuggestionsLoading() {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;
    suggestionsDiv.innerHTML = `
      <div class="suggestion-item">
        <span class="suggestion-id" style="text-align:center; padding: 4px 0;">Searching…</span>
      </div>
    `;
    suggestionsDiv.classList.add('active');
  }

  async updateUserSuggestions(query) {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;

    const normalizedLower = String(query || '').trim().toLowerCase();
    if (!normalizedLower) {
      this.hideUserSuggestions();
      return;
    }

    // Cache hit
    if (this.userSearchCache.has(normalizedLower)) {
      this.renderUserSuggestionsList(this.userSearchCache.get(normalizedLower), normalizedLower);
      return;
    }

    // Cancel any previous in-flight search
    if (this.userSuggestionAbortController) {
      this.userSuggestionAbortController.abort();
    }
    this.userSuggestionAbortController = new AbortController();

    this.showUserSuggestionsLoading();

    let users = [];
    try {
      const res = await fetch(`${this.API}/users/search?q=${encodeURIComponent(normalizedLower)}`, {
        signal: this.userSuggestionAbortController.signal
      });

      if (res.ok) {
        const data = await res.json();
        users = Array.isArray(data.users) ? data.users : [];
      }
    } catch (err) {
      // Ignore abort errors; fallback to local list for other errors
      if (err?.name !== 'AbortError') {
        console.warn('User search failed, falling back to cached list:', err);
      } else {
        return;
      }
    }

    // Fallback: local filter if API returned nothing
    if (!users.length) {
      users = (this.allUsers || []).filter(u =>
        String(u.user_id) !== String(this.user.user_id) &&
        (String(u.name || '').toLowerCase().includes(normalizedLower) ||
          String(u.user_id || '').toLowerCase().includes(normalizedLower))
      ).slice(0, 10);
    }

    // Exclude self and limit
    users = (users || []).filter(u => String(u.user_id) !== String(this.user.user_id)).slice(0, 10);
    this.userSearchCache.set(normalizedLower, users);
    this.renderUserSuggestionsList(users, normalizedLower);
  }

  renderUserSuggestionsList(users, queryLower) {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;

    const list = Array.isArray(users) ? users : [];

    if (!queryLower) {
      this.hideUserSuggestions();
      return;
    }

    if (!list.length) {
      suggestionsDiv.innerHTML = `
        <div class="suggestion-item">
          <span class="suggestion-id" style="text-align:center; padding: 4px 0;">No users found</span>
        </div>
      `;
      suggestionsDiv.classList.add('active');
      return;
    }

    suggestionsDiv.innerHTML = list.map(u => {
      const name = u.name || u.user_id;
      const role = u.role || 'user';
      return `
        <div class="suggestion-item" data-id="${this.escapeHtml(u.user_id)}" data-name="${this.escapeHtml(name)}" data-role="${this.escapeHtml(role)}">
          <span class="suggestion-name">${this.escapeHtml(name)}</span>
          <span class="suggestion-id">${this.escapeHtml(u.user_id)} • ${this.escapeHtml(role)}</span>
        </div>
      `;
    }).join('');

    suggestionsDiv.classList.add('active');

    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const input = document.getElementById('userIdInput');
        if (!input) return;

        const selectedId = item.dataset.id;
        const selectedName = item.dataset.name;

        input.value = selectedId;
        input.focus();
        this.selectedUserForNewConversation = { user_id: selectedId, name: selectedName };
        suggestionsDiv.classList.remove('active');
      });
    });
  }

  renderConversations() {
    const list = document.getElementById('convList');
    let filtered = Object.values(this.conversations);

    if (this.searchQuery) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(this.searchQuery) ||
        c.id.toLowerCase().includes(this.searchQuery)
      );
    }

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>${this.searchQuery ? 'No results found' : 'No conversations yet'}</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(conv => `
      <div class="conversation-item ${this.currentChat === conv.id ? 'active' : ''}" 
           data-user-id="${encodeURIComponent(conv.id)}"
           data-user-name="${encodeURIComponent(conv.name)}">
        <div class="conv-avatar" style="background: ${this.getColorForUser(conv.id)}">
          ${this.getInitials(conv.name)}
        </div>
        <div class="conv-content">
          <div class="conv-header">
            <h4 class="conv-name">${this.escapeHtml(conv.name)}</h4>
            <span class="conv-time">${this.formatTime(conv.lastTime)}</span>
          </div>
          <p class="conv-preview">${this.escapeHtml(conv.lastMessage?.substring(0, 60) || 'No messages')}</p>
        </div>
        <button class="conv-clear-btn" data-clear-user-id="${encodeURIComponent(conv.id)}" data-clear-user-name="${encodeURIComponent(conv.name)}" title="Clear this chat">
          <i class="fas fa-trash"></i>
        </button>
        ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = decodeURIComponent(item.dataset.userId || '');
        const userName = decodeURIComponent(item.dataset.userName || userId);
        this.openConversation(userId, userName);
      });
    });

    list.querySelectorAll('.conv-clear-btn').forEach(btn => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const userId = decodeURIComponent(btn.dataset.clearUserId || '');
        const userName = decodeURIComponent(btn.dataset.clearUserName || userId);
        await this.clearConversationById(userId, userName);
      });
    });
  }

  async openConversation(userId, userName) {
    this.currentChat = userId;
    this.currentChatUser = userName;
    this.currentChatUserRole = this.conversations[userId]?.role || this.currentChatUserRole || null;
    if (this.conversations[userId]) this.conversations[userId].unread = 0;
    await this.loadConversationMessages(userId, userName);
    this.currentChatUserRole = this.conversations[userId]?.role || this.currentChatUserRole || null;
    this.renderConversations();
    this.enterChatView();
  }

  async loadConversationMessages(userId, userName) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = {
        id: userId,
        name: userName || userId,
        role: null,
        messages: [],
        unread: 0,
        lastMessage: null,
        lastTime: null
      };
    }

    try {
      const res = await fetch(`${this.API}/messages/${this.user.user_id}/with/${userId}`);
      const data = await res.json();
      const msgs = Array.isArray(data.messages) ? data.messages : [];

      this.conversations[userId].messages = msgs;
      if (!this.conversations[userId].role && msgs.length) {
        const firstMsg = msgs[0];
        const inferredRole = firstMsg?.sender_id === this.user.user_id ? firstMsg?.recipient_role : firstMsg?.sender_role;
        if (inferredRole) this.conversations[userId].role = inferredRole;
      }
      const last = msgs[msgs.length - 1];
      this.conversations[userId].lastMessage = last?.content || this.conversations[userId].lastMessage;
      this.conversations[userId].lastTime = this.getMessageTimestamp(last) || this.conversations[userId].lastTime;
    } catch (err) {
      this.showToast('Could not load full conversation', 'error');
    }

    this.renderConversation();
  }

  renderConversation() {
    if (!this.currentChat) return;

    const conv = this.conversations[this.currentChat];
    if (!conv) return;
    this.currentChatUserRole = conv.role || this.currentChatUserRole || null;

    const chatArea = document.getElementById('chatArea');
    const messages = conv.messages || [];
    const canRequestPermission = this.canRequestPermission();

    chatArea.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <button class="btn-back-inline-mobile" id="btnBackToList" title="Back to chats">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div class="chat-avatar" style="background: ${this.getColorForUser(this.currentChat)}">
            ${this.getInitials(this.currentChatUser)}
          </div>
          <div>
            <h3>${this.escapeHtml(this.currentChatUser)}</h3>
            <p>${this.escapeHtml(this.currentChat)}</p>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="btn-icon disabled" title="Call unavailable"><i class="fas fa-phone"></i></button>
          <button class="btn-icon" id="btnClearChat" title="Clear chat"><i class="fas fa-trash"></i></button>
          <button class="btn-icon" title="Info"><i class="fas fa-info-circle"></i></button>
        </div>
      </div>

      <div class="messages-container" id="messagesContainer"></div>

      <div class="message-input-area">
        <textarea id="messageInput" placeholder="Type your message…" class="message-input" rows="1"></textarea>
        ${canRequestPermission ? `
        <button class="btn-icon" id="btnPermissionRequest" title="Request Permission" style="display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-file-shield"></i>
        </button>
        ` : ''}
        <button class="btn-send" id="btnSendMessage">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    `;

    this.renderMessages(messages);
    this.attachMessageListeners();

    const btnBackToList = document.getElementById('btnBackToList');
    if (btnBackToList) {
      btnBackToList.addEventListener('click', () => this.exitChatView(true));
    }

    const btnClearChat = document.getElementById('btnClearChat');
    if (btnClearChat) {
      btnClearChat.addEventListener('click', async () => {
        await this.clearCurrentConversation();
      });
    }
  }

  renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!messages || !messages.length) {
      container.innerHTML = `
        <div class="messages-empty">
          <p>No messages yet. Start the conversation! 👋</p>
        </div>
      `;
      return;
    }

    let html = '';
    let lastDate = null;

    messages.forEach((msg, i) => {
      const msgDate = this.getMessageDate(msg);
      const dateLabel = msgDate.toLocaleDateString();

      if (dateLabel !== lastDate) {
        html += `<div class="date-separator"><span>${this.formatDateLabel(this.getMessageTimestamp(msg))}</span></div>`;
        lastDate = dateLabel;
      }

      const isSent = msg.sender_id === this.user.user_id;
      const isPermissionRequest = (msg.message_type || msg.type) === 'permission_request';

      if (isPermissionRequest) {
        // Special rendering for permission requests
        html += `
          <div class="message-group ${isSent ? 'sent' : 'received'}">
            ${!isSent ? `<div class="message-avatar" style="background: ${this.getColorForUser(msg.sender_id)}">${this.getInitials(msg.sender_name || msg.sender_id)}</div>` : ''}
            <div class="message-bubble permission-request-bubble">
              <div class="permission-request-header">
                <i class="fas fa-file-shield"></i>
                <span class="permission-request-title">Permission Request</span>
              </div>
              <div class="permission-request-content">
                ${this.escapeHtml(msg.content)}
              </div>
              <div class="message-meta">
                <span class="message-time">${this.formatMessageTime(this.getMessageTimestamp(msg))}</span>
                ${isSent ? `<span class="message-status"><i class="fas fa-check${msg.is_read ? '-double' : ''}"></i></span>` : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        // Regular message rendering
        html += `
          <div class="message-group ${isSent ? 'sent' : 'received'}">
            ${!isSent ? `<div class="message-avatar" style="background: ${this.getColorForUser(msg.sender_id)}">${this.getInitials(msg.sender_name || msg.sender_id)}</div>` : ''}
            <div class="message-bubble">
              <div class="message-content">${this.escapeHtml(msg.content)}</div>
              <div class="message-meta">
                <span class="message-time">${this.formatMessageTime(this.getMessageTimestamp(msg))}</span>
                ${isSent ? `<span class="message-status"><i class="fas fa-check${msg.is_read ? '-double' : ''}"></i></span>` : ''}
              </div>
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  attachMessageListeners() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('btnSendMessage');
    const permissionBtn = document.getElementById('btnPermissionRequest');

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (permissionBtn) {
      permissionBtn.addEventListener('click', () => this.showPermissionRequestModal());
    }
  }

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input?.value?.trim();

    if (!content || !this.currentChat) return;

    input.value = '';
    input.style.height = 'auto';

    try {
      await fetch(`${this.API}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: this.user.user_id,
          recipient_id: this.currentChat,
          title: 'Direct Message',
          content: content
        })
      });

      const optimisticMessage = {
        sender_id: this.user.user_id,
        sender_name: this.user.name || this.user.user_id,
        recipient_id: this.currentChat,
        recipient_name: this.currentChatUser,
        content,
        created_at: new Date().toISOString(),
        is_read: true
      };

      if (!this.conversations[this.currentChat]) {
        this.conversations[this.currentChat] = {
          id: this.currentChat,
          name: this.currentChatUser,
          messages: [],
          unread: 0,
          lastMessage: null,
          lastTime: null
        };
      }

      this.conversations[this.currentChat].messages.push(optimisticMessage);
      this.conversations[this.currentChat].lastMessage = content;
      this.conversations[this.currentChat].lastTime = optimisticMessage.created_at;
      this.renderConversation();
      this.renderConversations();

      await this.loadConversationMessages(this.currentChat, this.currentChatUser);
      this.showToast('Message sent ✓', 'success');
    } catch (err) {
      console.error('Failed to send message:', err);
      this.showToast('Failed to send message', 'error');
    }
  }

  switchTab(tab) {
    const searchContainer = document.querySelector('.search-container');

    switch (tab) {
      case 'messages':
        this.updateHeaderSubtitle('Messages');
        this.renderConversations();
        if (searchContainer) searchContainer.style.display = 'flex';
        if (!this.currentChat) this.exitChatView(true);
        break;
      case 'alerts':
        this.updateHeaderSubtitle('Alerts');
        this.loadAlerts();
        if (searchContainer) searchContainer.style.display = 'none';
        this.exitChatView(true);
        break;
      case 'assistant':
        this.updateHeaderSubtitle('AI Assistant');
        this.renderAssistant();
        if (searchContainer) searchContainer.style.display = 'none';
        this.enterChatView();
        break;
      case 'broadcast':
        this.updateHeaderSubtitle('Broadcast');
        if (searchContainer) searchContainer.style.display = 'none';
        if (this.isAdmin) {
          this.renderBroadcast();
          this.enterChatView();
        }
        break;
    }
  }

  async loadAlerts() {
    const convList = document.getElementById('convList');
    if (convList) {
      convList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-spinner loading"></i>
          <p>Loading alerts...</p>
        </div>
      `;
    }

    try {
      const res = await fetch(`${this.API}/alerts/pinned/${this.user.user_id}`);
      const data = await res.json();
      const incoming = data.alerts || [];
      this.alerts = incoming.map(alert => ({
        ...alert,
        content: alert.content || alert.message || '',
        priority: this.normalizePriority(alert.priority || alert.type)
      }));

      this.alerts.sort((a, b) => {
        const pa = this.priorityRank(a.priority);
        const pb = this.priorityRank(b.priority);
        if (pa !== pb) return pa - pb;
        return this.getMessageDate(b) - this.getMessageDate(a);
      });
      
      const unread = this.alerts.filter(a => !a.is_read).length;
      const badge = document.getElementById('alertBadge');
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'inline-block' : 'none';
      }

      this.renderAlerts();
    } catch (err) {
      console.error('Failed to load alerts:', err);
      if (convList) {
        convList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <p>Unable to load alerts</p>
          </div>
        `;
      }
    }
  }

  renderAlerts() {
    const convList = document.getElementById('convList');
    if (!this.alerts.length) {
      convList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <p>You're all caught up!</p>
        </div>
      `;
      return;
    }

    convList.innerHTML = `
      <div class="alerts-toolbar">
        <button class="btn-secondary alerts-clear-all" id="btnClearAllAlerts">
          <i class="fas fa-trash"></i>
          <span>Clear All</span>
        </button>
      </div>
    ` + this.alerts.map((alert, idx) => `
      <div class="alert-item" data-alert-index="${idx}">
        <div class="alert-priority-indicator" style="background: ${this.getPriorityColor(alert.priority)}"></div>
        <div class="alert-content">
          <h4 class="alert-title">${this.escapeHtml(alert.title)}</h4>
          <p class="alert-preview">${this.escapeHtml(alert.content?.substring(0, 60) || '')}</p>
          <span class="alert-time">${this.formatTime(this.getMessageTimestamp(alert))}</span>
        </div>
        ${!alert.is_read ? '<span class="unread-dot"></span>' : ''}
      </div>
    `).join('');

    convList.querySelectorAll('.alert-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = Number(item.dataset.alertIndex);
        const alert = this.alerts[idx];
        if (alert) this.openAlert(alert);
      });
    });

    const btnClearAllAlerts = document.getElementById('btnClearAllAlerts');
    if (btnClearAllAlerts) {
      btnClearAllAlerts.addEventListener('click', async () => {
        await this.clearAllAlerts();
      });
    }
  }

  openAlert(alert) {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
      <div class="alert-viewer">
        <button class="btn-back-inline" onclick="chatInterface.backToAlertsList()">← Back</button>
        <div class="alert-header" style="border-left: 4px solid ${this.getPriorityColor(alert.priority)}">
          <span class="alert-badge" style="background: ${this.getPriorityColor(alert.priority)}">${alert.priority?.toUpperCase()}</span>
          <h2>${this.escapeHtml(alert.title)}</h2>
          <p class="alert-meta">${this.parseTimestamp(this.getMessageTimestamp(alert) || Date.now()).toLocaleString()}</p>
        </div>
        <div class="alert-body">
          ${this.escapeHtml(alert.content)}
        </div>
        <button class="btn-primary" onclick="chatInterface.dismissAlert('${alert.alert_id}')">Dismiss</button>
      </div>
    `;

    this.enterChatView();
  }

  backToAlertsList() {
    this.loadAlerts();
    this.exitChatView(false);
  }

  async dismissAlert(alertId) {
    try {
      await fetch(`${this.API}/alerts/${alertId}/unpin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id })
      });
      this.loadAlerts();
      this.showToast('Alert dismissed', 'success');
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  }

  async clearAllAlerts() {
    const ok = confirm('Clear all existing alerts from your list?');
    if (!ok) return;

    try {
      const res = await fetch(`${this.API}/alerts/clear_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id })
      });

      if (!res.ok) throw new Error('Failed');

      this.alerts = [];
      await this.loadAlerts();
      this.showToast('All alerts cleared', 'success');
    } catch (err) {
      this.showToast('Failed to clear alerts', 'error');
    }
  }

  renderAssistant() {
    const convList = document.getElementById('convList');
    const chatArea = document.getElementById('chatArea');

    convList.innerHTML = `
      <div class="ai-topics">
        <h4>Quick Topics</h4>
        <button class="topic-btn" onclick="chatInterface.askAI('How do I check in?')">📸 How to check in?</button>
        <button class="topic-btn" onclick="chatInterface.askAI('What is the late policy?')">⏰ Late policy</button>
        <button class="topic-btn" onclick="chatInterface.askAI('How to apply for leave?')">🏖️ Apply leave</button>
        <button class="topic-btn" onclick="chatInterface.askAI('What are my stats?')">📊 My stats</button>
      </div>
    `;

    chatArea.innerHTML = `
      <div class="ai-chat">
        <div class="ai-welcome">
          <div class="ai-icon">🤖</div>
          <h3>Hello ${this.getFirstName()}!</h3>
          <p>I'm your FaceAttend assistant. Ask me about attendance, leave, policies, or anything else!</p>
          <div class="ai-quick-actions">
            <button class="topic-btn" onclick="chatInterface.askAI('How do I check in?')">📸 How to check in?</button>
            <button class="topic-btn" onclick="chatInterface.askAI('What is the late policy?')">⏰ Late policy</button>
            <button class="topic-btn" onclick="chatInterface.askAI('How to apply for leave?')">🏖️ Apply leave</button>
            <button class="topic-btn" onclick="chatInterface.askAI('What are my stats?')">📊 My stats</button>
          </div>
        </div>
        <div class="ai-messages" id="aiMessages"></div>
        <div class="ai-input">
          <input type="text" id="aiInput" placeholder="Ask me anything…" class="ai-input-field">
          <button class="btn-send" onclick="chatInterface.sendAIMessage()">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;

    document.getElementById('aiInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendAIMessage();
    });
  }

  async sendAIMessage() {
    const input = document.getElementById('aiInput');
    const question = input?.value?.trim();
    if (!question) return;

    const messagesDiv = document.getElementById('aiMessages');
    messagesDiv.innerHTML += `
      <div class="ai-message user">
        <div class="ai-message-content">${this.escapeHtml(question)}</div>
      </div>
    `;

    input.value = '';

    try {
      const res = await fetch(`${this.API}/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id, query: question })
      });

      const data = await res.json();
      const answer = data.response || this.getDefaultAIResponse(question);

      messagesDiv.innerHTML += `
        <div class="ai-message bot">
          <div class="ai-message-content">${this.escapeHtml(answer)}</div>
        </div>
      `;

      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (err) {
      messagesDiv.innerHTML += `
        <div class="ai-message bot error">
          <div class="ai-message-content">Sorry, I couldn't process that. Please try again or contact your admin.</div>
        </div>
      `;
    }
  }

  askAI(question) {
    const aiInput = document.getElementById('aiInput');
    if (aiInput) {
      aiInput.value = question;
      aiInput.focus();
      setTimeout(() => this.sendAIMessage(), 100);
    }
  }

  renderBroadcast() {
    if (!this.isAdmin) return;

    const convList = document.getElementById('convList');
    convList.innerHTML = `
      <div class="broadcast-tips">
        <h4>Broadcasting</h4>
        <p>Send alerts to faculty members across the system.</p>
      </div>
    `;

    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
      <div class="broadcast-form">
        <h3>Send Alert</h3>
        <div class="form-group">
          <label>Priority Level</label>
          <div class="priority-selector">
            <button class="priority-btn info active" data-priority="info" onclick="chatInterface.selectPriority('info', this)">
              ℹ️ Info
            </button>
            <button class="priority-btn warning" data-priority="warning" onclick="chatInterface.selectPriority('warning', this)">
              ⚠️ Warning
            </button>
            <button class="priority-btn critical" data-priority="critical" onclick="chatInterface.selectPriority('critical', this)">
              🚨 Critical
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="alertTitle" placeholder="Alert title" class="input-field" maxlength="100">
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea id="alertMessage" placeholder="Write your message here…" class="message-input" rows="5" maxlength="500"></textarea>
        </div>
        <div class="form-group">
          <label>Recipients</label>
          <input type="text" id="recipientSearchInput" placeholder="Search by ID or name" class="input-field">
          <div class="recipients-list" id="recipientsList">
            <div class="loading">Loading faculty...</div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-secondary" onclick="chatInterface.selectAllRecipients()">
            <i class="fas fa-check-double"></i> Select All
          </button>
          <button class="btn-primary" onclick="chatInterface.sendBroadcast()">
            <i class="fas fa-paper-plane"></i> Send Alert
          </button>
        </div>
      </div>
    `;

    this.loadBroadcastRecipients();

    const recipientSearchInput = document.getElementById('recipientSearchInput');
    if (recipientSearchInput) {
      recipientSearchInput.addEventListener('input', (e) => {
        this.renderBroadcastRecipients(e.target.value.trim().toLowerCase());
      });
    }
  }

  selectPriority(priority, btn) {
    this.selectedAlertPriority = priority;
    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  async loadBroadcastRecipients() {
    try {
      const res = await fetch(`${this.API}/users/faculty`);
      const data = await res.json();
      this.broadcastRecipients = data.faculty || [];
      this.renderBroadcastRecipients('');
    } catch (err) {
      console.error('Failed to load recipients:', err);
      document.getElementById('recipientsList').innerHTML = '<div class="error">Failed to load faculty</div>';
    }
  }

  renderBroadcastRecipients(query = '') {
    const list = document.getElementById('recipientsList');
    if (!list) return;

    const normalized = String(query || '').toLowerCase();

    if (!normalized) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-magnifying-glass"></i>
          <p>Search ID/Name to show recipients</p>
        </div>
      `;
      return;
    }

    const filtered = this.broadcastRecipients.filter(f =>
      String(f.user_id || '').toLowerCase().includes(normalized) ||
      String(f.name || '').toLowerCase().includes(normalized)
    );

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><p>No matching recipients</p></div>';
      return;
    }

    list.innerHTML = filtered.map(f => {
      const checked = this.broadcastSelectedRecipients.has(f.user_id) ? 'checked' : '';
      return `
        <label class="recipient-item">
          <input type="checkbox" class="recipient-cb" value="${f.user_id}" data-name="${this.escapeHtml(f.name)}" ${checked}>
          <span class="recipient-name">${this.escapeHtml(f.name)}</span>
          <span class="recipient-id">${this.escapeHtml(f.user_id)}</span>
        </label>
      `;
    }).join('');

    list.querySelectorAll('.recipient-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) this.broadcastSelectedRecipients.add(cb.value);
        else this.broadcastSelectedRecipients.delete(cb.value);
      });
    });
  }

  selectAllRecipients() {
    const searchInput = document.getElementById('recipientSearchInput');
    const query = String(searchInput?.value || '').trim().toLowerCase();

    if (!query) {
      this.showToast('Search first, then select recipients', 'info');
      return;
    }

    const filtered = this.broadcastRecipients.filter(f =>
      String(f.user_id || '').toLowerCase().includes(query) ||
      String(f.name || '').toLowerCase().includes(query)
    );

    const shouldSelectAll = filtered.some(f => !this.broadcastSelectedRecipients.has(f.user_id));
    filtered.forEach(f => {
      if (shouldSelectAll) this.broadcastSelectedRecipients.add(f.user_id);
      else this.broadcastSelectedRecipients.delete(f.user_id);
    });

    this.renderBroadcastRecipients(query);
  }

  async sendBroadcast() {
    const title = document.getElementById('alertTitle')?.value?.trim();
    const message = document.getElementById('alertMessage')?.value?.trim();
    const selected = Array.from(this.broadcastSelectedRecipients);

    if (!title || !message || !selected.length) {
      this.showToast('Please fill all fields and select recipients', 'error');
      return;
    }

    try {
      await Promise.all(selected.map(recipientId =>
        fetch(`${this.API}/admin/alerts/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: this.user.user_id,
            recipient_id: recipientId,
            title: title,
            content: message,
            priority: this.selectedAlertPriority
          })
        })
      ));

      // Mirror one copy to admin so raised alerts are visible in admin alerts as well.
      await fetch(`${this.API}/admin/alerts/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: this.user.user_id,
          recipient_id: this.user.user_id,
          title,
          content: message,
          priority: this.selectedAlertPriority
        })
      });

      document.getElementById('alertTitle').value = '';
      document.getElementById('alertMessage').value = '';
      this.broadcastSelectedRecipients.clear();
      const searchInput = document.getElementById('recipientSearchInput');
      if (searchInput) searchInput.value = '';
      this.renderBroadcastRecipients('');

      this.showToast(`✓ Alert sent to ${selected.length} recipient${selected.length > 1 ? 's' : ''}`, 'success');

      this.activeTab = 'alerts';
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'alerts');
      });
      this.switchTab('alerts');
    } catch (err) {
      console.error('Failed to send broadcast:', err);
      this.showToast('Failed to send alert', 'error');
    }
  }

  async startConversation(userId) {
    const normalizedId = String(userId || '').trim();
    const selected = this.selectedUserForNewConversation;
    const selectedName = (selected && String(selected.user_id) === normalizedId) ? selected.name : null;
    const fallbackUser = (this.allUsers || []).find(u => String(u.user_id) === normalizedId);
    const userName = selectedName || fallbackUser?.name || normalizedId;

    this.conversations[normalizedId] = {
      id: normalizedId,
      name: userName,
      role: selected?.role || fallbackUser?.role || null,
      messages: [],
      unread: 0,
      lastMessage: null,
      lastTime: null
    };
    
    this.hideAllModals();
    document.getElementById('userIdInput').value = '';
    this.selectedUserForNewConversation = null;
    
    this.openConversation(normalizedId, userName);
    this.renderConversations();
  }

  // Utility Methods
  getColorForUser(userId) {
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#0EA5E9', '#14B8A6'];
    const id = String(userId || 'unknown');
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getInitials(name) {
    return String(name || '?')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getFirstName() {
    return this.user.name?.split(' ')[0] || 'there';
  }

  canRequestPermission() {
    return this.user?.role === 'faculty' && String(this.currentChatUserRole || '').toLowerCase() === 'admin';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  formatTime(timestamp) {
    const date = this.parseTimestamp(timestamp);
    if (!timestamp || Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString();
  }

  formatMessageTime(timestamp) {
    const date = this.parseTimestamp(timestamp);
    if (!timestamp || Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDateLabel(timestamp) {
    const date = this.parseTimestamp(timestamp);
    if (!timestamp || Number.isNaN(date.getTime())) return 'Unknown';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  getPriorityColor(priority) {
    const colors = {
      critical: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6'
    };
    return colors[priority] || colors.info;
  }

  normalizePriority(priority) {
    const raw = String(priority || '').toLowerCase();
    if (raw.includes('critical') || raw.includes('danger') || raw.includes('urgent')) return 'critical';
    if (raw.includes('warning') || raw.includes('warn')) return 'warning';
    return 'info';
  }

  priorityRank(priority) {
    const p = this.normalizePriority(priority);
    if (p === 'critical') return 0;
    if (p === 'warning') return 1;
    return 2;
  }

  getMessageTimestamp(msg) {
    if (!msg) return null;
    return msg.timestamp || msg.created_at || msg.time || null;
  }

  parseTimestamp(ts) {
    if (!ts) return new Date(0);
    if (typeof ts === 'string') {
      const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(ts);
      const normalized = hasZone ? ts : `${ts}Z`;
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  getMessageDate(msg) {
    const ts = this.getMessageTimestamp(msg);
    return this.parseTimestamp(ts);
  }

  getDefaultAIResponse(question) {
    const lq = question.toLowerCase();
    if (lq.includes('check')) return 'To check in, tap the Face Scan button on your dashboard, ensure you\'re within campus bounds, and hold your face steady for 2-3 seconds.';
    if (lq.includes('late')) return 'Late arrivals are marked if you check in more than 15 minutes after your scheduled time. You can request a late permission through the dashboard.';
    if (lq.includes('leave')) return 'To apply for leave, go to Leave Management on your dashboard, select the type and dates, add a reason, and submit for admin approval.';
    if (lq.includes('stat')) return 'Your attendance statistics are on your Personal Dashboard, including present days, lates, early exits, and monthly summaries.';
    return 'That\'s a great question! For more detailed information, please contact your administrator through the Messages tab.';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    }, 50);
  }

  // Permission Request Methods
  showPermissionRequestModal() {
    if (!this.canRequestPermission()) {
      this.showToast('Permission requests are only available in faculty-to-admin chats.', 'error');
      return;
    }
    this.showModal('permissionRequestModal');
    this.attachPermissionFormListeners();
  }

  attachPermissionFormListeners() {
    const permissionType = document.getElementById('permissionType');
    const customTypeGroup = document.getElementById('customTypeGroup');
    const customDaysGroup = document.getElementById('customDaysGroup');
    const timeRangeGroup = document.getElementById('timeRangeGroup');
    const permissionFullDay = document.getElementById('permissionFullDay');
    const fileInput = document.getElementById('permissionDocument');
    const fileName = document.getElementById('fileName');
    const btnSubmit = document.getElementById('btnSubmitPermission');

    // Show/hide custom type input
    if (permissionType) {
      permissionType.addEventListener('change', (e) => {
        const showCustom = e.target.value === 'custom';
        const showTimeRange = e.target.value === 'late_arrival' || e.target.value === 'early_departure' || e.target.value === 'half_day';
        
        if (customTypeGroup) customTypeGroup.style.display = showCustom ? 'block' : 'none';
        if (customDaysGroup) customDaysGroup.style.display = showCustom ? 'block' : 'none';
        if (timeRangeGroup) timeRangeGroup.style.display = showTimeRange ? 'block' : 'none';
      });
    }

    // File upload display
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (fileName) {
          fileName.textContent = file ? `📎 ${file.name}` : '';
          fileName.style.display = file ? 'inline-block' : 'none';
        }
      });
    }

    // Submit button
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitPermissionRequest());
    }

    // Set today's date as default
    const dateInput = document.getElementById('permissionDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.min = today;
    }
  }

  async submitPermissionRequest() {
    if (!this.canRequestPermission()) {
      this.showToast('Permission requests can only be raised by faculty to admins.', 'error');
      return;
    }

    const permissionType = document.getElementById('permissionType')?.value?.trim();
    const customType = document.getElementById('customType')?.value?.trim();
    const customDaysCount = document.getElementById('customDaysCount')?.value?.trim();
    const permissionDate = document.getElementById('permissionDate')?.value;
    const startTime = document.getElementById('startTime')?.value;
    const endTime = document.getElementById('endTime')?.value;
    const reason = document.getElementById('permissionReason')?.value?.trim();
    const fileInput = document.getElementById('permissionDocument');
    const fullDay = document.getElementById('permissionFullDay')?.checked;

    // Validation
    if (!permissionType) {
      this.showToast('Please select a permission type', 'error');
      return;
    }

    if (permissionType === 'custom' && !customType) {
      this.showToast('Please describe your custom request', 'error');
      return;
    }

    if (permissionType === 'custom' && (!customDaysCount || Number(customDaysCount) < 1)) {
      this.showToast('Please enter how many days you want', 'error');
      return;
    }

    if (!permissionDate) {
      this.showToast('Please select a date', 'error');
      return;
    }

    if (!reason) {
      this.showToast('Please provide a reason/description', 'error');
      return;
    }

    if ((permissionType === 'late_arrival' || permissionType === 'early_departure' || permissionType === 'half_day') && !fullDay) {
      if (!startTime || !endTime) {
        this.showToast('Please select start and end times', 'error');
        return;
      }
    }

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('user_id', this.user.user_id);
      formData.append('type', permissionType === 'custom' ? 'custom' : permissionType);
      formData.append('custom_type', customType || '');
      formData.append('custom_days_count', permissionType === 'custom' ? (customDaysCount || '1') : '');
      formData.append('date', permissionDate);
      formData.append('start_time', startTime || '');
      formData.append('end_time', endTime || '');
      formData.append('is_full_day', fullDay ? 'true' : 'false');
      formData.append('reason', reason);
      formData.append('recipient_id', this.currentChat); // Admin ID

      // Add file if present
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
          this.showToast('File size exceeds 5MB', 'error');
          return;
        }
        formData.append('document', file);
      }

      // Submit to backend
      const res = await fetch(`${this.API}/permissions/request`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit request');
      }

      // Add permission request to chat as a special message
      const permissionMessage = {
        sender_id: this.user.user_id,
        sender_name: this.user.name || this.user.user_id,
        recipient_id: this.currentChat,
        recipient_name: this.currentChatUser,
        content: `📋 **Permission Request Submitted**\n\nType: ${permissionType === 'custom' ? customType : permissionType.replace(/_/g, ' ').toUpperCase()}\nDate: ${permissionDate}${permissionType === 'custom' ? `\nDays: ${customDaysCount}` : ''}\nReason: ${reason}`,
        created_at: new Date().toISOString(),
        is_read: true,
        message_type: 'permission_request',
        permission_id: data.permission_id
      };

      if (!this.conversations[this.currentChat]) {
        this.conversations[this.currentChat] = {
          id: this.currentChat,
          name: this.currentChatUser,
          messages: [],
          unread: 0,
          lastMessage: null,
          lastTime: null
        };
      }

      this.conversations[this.currentChat].messages.push(permissionMessage);
      this.conversations[this.currentChat].role = this.currentChatUserRole || this.conversations[this.currentChat].role || null;
      this.renderConversation();
      this.renderConversations();

      this.hideAllModals();
      this.showToast('Permission request submitted successfully! ✓', 'success');

      // Reset form
      document.getElementById('permissionForm').reset();
      document.getElementById('customTypeGroup').style.display = 'none';
      const customDaysGroup = document.getElementById('customDaysGroup');
      if (customDaysGroup) customDaysGroup.style.display = 'none';
      document.getElementById('timeRangeGroup').style.display = 'none';
      document.getElementById('fileName').textContent = '';

    } catch (err) {
      console.error('Failed to submit permission request:', err);
      this.showToast(err.message || 'Failed to submit request', 'error');
    }
  }

  showModal(id) {
    const modal = document.getElementById(id);
    const overlay = document.getElementById('modalOverlay');
    if (!modal || !overlay) return;

    modal.classList.add('show');
    overlay.classList.add('show');

    if (id === 'newMessageModal') {
      const input = document.getElementById('userIdInput');
      if (input) {
        input.value = '';
        this.selectedUserForNewConversation = null;
        this.hideUserSuggestions();
        setTimeout(() => input.focus(), 0);
      }
    }
  }

  hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  toggleHeaderMenu() {
    const menu = document.getElementById('headerMenu');
    if (!menu) return;
    this.headerMenuOpen = !this.headerMenuOpen;
    menu.classList.toggle('show', this.headerMenuOpen);
  }

  hideHeaderMenu() {
    const menu = document.getElementById('headerMenu');
    if (!menu) return;
    this.headerMenuOpen = false;
    menu.classList.remove('show');
  }

  async clearCurrentConversation() {
    if (!this.currentChat) {
      this.showToast('Open a chat first', 'info');
      return;
    }

    const ok = confirm(`Clear chat with ${this.currentChatUser}?`);
    if (!ok) return;

    await this.clearConversationById(this.currentChat, this.currentChatUser, true);
  }

  async clearConversationById(userId, userName, fromOpenChat = false) {
    const ok = confirm(`Clear chat with ${userName || userId}?`);
    if (!ok) return;

    try {
      const res = await fetch(`${this.API}/messages/${this.user.user_id}/with/${userId}`);
      const data = await res.json();
      const msgs = Array.isArray(data.messages) ? data.messages : [];

      await Promise.all(msgs.map(msg =>
        fetch(`${this.API}/messages/${msg.id}`, { method: 'DELETE' })
      ));

      if (this.conversations[userId]) {
        this.conversations[userId].messages = [];
        this.conversations[userId].lastMessage = null;
        this.conversations[userId].lastTime = null;
      }

      if (fromOpenChat || this.currentChat === userId) {
        this.renderConversation();
      }

      await this.loadConversations();
      this.showToast('Chat cleared', 'success');
    } catch (err) {
      this.showToast('Failed to clear chat', 'error');
    }
  }

  updateHeaderSubtitle(text) {
    const subtitle = document.getElementById('headerSubtitle');
    if (subtitle) subtitle.textContent = text;
  }

  enterChatView() {
    if (!this.isMobileView) return;

    const panel = document.getElementById('convPanel');
    const area = document.getElementById('chatArea');
    if (panel) panel.classList.add('hidden');
    if (area) area.classList.add('active');
  }

  exitChatView(clearConversation = false) {
    const panel = document.getElementById('convPanel');
    const area = document.getElementById('chatArea');

    if (this.isMobileView) {
      if (panel) panel.classList.remove('hidden');
      if (area) area.classList.remove('active');
    }

    if (clearConversation) {
      this.currentChat = null;
      this.currentChatUser = null;
      if (area && this.activeTab === 'messages') {
        area.innerHTML = `
          <div class="chat-empty">
            <div class="empty-illustration">
              <i class="fas fa-comments"></i>
            </div>
            <h2>Select a conversation</h2>
            <p>Choose from your messages to get started</p>
          </div>
        `;
      }
      this.renderConversations();
    }
  }

  handleBackAction() {
    const area = document.getElementById('chatArea');
    const isInChatView = this.isMobileView && area?.classList.contains('active');

    if (isInChatView) {
      if (this.activeTab === 'messages') {
        this.exitChatView(true);
      } else {
        this.activeTab = 'messages';
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === 'messages');
        });
        this.switchTab('messages');
      }
      return;
    }

    this.goBack();
  }

  goBack() {
    const dashboard = this.user?.role === 'admin' ? 'admin_dashboard.html' : 'faculty_dashboard.html';
    window.location.href = `./${dashboard}`;
  }

  showSessionExpired() {
    document.body.innerHTML = `
      <div class="session-expired">
        <i class="fas fa-lock"></i>
        <h2>Session Expired</h2>
        <p>Please log in to continue</p>
        <button class="btn-primary" onclick="window.location.href='./login.html'">Back to Login</button>
      </div>
    `;
  }

  startPolling() {
    this.pollInterval = setInterval(async () => {
      if (this.activeTab === 'alerts') {
        await this.loadAlerts();
      } else if (this.activeTab === 'messages') {
        await this.loadConversations();
      }
    }, 15000);
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  window.chatInterface = new ChatInterface();
});
