const supabase = require('./supabase');

class DatabaseService {
  // Tạo conversation mới
  async createConversation() {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert([
          {
            content: []
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Lấy conversation theo ID
  async getConversation(conversationId) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }

  // Lấy tất cả conversations
  async getAllConversations() {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  // Thêm message vào conversation (cập nhật content JSONB)
  async addMessage(conversationId, message) {
    try {
      // Lấy conversation hiện tại
      const { data: currentConversation, error: getError } = await supabase
        .from('conversations')
        .select('content')
        .eq('conversation_id', conversationId)
        .single();

      if (getError) throw getError;

      // Thêm message mới vào content array
      const updatedContent = [...(currentConversation.content || []), {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || new Date().toISOString()
      }];

      // Cập nhật conversation với content mới
      const { data, error } = await supabase
        .from('conversations')
        .update({ content: updatedContent })
        .eq('conversation_id', conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  // Lưu thông tin user
  async saveUserInfo(conversationId, userInfo) {
    try {
      const { data, error } = await supabase
        .from('info_user')
        .insert([
          {
            conversation_id: conversationId,
            name: userInfo.name,
            email: userInfo.email,
            phone_number: userInfo.phone_number,
            company: userInfo.company,
            position: userInfo.position,
            lead_quality: userInfo.lead_quality || 3
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving user info:', error);
      throw error;
    }
  }

  // Cập nhật thông tin user
  async updateUserInfo(conversationId, userInfo) {
    try {
      const { data, error } = await supabase
        .from('info_user')
        .update({
          name: userInfo.name,
          email: userInfo.email,
          phone_number: userInfo.phone_number,
          company: userInfo.company,
          position: userInfo.position,
          lead_quality: userInfo.lead_quality,
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user info:', error);
      throw error;
    }
  }

  // Lấy thông tin user theo conversation_id
  async getUserInfo(conversationId) {
    try {
      const { data, error } = await supabase
        .from('info_user')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  }

  // Lấy tất cả user info
  async getAllUserInfo() {
    try {
      const { data, error } = await supabase
        .from('info_user')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting all user info:', error);
      throw error;
    }
  }

  // Lấy thống kê
  async getStatistics() {
    try {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('conversation_id, created_at, content');

      if (convError) throw convError;

      const { data: users, error: userError } = await supabase
        .from('info_user')
        .select('id, created_at, lead_quality');

      if (userError) throw userError;

      // Tính tổng số messages từ content JSONB
      const totalMessages = conversations.reduce((total, conv) => {
        return total + (conv.content ? conv.content.length : 0);
      }, 0);

      return {
        total_conversations: conversations.length,
        total_users: users.length,
        total_messages: totalMessages,
        conversations_today: conversations.filter(c => {
          const today = new Date().toDateString();
          return new Date(c.created_at).toDateString() === today;
        }).length,
        users_today: users.filter(u => {
          const today = new Date().toDateString();
          return new Date(u.created_at).toDateString() === today;
        }).length,
        average_lead_quality: users.length > 0 ? 
          users.reduce((sum, user) => sum + (user.lead_quality || 0), 0) / users.length : 0
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }

  // Xóa conversation và user info liên quan
  async deleteConversation(conversationId) {
    try {
      // Xóa conversation (sẽ tự động xóa user info do CASCADE)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('conversation_id', conversationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Lấy conversation với user info
  async getConversationWithUserInfo(conversationId) {
    try {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (convError) throw convError;

      const { data: userInfo, error: userError } = await supabase
        .from('info_user')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      return {
        conversation,
        user_info: userInfo || null
      };
    } catch (error) {
      console.error('Error getting conversation with user info:', error);
      throw error;
    }
  }

  // Tạo đơn hàng mới
  async createOrder(orderData) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Lấy đơn hàng theo ID
  async getOrder(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  }

  // Cập nhật trạng thái đơn hàng
  async updateOrderStatus(orderId, status) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Lấy tất cả đơn hàng
  async getAllOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting all orders:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService(); 