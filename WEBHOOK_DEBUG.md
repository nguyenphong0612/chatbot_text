# Webhook và Database Debug

## Vấn đề hiện tại

### 1. Lỗi Webhook 500 Internal Server Error
- **Lỗi**: `Webhook Error: AxiosError: Request failed with status code 500`
- **Nguyên nhân**: Make.com webhook trả về lỗi "Scenario failed to complete."
- **Ảnh hưởng**: Cuộc trò chuyện không được gửi đến Make.com để xử lý

### 2. Conversation không lưu được vào Supabase
- **Tình trạng**: ❌ Conversation không được lưu thành công vào database
- **Nguyên nhân**: Có thể do lỗi validate conversation ID hoặc kết nối database
- **Kết luận**: Cần kiểm tra và sửa lỗi database

## Các cải thiện đã thực hiện

### 1. Cải thiện xử lý lỗi trong `webhook.js`
- Thêm logging chi tiết để debug
- Xử lý các status code khác nhau (400, 401, 403, 404, 500, 502, 503, 504)
- Tăng timeout từ 10s lên 15s
- Trả về thông tin lỗi chi tiết hơn

### 2. Cải thiện xử lý lỗi trong `chat.js`
- Thêm try-catch cho việc tạo conversation
- Thêm try-catch cho việc lưu user message
- Thêm try-catch cho việc lưu bot response
- Logging chi tiết cho từng bước

### 3. Cải thiện validate conversation ID trong `database.js`
- Tạm thời chấp nhận format conversation ID khác UUID
- Thêm warning thay vì throw error
- Giảm strict validation để tránh lỗi

### 4. Cải thiện xử lý lỗi trong `script.js`
- Webhook failure không block conversation flow
- Thêm try-catch để xử lý lỗi webhook riêng biệt
- Không hiển thị lỗi webhook cho user nếu conversation đã được lưu thành công

## Cách kiểm tra và debug

### 1. Kiểm tra logs trong Vercel
- Vào Vercel Dashboard
- Chọn project
- Vào tab "Functions" để xem logs
- Tìm logs từ `/api/chat` để xem lỗi database

### 2. Kiểm tra environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### 3. Test trực tiếp API
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

## Các bước khắc phục

### 1. Kiểm tra kết nối Supabase
- Kiểm tra environment variables
- Kiểm tra quyền truy cập database
- Kiểm tra cấu trúc bảng `conversations`

### 2. Kiểm tra Make.com scenario
- Đăng nhập vào Make.com
- Kiểm tra scenario có hoạt động không
- Kiểm tra webhook URL có đúng không
- Kiểm tra cấu hình scenario

### 3. Test webhook URL
```bash
curl -X POST https://hook.eu2.make.com/iffn0r2fo7uex5vxeic3y2t93r8ul66t \
  -H "Content-Type: application/json" \
  -d '{"test": "hello"}'
```

## Trạng thái hiện tại

### ❌ Cần khắc phục
- Lưu conversation vào Supabase
- Gửi dữ liệu đến Make.com webhook
- Xử lý dữ liệu trong Make.com scenario

### ✅ Đã cải thiện
- Error handling chi tiết hơn
- Logging để debug
- Xử lý conversation ID format linh hoạt hơn

## Khuyến nghị

1. **Ưu tiên cao**: Kiểm tra và sửa lỗi database (Supabase)
2. **Ưu tiên trung bình**: Kiểm tra và sửa Make.com scenario
3. **Ưu tiên thấp**: Tạo webhook URL mới nếu cần

## Monitoring

Để theo dõi tình trạng:
1. Kiểm tra logs trong Vercel
2. Kiểm tra database có conversation mới không
3. Kiểm tra Make.com webhook logs
4. Test API trực tiếp 