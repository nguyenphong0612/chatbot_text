const db = require('../lib/database');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        // Lấy conversation theo ID hoặc tất cả conversations
        const { id } = req.query;
        
        if (id) {
          // Lấy conversation cụ thể với user info
          const conversationData = await db.getConversationWithUserInfo(id);
          res.status(200).json({ 
            success: true, 
            conversation: conversationData.conversation,
            user_info: conversationData.user_info
          });
        } else {
          // Lấy tất cả conversations
          const conversations = await db.getAllConversations();
          res.status(200).json({ 
            success: true, 
            conversations,
            count: conversations.length
          });
        }
        break;

      case 'POST':
        // Tạo conversation mới
        const { user_info } = req.body;
        const newConversation = await db.createConversation();
        
        // Lưu thông tin user nếu có
        if (user_info) {
          await db.saveUserInfo(newConversation.conversation_id, user_info);
        }
        
        res.status(201).json({ 
          success: true, 
          conversation: newConversation
        });
        break;

      case 'PUT':
        // Cập nhật thông tin user
        const { conversation_id, user_info: update_user_info } = req.body;
        
        if (!conversation_id) {
          return res.status(400).json({ error: 'conversation_id is required' });
        }

        if (!update_user_info) {
          return res.status(400).json({ error: 'user_info is required' });
        }

        const updatedUserInfo = await db.updateUserInfo(conversation_id, update_user_info);
        res.status(200).json({ 
          success: true, 
          user_info: updatedUserInfo
        });
        break;

      case 'DELETE':
        // Xóa conversation
        const { conversation_id: delete_id } = req.body;
        
        if (!delete_id) {
          return res.status(400).json({ error: 'conversation_id is required' });
        }

        await db.deleteConversation(delete_id);
        res.status(200).json({ 
          success: true, 
          message: 'Conversation deleted successfully'
        });
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in conversation API:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}; 