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
   - name: tên người dùng (chỉ lấy tên thật, không phải nickname)
   - email: email người dùng (định dạng email hợp lệ)
   - phone_number: số điện thoại (định dạng Việt Nam: 0xxx-xxx-xxxx)
   - company: công ty/ngành nghề (nếu có)
   - position: chức vụ/vị trí (nếu có)

2. Đánh giá chất lượng lead (lead_quality):
   - "good" (5): Khách hàng tiềm năng cao, có nhu cầu rõ ràng, sẵn sàng đặt hàng, cung cấp thông tin liên hệ
   - "ok" (3): Khách hàng có quan tâm, hỏi thông tin nhưng chưa quyết định mua
   - "spam" (1): Không phải khách hàng tiềm năng, spam, test, hoặc không liên quan đến mua hàng

3. Lý do đánh giá (reason): Giải thích ngắn gọn tại sao đánh giá như vậy

4. Nhu cầu chính (main_need): Nhu cầu chính của khách hàng (menu, đặt hàng, giao hàng, khiếu nại, v.v.)

5. Trạng thái cuộc trò chuyện (conversation_status):
   - "active": Cuộc trò chuyện đang diễn ra, khách hàng còn quan tâm
   - "completed": Cuộc trò chuyện đã kết thúc, khách hàng đã được phục vụ
   - "abandoned": Cuộc trò chuyện bị bỏ dở

Lưu ý: Chỉ trích xuất thông tin thực sự được cung cấp, không đoán mò.

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
  "reason": "string",
  "main_need": "string",
  "conversation_status": "active|completed|abandoned"
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

      // Cập nhật conversation status nếu có
      if (parsedAnalysis.conversation_status) {
        try {
          await db.updateConversationStatus(conversation_id, parsedAnalysis.conversation_status);
        } catch (error) {
          console.log('Could not update conversation status:', error.message);
        }
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