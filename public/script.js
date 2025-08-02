class ChatbotText2Text {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatForm = document.getElementById('chatForm');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        this.isTyping = false;
        this.conversationHistory = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkServerStatus();
        this.autoResizeTextarea();
    }
    
    setupEventListeners() {
        // Form submit
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Enter key to send (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto resize textarea
        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
        
        // Ensure input is visible when clicking anywhere in chat
        this.chatMessages.addEventListener('click', () => {
            this.ensureInputVisible();
        });
    }
    
    ensureInputVisible() {
        // Force ensure input container is visible
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer) {
            inputContainer.style.display = 'block';
            inputContainer.style.visibility = 'visible';
        }
    }
    
    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }
    
    async checkServerStatus() {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                this.updateStatus('Đã kết nối', 'connected');
            } else {
                this.updateStatus('Lỗi kết nối', 'error');
            }
        } catch (error) {
            this.updateStatus('Không thể kết nối', 'error');
        }
    }
    
    updateStatus(text, status) {
        const statusText = this.statusIndicator.querySelector('.status-text');
        const statusDot = this.statusIndicator.querySelector('.status-dot');
        
        statusText.textContent = text;
        
        // Remove existing status classes
        statusDot.classList.remove('connected', 'error', 'connecting');
        
        // Add new status class
        statusDot.classList.add(status);
        
        // Update dot color based on status
        if (status === 'connected') {
            statusDot.style.background = '#4CAF50';
        } else if (status === 'error') {
            statusDot.style.background = '#f44336';
        } else {
            statusDot.style.background = '#ff9800';
        }
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || this.isTyping) {
            return;
        }
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Clear input
        this.messageInput.value = '';
        this.autoResizeTextarea();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send message to server
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Add bot response to chat
                this.addMessage(data.response, 'bot');
                
                // Add to conversation history
                this.conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: data.response }
                );
            } else {
                this.addErrorMessage(data.error || 'Có lỗi xảy ra khi xử lý tin nhắn');
            }
            
        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
            this.addErrorMessage('Không thể kết nối đến server. Vui lòng thử lại sau.');
        } finally {
            this.hideTypingIndicator();
        }
    }
    
    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (sender === 'bot') {
            avatar.innerHTML = '<i class="fas fa-robot"></i>';
        } else {
            avatar.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const messageText = document.createElement('p');
        messageText.textContent = content;
        messageContent.appendChild(messageText);
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addErrorMessage(errorMessage) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message error-message';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        avatar.style.background = '#f44336';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.style.background = '#ffebee';
        messageContent.style.color = '#c62828';
        
        const messageText = document.createElement('p');
        messageText.textContent = errorMessage;
        messageContent.appendChild(messageText);
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        this.isTyping = true;
        this.typingIndicator.style.display = 'flex';
        this.sendButton.disabled = true;
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.isTyping = false;
        this.typingIndicator.style.display = 'none';
        this.sendButton.disabled = false;
        
        // Focus back to input
        this.messageInput.focus();
    }
    
    scrollToBottom() {
        setTimeout(() => {
            // Force scroll to bottom to ensure input is visible
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            
            // Additional check to ensure input container is visible
            const inputContainer = document.querySelector('.chat-input-container');
            if (inputContainer) {
                inputContainer.style.display = 'block';
                inputContainer.style.visibility = 'visible';
            }
        }, 100);
    }
    
    getCurrentTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    // Method to clear chat
    clearChat() {
        this.chatMessages.innerHTML = '';
        this.conversationHistory = [];
        
        // Add welcome message back
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message bot-message';
        welcomeMessage.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>Xin chào! Tôi là Chatbot Text2Text, trợ lý AI của bạn. Tôi có thể giúp bạn trả lời các câu hỏi, giải thích khái niệm, hoặc chỉ đơn giản là trò chuyện. Hãy bắt đầu cuộc trò chuyện bằng cách nhập tin nhắn bên dưới!</p>
            </div>
            <div class="message-time">Bây giờ</div>
        `;
        this.chatMessages.appendChild(welcomeMessage);
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const chatbot = new ChatbotText2Text();
    
    // Add global reference for debugging
    window.chatbot = chatbot;
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to clear chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            chatbot.clearChat();
        }
    });
}); 