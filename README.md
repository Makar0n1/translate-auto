# Translation Dashboard

## Overview
A full-stack application for translating movie/series titles and descriptions from XLSX files using OpenAI's ChatGPT API. Features include authentication, WebSocket updates, and progress tracking.

## Setup

### Backend
1. Navigate to `/backend`
2. Install dependencies: `npm install`
3. Create `.env` with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   MONGO_URI=mongodb://localhost:27017/translation
   JWT_SECRET=your_jwt_secret
   BACKEND_PORT=3000
   FRONTEND_PORT=3001
   ```
4. Start MongoDB
5. Run: `npm run dev`

### Frontend
1. Navigate to `/frontend`
2. Install dependencies: `npm install`
3. Run: `npm run dev`

### Production
- Backend: Run with PM2 on `api.repsdeltsgear.store`
- Frontend: Build with `npm run build` and serve from `web.repsdeltsgear.store`

## Usage
1. Register user via backend API: `POST /api/auth/register`
2. Login through the web interface
3. Add project, upload XLSX, specify columns and languages
4. Start translation, monitor progress, download result

## Notes
- Ensure Cloudflare proxy is configured
- No HTTPS required due to Cloudflare
- Use WebSocket for real-time updates


### register
**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"your_username","password":"your_password"}'
```

**PowerShell (Invoke-RestMethod)**:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/auth/register -Method Post -ContentType "application/json" -Body '{"username":"your_username","password":"your_password"}'
```

### Login
**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"your_username","password":"your_password"}'
```

**PowerShell (Invoke-RestMethod)**:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -ContentType "application/json" -Body '{"username":"your_username","password":"your_password"}'
```

### Update password
**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/update-password -H "Content-Type: application/json" -d '{"username":"your_username","newPassword":"new_password"}'
```

**PowerShell (Invoke-RestMethod)**:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/auth/update-password -Method Post -ContentType "application/json" -Body '{"username":"your_username","newPassword":"new_password"}'
```