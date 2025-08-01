const OpenAI = require('openai');
const db = require('../lib/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversation_id, user_info } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập tin nhắn' });
    }

    // Tạo conversation mới nếu chưa có
    let currentConversationId = conversation_id;
    if (!currentConversationId) {
      const newConversation = await db.createConversation();
      currentConversationId = newConversation.conversation_id;
      
      // Lưu thông tin user nếu có
      if (user_info) {
        await db.saveUserInfo(currentConversationId, user_info);
      }
    }

    // Lưu user message vào database
    await db.addMessage(currentConversationId, {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Bạn là một trợ lý AI thân thiện và hữu ích. Hãy trả lời bằng tiếng Việt một cách tự nhiên và dễ hiểu."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const botResponse = completion.choices[0].message.content;
    
    // Lưu bot response vào database
    await db.addMessage(currentConversationId, {
      role: 'assistant',
      content: botResponse,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({ 
      response: botResponse,
      conversation_id: currentConversationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Lỗi OpenAI:', error);
    
    let errorMessage = 'Có lỗi xảy ra khi xử lý yêu cầu';
    
    if (error.status === 401) {
      errorMessage = 'API key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.';
    } else if (error.status === 429) {
      errorMessage = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server OpenAI. Vui lòng thử lại sau.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
}; 