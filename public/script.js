class ChatbotText2Text {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatForm = document.getElementById('chatForm');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.sendToWebhookBtn = document.getElementById('sendToWebhookBtn');
        this.webhookStatus = document.getElementById('webhookStatus');
        
        this.isTyping = false;
        this.conversationHistory = [];
        this.autoScroll = true;
        this.currentConversationId = null; // Để backend tự tạo
        
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
        
        // Ensure proper scroll behavior
        this.chatMessages.addEventListener('scroll', () => {
            // If user scrolls up, don't auto-scroll to bottom
            const isAtBottom = this.chatMessages.scrollTop + this.chatMessages.clientHeight >= this.chatMessages.scrollHeight - 10;
            if (isAtBottom) {
                this.autoScroll = true;
            } else {
                this.autoScroll = false;
            }
        });
        
        // Webhook button click
        this.sendToWebhookBtn.addEventListener('click', () => {
            this.sendToWebhook();
        });
    }
    
    ensureInputVisible() {
        // Force ensure input container is visible
        const inputContainer = document.querySelector('.chat-input-container');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        if (inputContainer) {
            inputContainer.style.display = 'block';
            inputContainer.style.visibility = 'visible';
            inputContainer.style.position = 'relative';
            inputContainer.style.zIndex = '1000';
        }
        
        if (messageInput) {
            messageInput.style.display = 'block';
            messageInput.style.visibility = 'visible';
        }
        
        if (sendButton) {
            sendButton.style.display = 'flex';
            sendButton.style.visibility = 'visible';
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
                body: JSON.stringify({ 
                    message,
                    conversation_id: this.currentConversationId 
                })
            });
            
            const data = await response.json();
            
                         if (response.ok) {
                 // Add bot response to chat
                 this.addMessage(data.response, 'bot');
                 
                 // Update conversation ID from server (backend tạo)
                 if (data.conversation_id) {
                     this.currentConversationId = data.conversation_id;
                     console.log('Received conversation ID from server:', this.currentConversationId);
                 }
                 
                 // Add to conversation history
                 this.conversationHistory.push(
                     { role: 'user', content: message },
                     { role: 'assistant', content: data.response }
                 );
                 
                 // Send conversation data to webhook (không block nếu lỗi)
                 try {
                     await this.sendToWebhook();
                 } catch (webhookError) {
                     console.warn('Webhook failed but conversation was saved:', webhookError);
                     // Không hiển thị lỗi cho user vì conversation đã được lưu thành công
                 }
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
    
    async sendToWebhook() {
        // Kiểm tra xem có cuộc trò chuyện nào không
        if (this.conversationHistory.length === 0) {
            console.log('No conversation to send to webhook');
            return;
        }
        
        // Cập nhật trạng thái nút nếu có
        if (this.sendToWebhookBtn) {
            this.sendToWebhookBtn.disabled = true;
            this.sendToWebhookBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            this.updateWebhookStatus('Đang gửi...');
        }
        
        try {
            // Chuẩn bị dữ liệu cuộc trò chuyện
            const conversationData = {
                messages: this.conversationHistory,
                timestamp: new Date().toISOString(),
                total_messages: this.conversationHistory.length,
                conversation_id: this.currentConversationId
            };
            
            console.log('Sending to webhook:', conversationData);
            
            // Gửi đến webhook
            const webhookResponse = await fetch('/api/webhook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    conversation_data: conversationData 
                })
            });
            
            const webhookData = await webhookResponse.json();
            
            if (webhookResponse.ok && webhookData.success) {
                console.log('✅ Webhook success:', webhookData);
                
                // Hiển thị thông báo thành công
                if (this.sendToWebhookBtn) {
                    this.showWebhookStatus('Đã lưu cuộc trò chuyện', 'success');
                    this.updateWebhookStatus('Đã lưu');
                    
                    // Reset nút sau 2 giây
                    setTimeout(() => {
                        this.resetWebhookButton();
                    }, 2000);
                }
                
            } else {
                console.error('❌ Webhook error:', webhookData.error);
                if (this.sendToWebhookBtn) {
                    this.showWebhookStatus('Lỗi khi lưu cuộc trò chuyện', 'error');
                    this.updateWebhookStatus('Lỗi');
                    this.resetWebhookButton();
                }
            }
            
        } catch (error) {
            console.error('❌ Webhook connection error:', error);
            if (this.sendToWebhookBtn) {
                this.showWebhookStatus('Không thể kết nối webhook', 'error');
                this.updateWebhookStatus('Lỗi kết nối');
                this.resetWebhookButton();
            }
        }
    }
    
    updateWebhookStatus(text) {
        if (this.webhookStatus) {
            this.webhookStatus.textContent = text;
        }
    }
    
    resetWebhookButton() {
        this.sendToWebhookBtn.disabled = false;
        this.sendToWebhookBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
    }
    
    showWebhookStatus(message, type) {
        // Tạo thông báo tạm thời
        const statusDiv = document.createElement('div');
        statusDiv.className = `webhook-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(statusDiv);
        
        // Tự động ẩn sau 3 giây
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 3000);
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
        
        // Ensure input is visible after adding message
        setTimeout(() => {
            this.ensureInputVisible();
        }, 50);
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
        if (!this.autoScroll) return;
        
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
        
        // Double check after a longer delay
        setTimeout(() => {
            if (this.autoScroll) {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }, 200);
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
        this.currentConversationId = null; // Reset để backend tạo mới
        console.log('Reset conversation ID, will be created by backend');
        
        // Reset webhook status
        this.updateWebhookStatus('');
        this.resetWebhookButton();
        
        // Add welcome message back
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message bot-message';
        welcomeMessage.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>🍰 Xin chào! Tôi là trợ lý đặt hàng của Sweet & Fast Delights! Tôi có thể giúp bạn:</p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>📋 Xem menu và giá cả</li>
                    <li>🍔 Đặt hàng online</li>
                    <li>🚚 Tư vấn giao hàng</li>
                    <li>⏰ Kiểm tra giờ mở cửa</li>
                    <li>🎁 Thông tin khuyến mãi</li>
                </ul>
                <p>Bạn cần tôi giúp gì hôm nay?</p>
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