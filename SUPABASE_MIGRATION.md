# Supabase Migration Guide

## 🔄 What Changed?

Your Next.js Web Terminal has been upgraded from **SQLite + iron-session** to **Supabase (PostgreSQL + Auth)**!

### Before (SQLite):
- ❌ Local file-based database
- ❌ Simple username/password auth
- ❌ Won't work on Vercel/serverless
- ❌ Manual session management

### After (Supabase):
- ✅ Cloud PostgreSQL database
- ✅ Full authentication system (email, OAuth, magic links)
- ✅ Works on Vercel (frontend + API)
- ✅ Row Level Security
- ✅ Scalable and production-ready
- ✅ Multi-user support
- ✅ No local database files

---

## 📦 What's Included

### New Files:
```
src/
├── lib/supabase/
│   ├── client.ts          # Browser Supabase client
│   ├── server.ts          # Server Supabase client  
│   └── db.ts              # Database operations (replaced old db.ts)
├── middleware.ts          # Auth middleware (new)
└── app/api/
    └── auth/
        └── signup/route.ts # New signup endpoint

supabase/
└── migrations/
    └── 001_create_connections_table.sql  # Database schema

.env.supabase              # Environment template for Supabase
SUPABASE_SETUP.md          # Complete setup guide
```

### Updated Files:
- `package.json` - Added Supabase dependencies
- `src/app/api/connections/route.ts` - Uses Supabase
- `src/app/api/connections/[id]/route.ts` - Uses Supabase
- `src/app/api/auth/login/route.ts` - Uses Supabase Auth
- `src/app/api/auth/logout/route.ts` - Uses Supabase Auth

---

## 🚀 Setup Steps (5 minutes)

### 1. Create Supabase Project
```bash
# Go to https://supabase.com
# Click "New Project"
# Wait ~2 minutes for provisioning
```

### 2. Run Database Migration
```bash
# Copy contents of supabase/migrations/001_create_connections_table.sql
# Paste in Supabase SQL Editor
# Click "Run"
```

### 3. Create User
```bash
# In Supabase Dashboard → Authentication → Users
# Click "Add User" → "Create new user"
# Enter email + password
```

### 4. Configure Environment
```bash
cp .env.supabase .env

# Edit .env with your Supabase credentials:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
# ENCRYPTION_KEY=<generate-random-32-chars>
```

### 5. Install & Run
```bash
npm install
npm run dev
```

### 6. Login
```bash
# Open http://localhost:3000
# Login with your Supabase user credentials
```

---

## 🔑 Key Differences

### Authentication:
**Before:** Username/password in .env  
**After:** Email/password per user in Supabase

### Database:
**Before:** Local SQLite file (`data/connections.db`)  
**After:** Cloud PostgreSQL in Supabase

### User Isolation:
**Before:** Single user (everyone sees same connections)  
**After:** Multi-user (each user sees only their connections)

### Deployment:
**Before:** Needs persistent filesystem (VPS/Railway)  
**After:** Works on serverless platforms (Vercel for API, separate WebSocket server)

---

## ⚠️ Important Notes

### WebSocket Limitation Still Exists
Supabase solves the database problem, but **WebSocket for SSH still requires a long-running server**:

**Recommended Architecture:**
1. **Frontend + API** → Deploy to Vercel (with Supabase)
2. **WebSocket Server** → Deploy to Railway/VPS (runs `server.js`)

**Alternative:** Deploy everything together on Railway/VPS (simplest).

### Data Migration
If you have existing SQLite data, you'll need to:
1. Export connections from old SQLite database
2. Create Supabase user
3. Import connections to Supabase (update `user_id`)

### Environment Variables
Old variables **no longer needed**:
- ~~SESSION_SECRET~~
- ~~WEB_USERNAME~~
- ~~WEB_PASSWORD~~

New variables **required**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ENCRYPTION_KEY` (still used for SSH credentials)

---

## 🎯 Benefits

✅ **Multi-user** - Each user has their own connections  
✅ **Scalable** - PostgreSQL handles millions of rows  
✅ **Secure** - Row Level Security enforced at database  
✅ **Free tier** - Generous limits for personal/small team use  
✅ **OAuth ready** - Easy to add Google/GitHub login  
✅ **Backup** - Automatic backups on paid plans  
✅ **Real-time** - Can add live connection status updates  
✅ **API** - Full REST + GraphQL API available  

---

## 📚 Documentation

- **Full Setup Guide**: See `SUPABASE_SETUP.md`
- **Supabase Docs**: https://supabase.com/docs
- **Next.js + Supabase**: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs

---

## 🆘 Need Help?

### Can't login?
- Verify user exists in Supabase Dashboard
- Check email/password are correct
- Ensure `.env` has correct Supabase URL and keys

### "Invalid API key" error?
- Double-check `NEXT_PUBLIC_SUPABASE_URL`
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart dev server after changing `.env`

### No connections showing?
- Connections are per-user now
- Make sure you're logged in as the right user
- Check connections table in Supabase Dashboard

---

**Your web terminal is now production-ready with Supabase! 🎉**

Check <filepath>nextjs-web-terminal/SUPABASE_SETUP.md</filepath> for complete instructions.
