---
description: Deploy cả Frontend và Backend (Serverless) lên Vercel
---

# Deploy Migration Doc Tool to Vercel

Tiến trình Deploy này sẽ đưa ứng dụng của bạn lên máy chủ Vercel. Hãy đảm bảo bạn đã chạy lệnh cài đặt Vercel CLI toàn cầu bằng `npm i -g vercel` và đã `vercel login` trước đó.

## Bước 1: Deploy Backend (Node.js Express -> Serverless API)

Vì kiến trúc đã lưu dữ liệu hoàn toàn lên Supabase nên Backend giờ đây an toàn để chạy ở chế độ Vercel Serverless. Khi chạy Vercel CLI lần đầu, nó sẽ hỏi tên project và các tùy chọn mặc định, bạn cứ ấn **Enter** (chọn mặc định nghen).

// turbo
1. Deploy Backend lên Vercel:
`cd backend && npx vercel`

> [!IMPORTANT]
> - Sau quá trình Deploy, Vercel sẽ yêu cầu bạn cài đặt **Environment Variables**. 
> - Truy cập Vercel Dashboard -> Project `backend` -> Settings -> Environment Variables. Thiết lập `SUPABASE_URL` và `SUPABASE_KEY` giống file `.env` ở máy bạn. 
> - Deploy Backend lần nữa (`npx vercel --prod`) để áp dụng biến môi trường.
> - **Sao chép URL Backend** mà Vercel trả về.

## Bước 2: Deploy Frontend (Vite + React)

Bạn cần liên kết Frontend với Backend URL thật (Vercel) thay vì `localhost:3000`.

// turbo
1. Trỏ thư mục về frontend và cấu hình Deploy:
`cd frontend && npx vercel`

> [!IMPORTANT]
> - Truy cập Vercel Dashboard -> Project `frontend` -> Settings -> Environment Variables. 
> - Thiết lập `VITE_API_URL` bằng với URL Backend Vercel mà bạn lấy được ở Bước 1. (VD: `https://migration-doc-backend.vercel.app`)

// turbo
2. Deploy Frontend chính thức:
`cd frontend && npx vercel --prod`

## Hoàn Tắt

Ứng dụng của bạn đã hoàn tất trên Vercel. Đọc dữ liệu từ Supabase Cloud và giao diện chạy trên Vercel Edge.
