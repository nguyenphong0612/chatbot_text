const OpenAI = require('openai');
const db = require('../lib/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
    const { conversation_id } = req.body;
    
    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    // Lấy conversation với content
    const conversationData = await db.getConversationWithUserInfo(conversation_id);
    
    if (!conversationData.conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { content } = conversationData.conversation;
    
    if (!content || content.length === 0) {
      return res.status(400).json({ error: 'No messages found in conversation' });
    }

    // Tạo prompt để phân tích
    const messagesText = content.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    
    const analysisPrompt = `
Phân tích cuộc trò chuyện sau và trả về kết quả dưới dạng JSON:

Cuộc trò chuyện:
${messagesText}

Yêu cầu phân tích:
1. Trích xuất thông tin user (nếu có):
   - name: tên người dùng
   - email: email người dùng  
   - phone_number: số điện thoại
   - company: công ty (nếu có)
   - position: chức vụ (nếu có)

2. Đánh giá chất lượng lead (lead_quality):
   - "good": Khách hàng tiềm năng cao, có nhu cầu rõ ràng, sẵn sàng mua
   - "ok": Khách hàng có quan tâm nhưng chưa quyết định
   - "spam": Không phải khách hàng tiềm năng, spam, hoặc không liên quan

3. Lý do đánh giá (reason): Giải thích ngắn gọn tại sao đánh giá như vậy

Trả về JSON format:
{
  "user_info": {
    "name": "string hoặc null",
    "email": "string hoặc null", 
    "phone_number": "string hoặc null",
    "company": "string hoặc null",
    "position": "string hoặc null"
  },
  "lead_quality": "good|ok|spam",
  "reason": "string"
}
`;

    // Gọi OpenAI để phân tích
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Bạn là một AI chuyên phân tích cuộc trò chuyện và đánh giá chất lượng khách hàng. Hãy trả về kết quả dưới dạng JSON chính xác."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const analysisResult = completion.choices[0].message.content;
    
    // Parse JSON result
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysisResult);
    } catch (parseError) {
      console.error('Error parsing analysis result:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse analysis result',
        raw_result: analysisResult
      });
    }

    // Cập nhật user info nếu có thông tin mới
    if (parsedAnalysis.user_info) {
      const existingUserInfo = conversationData.user_info;
      const updatedUserInfo = {
        ...existingUserInfo,
        ...parsedAnalysis.user_info
      };

      // Loại bỏ các giá trị null
      Object.keys(updatedUserInfo).forEach(key => {
        if (updatedUserInfo[key] === null || updatedUserInfo[key] === '') {
          delete updatedUserInfo[key];
        }
      });

      // Cập nhật lead_quality
      if (parsedAnalysis.lead_quality) {
        const leadQualityMap = {
          'good': 5,
          'ok': 3,
          'spam': 1
        };
        updatedUserInfo.lead_quality = leadQualityMap[parsedAnalysis.lead_quality] || 3;
      }

      // Lưu hoặc cập nhật user info
      if (existingUserInfo) {
        await db.updateUserInfo(conversation_id, updatedUserInfo);
      } else {
        await db.saveUserInfo(conversation_id, updatedUserInfo);
      }
    }

    res.status(200).json({
      success: true,
      analysis: parsedAnalysis,
      conversation_id: conversation_id
    });

  } catch (error) {
    console.error('Error in analyze API:', error);
    
    let errorMessage = 'Có lỗi xảy ra khi phân tích';
    
    if (error.status === 401) {
      errorMessage = 'API key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.';
    } else if (error.status === 429) {
      errorMessage = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server OpenAI. Vui lòng thử lại sau.';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: error.message 
    });
  }
}; 