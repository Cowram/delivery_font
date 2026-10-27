# Delivery Planner — Angular Frontend

Angular standalone application for the handoff-frontend specification. Original ZIP files are not modified.

## Requirements
- Node.js 20.19+ (or a version supported by Angular CLI 20)
- npm

## Run
```bash
npm install
npm start
```

The app opens on `http://localhost:4200`. Production build: `npm run build`.

## Backend
`src/app/api.service.ts` uses the handoff Base URL `https://delivery-backend-7bhh.onrender.com`. The app calls the documented REST endpoints directly without login/token. Render's free service may need 30–60 seconds to wake up. Browser CORS must be enabled by the backend.

## Included screens
- Dashboard
- Orders: list, simulate (20–30), clear simulated orders, edit box count, delete
- Customers: list/search/create/update/delete
- Dispatch plans: calculate, recalculate, view details, confirm/cancel, Google Maps links
- Rider public job lookup by job code
- Shop settings

Note: API responses are consumed according to `API.md`. Some backend errors (e.g. `ORDER_LOCKED`, `NO_ORDERS`) are shown in the alert area. The map uses links to Google Maps for navigation; full Leaflet route rendering can be added when route geometry is exposed by the API.


## แผนที่เส้นทางตามถนนจริง
หน้ารายละเอียดแผนจัดส่งใช้ Leaflet + OpenStreetMap และขอ geometry เส้นทางรถยนต์จาก OSRM public demo เพื่อวาดตามถนนจริง เส้นทางต้องใช้อินเทอร์เน็ตและบริการภายนอกนี้มีข้อจำกัดการใช้งาน เหมาะสำหรับทดสอบ/งานเรียนเท่านั้น ค่า distance/cost/ETA ที่แสดงในแผนยังใช้ค่าจาก Backend เดิม ไม่ได้เปลี่ยน API หรือสูตรคำนวณฝั่ง Backend
