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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a friendly virtual assistant for "Sweet & Fast Delights" bakery and fast food company.

ROLES: Help with menu, orders, delivery info, complaints, and collect customer data.

COLLECT THESE CUSTOMER INFO (subtly):
- Name, Email, Phone, Industry, Availabilities, Problem/needs, Notes, Lead quality

CRITICAL RULES:
1. REMEMBER what you've already collected - NEVER ask twice
2. Ask ONLY ONE question at a time
3. Review conversation history before responding
4. Use collected info to personalize responses
5. Focus on current request if you have basic info

COMPANY: Sweet & Fast Delights | https://metzbakery.vn/ | 0967149228 | CT7C Spark Dương Nội, Hà Đông, Hà Nội | 7AM-10PM | $2 delivery within 5 miles

MENU: Baked goods, fast food, beverages, vegan/gluten-free options

GUIDELINES: Be polite, use customer's language, keep responses concise, collect info naturally, remember conversation context.`
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