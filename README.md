# 🍰 Sweet & Fast Delights - Trợ lý đặt hàng

Hệ thống trợ lý đặt hàng thông minh cho hiệu bánh ngọt và đồ ăn nhanh, sử dụng OpenAI API để tư vấn khách hàng và Supabase để quản lý đơn hàng. Được xây dựng với Node.js, Express và giao diện web hiện đại.

## ✨ Tính năng

### 🍰 Cho khách hàng:
- 💬 Chat real-time với trợ lý AI
- 📋 Xem menu và giá cả
- 🛒 Đặt hàng online
- 🚚 Tư vấn giao hàng
- ⏰ Kiểm tra giờ mở cửa
- 🎁 Thông tin khuyến mãi
- 📱 Giao diện responsive

### 🏪 Cho quản lý:
- 📊 Dashboard quản lý đơn hàng
- 📈 Thống kê doanh thu
- 🔄 Cập nhật trạng thái đơn hàng
- 👥 Quản lý thông tin khách hàng
- 📋 Lịch sử đơn hàng
- 🔔 Thông báo đơn hàng mới

### 🛠️ Kỹ thuật:
- ⚡ Tốc độ phản hồi nhanh
- 🔄 Typing indicator
- 📊 Trạng thái kết nối
- ⌨️ Phím tắt
- 🗑️ Xóa chat
- 🔗 Tích hợp webhook

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js (version 18 trở lên)
- NPM hoặc Yarn
- OpenAI API Key

### Bước 1: Clone và cài đặt dependencies
```bash
# Clone repository (nếu có)
git clone <repository-url>
cd chatbot-text2text

# Cài đặt dependencies
npm install
```

### Bước 2: Cấu hình API Keys
1. Tạo file `.env` trong thư mục gốc:
```bash
cp env.example .env
```

2. Mở file `.env` và thêm các API Keys:
```env
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3000
```

**Lưu ý:** 
- Bạn cần có tài khoản OpenAI và API Key. Đăng ký tại [OpenAI Platform](https://platform.openai.com/)
- Bạn cần có tài khoản Supabase và tạo project. Đăng ký tại [Supabase](https://supabase.com/)

### Bước 2.1: Cấu hình Supabase Database
1. Tạo project mới trên Supabase
2. Vào SQL Editor và chạy script sau để tạo bảng:

```sql
CREATE TABLE conversations (
    conversation_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE info_user (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    name VARCHAR(255),
    email VARCHAR(255),
    phone_number VARCHAR(20),
    company VARCHAR(255),
    position VARCHAR(255),
    lead_quality INTEGER CHECK (lead_quality >= 1 AND lead_quality <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo indexes
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_info_user_conversation_id ON info_user(conversation_id);
CREATE INDEX idx_info_user_email ON info_user(email);
```

3. Lấy URL và Service Role Key từ Settings > API

### Bước 3: Chạy ứng dụng
```bash
# Chạy ở chế độ development (với Vercel dev)
npm run dev

# Hoặc chạy ở chế độ production
npm start
```

### Bước 4: Truy cập ứng dụng
Mở trình duyệt và truy cập: `http://localhost:3000`

## 🚀 Deploy lên Vercel

### Bước 1: Chuẩn bị
1. Đảm bảo code đã được push lên GitHub
2. Có tài khoản Vercel

### Bước 2: Deploy
1. Vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import repository từ GitHub
4. Cấu hình Environment Variables:
   - `OPENAI_API_KEY`: OpenAI API key của bạn
   - `SUPABASE_URL`: Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
5. Click "Deploy"

### Bước 3: Truy cập
Sau khi deploy thành công, Vercel sẽ cung cấp URL để truy cập chatbot.

## 📁 Cấu trúc dự án

```
chatbot-text2text/
├── api/
│   ├── chat.js                    # Chat API endpoint
│   ├── conversation.js            # Conversation management (CRUD)
│   ├── analyze.js                 # AI analysis for user info & lead quality
│   └── health.js                  # Health check endpoint
├── lib/
│   ├── supabase.js                # Supabase client configuration
│   └── database.js                # Database service layer
├── public/
│   ├── index.html                 # Giao diện chính
│   ├── style.css                  # CSS styles
│   └── script.js                  # JavaScript logic
├── package.json                   # Dependencies
├── vercel.json                    # Vercel configuration
├── .env                          # Environment variables (local)
├── env.example                   # Environment template
└── README.md                     # Hướng dẫn
```

## 🔧 API Endpoints

### POST `/api/chat`
Gửi tin nhắn đến chatbot và lưu vào database

**Request:**
```json
{
  "message": "Xin chào, bạn có thể giúp tôi không?",
  "conversation_id": "optional_conversation_id",
  "user_info": {
    "name": "User Name",
    "email": "user@example.com",
    "phone_number": "0123456789",
    "lead_quality": 4
  }
}
```

**Response:**
```json
{
  "response": "Xin chào! Tôi rất vui được giúp đỡ bạn. Bạn cần hỗ trợ gì?",
  "conversation_id": "uuid_conversation_id",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET `/api/conversation`
Lấy tất cả conversations

### GET `/api/conversation?id=[conversation_id]`
Lấy conversation cụ thể với user info

### POST `/api/conversation`
Tạo conversation mới

### PUT `/api/conversation`
Cập nhật thông tin user

### DELETE `/api/conversation`
Xóa conversation

### POST `/api/analyze`
Phân tích conversation và trích xuất thông tin user, đánh giá lead quality

**Request:**
```json
{
  "conversation_id": "uuid_conversation_id"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "user_info": {
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@example.com",
      "phone_number": "0123456789",
      "company": "ABC Company",
      "position": "Manager"
    },
    "lead_quality": "good",
    "reason": "Khách hàng có nhu cầu rõ ràng và sẵn sàng mua sản phẩm"
  },
  "conversation_id": "uuid_conversation_id"
}
```

### GET `/api/health`
Kiểm tra trạng thái server

**Response:**
```json
{
  "status": "OK",
  "message": "Chatbot Text2Text Server đang hoạt động"
}
```

## 🎯 Cách sử dụng

1. **Gửi tin nhắn:** Nhập tin nhắn vào ô input và nhấn Enter hoặc click nút gửi
2. **Xuống dòng:** Sử dụng Shift + Enter để xuống dòng trong tin nhắn
3. **Xóa chat:** Sử dụng Ctrl/Cmd + Enter để xóa toàn bộ cuộc trò chuyện
4. **Trạng thái:** Theo dõi trạng thái kết nối ở góc trên bên phải

## 🛠️ Tùy chỉnh

### Thay đổi model AI
Trong file `server.js`, bạn có thể thay đổi model OpenAI:

```javascript
const completion = await openai.chat.completions.create({
  model: "gpt-4", // Thay đổi từ gpt-3.5-turbo sang gpt-4
  // ... other options
});
```

### Tùy chỉnh prompt
Thay đổi system prompt trong `server.js`:

```javascript
{
  role: "system",
  content: "Bạn là một trợ lý AI chuyên về [lĩnh vực cụ thể]. Hãy trả lời bằng tiếng Việt."
}
```

### Tùy chỉnh giao diện
Chỉnh sửa file `public/style.css` để thay đổi màu sắc, font chữ, layout...

## 🐛 Xử lý lỗi

### Lỗi thường gặp

1. **"Không thể kết nối đến server"**
   - Kiểm tra server có đang chạy không
   - Kiểm tra port 3000 có bị chiếm không

2. **"Có lỗi xảy ra khi xử lý yêu cầu"**
   - Kiểm tra OpenAI API Key có đúng không
   - Kiểm tra tài khoản OpenAI có đủ credit không

3. **"Vui lòng nhập tin nhắn"**
   - Đảm bảo đã nhập tin nhắn trước khi gửi

### Debug
Mở Developer Tools (F12) để xem console logs và network requests.

## 📝 License

MIT License - Xem file LICENSE để biết thêm chi tiết.

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo issue hoặc pull request.

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy tạo issue trên GitHub hoặc liên hệ qua email.

---

**Lưu ý:** Đảm bảo tuân thủ các điều khoản sử dụng của OpenAI khi sử dụng API của họ. 