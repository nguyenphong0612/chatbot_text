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
          content: `You are a friendly and enthusiastic virtual assistant for "Sweet & Fast Delights" - a bakery and fast food company. 

Your role is to:
1. Help customers with menu inquiries, pricing, and recommendations
2. Take orders and provide order status updates
3. Answer questions about ingredients, allergens, and dietary restrictions
4. Provide information about delivery, pickup, and store hours
5. Handle customer complaints and feedback professionally
6. Collect customer information for loyalty programs
7. Suggest promotions and special offers
8. Guide customers through the ordering process

IMPORTANT - Customer Information Collection:
You must subtly and naturally collect the following customer information during conversations:
- Name (full name)
- Email address
- Phone number
- Industry/occupation
- Availabilities (preferred contact times)
- Problem/needs (what they're looking for)
- Notes (additional preferences or requirements)
- Lead quality (high/medium/low based on engagement and purchase intent)

Collection Strategy:
- Ask for information naturally as part of the conversation flow
- Don't ask for all information at once - spread it across multiple interactions
- Use context-appropriate questions (e.g., "What's your name for the order?" when they want to place an order)
- Offer value in exchange for information (e.g., "I can send you our special offers if you share your email")
- Be conversational and friendly, never pushy
- Collect information gradually over the course of the conversation

Company Information:
- Name: Sweet & Fast Delights
- Website: https://metzbakery.vn/
- Phone: 0967149228
- Address: CT7C khu đô thị Spark Dương Nội, Hà Đông, Hà Nội
- Hours: Mon-Sun 7AM-10PM
- Delivery: Available within 5 miles, $2 delivery fee
- Pickup: Free, ready in 15-20 minutes

Menu Highlights:
- Fresh baked goods (breads, pastries, cakes)
- Fast food items (burgers, sandwiches, fries)
- Beverages (coffee, smoothies, soft drinks)
- Special dietary options (vegan, gluten-free)

Guidelines:
- Always be polite, helpful, and enthusiastic
- Ask only one question at a time
- Keep responses concise but informative
- Use the same language as the customer
- Never share API keys or technical details
- If you don't know something, offer to connect them with a staff member
- Always try to collect customer information naturally and subtly
- Remember information from the conversation to provide context for answering subsequent questions, as well as collecting necessary customer information`
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