# Supabase Setup Guide

Complete guide for setting up the Next.js Web Terminal with Supabase for database and authentication.

## 📋 Why Supabase?

✅ **PostgreSQL Database** - Production-ready, scalable  
✅ **Built-in Authentication** - Email/password, OAuth, magic links  
✅ **Row Level Security** - Secure data isolation per user  
✅ **Real-time Subscriptions** - Optional future feature  
✅ **Free Tier** - Generous limits for development  
✅ **Vercel Compatible** - No filesystem required  

---

## 🚀 Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click **"New Project"**
4. Fill in details:
   - **Project Name**: web-terminal
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Wait for database to provision (~2 minutes)

### 2. Get API Keys

1. Go to **Project Settings** (gear icon)
2. Click **API** in sidebar
3. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJxxx...`

### 3. Run Database Migration

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the entire contents of `supabase/migrations/001_create_connections_table.sql`
4. Click **"Run"** (or press Ctrl+Enter)
5. You should see: ✅ Success message

**The migration creates:**
- `connections` table for storing VPS connection details
- Row Level Security (RLS) policies - users only see their own connections
- Automatic timestamp updates
- Indexes for performance

### 4. Create Test User

Option A: **Via Supabase Dashboard**
1. Go to **Authentication** → **Users**
2. Click **"Add User"** → **"Create new user"**
3. Enter email and password
4. Click **"Create User"**
5. User is auto-confirmed (no email needed)

Option B: **Via Signup API** (after setup)
- Use the `/api/auth/signup` endpoint
- Check email for confirmation link

### 5. Configure Environment Variables

```bash
cd nextjs-web-terminal
cp .env.supabase .env
nano .env
```

Update `.env` with your values:

```env
# From Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Generate secure encryption key
ENCRYPTION_KEY=your-random-encryption-key-min-32-chars

NODE_ENV=production
PORT=3000
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Install Dependencies

```bash
npm install
```

New Supabase dependencies are already in `package.json`:
- `@supabase/supabase-js` - Supabase client
- `@supabase/auth-helpers-nextjs` - Next.js auth helpers
- `@supabase/ssr` - Server-side rendering support

### 7. Run the Application

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 8. Login and Use

1. Open http://localhost:3000
2. Login with your Supabase user credentials
3. Add VPS connections
4. Connect to your servers!

---

## 🔐 Authentication Flow

### How it Works:

1. **User logs in** → Supabase validates credentials
2. **Supabase returns JWT** → Stored in HTTP-only cookies
3. **User makes requests** → JWT automatically sent
4. **API validates JWT** → Supabase verifies token
5. **RLS enforces access** → Users only see their own data

### Authentication Methods:

#### Email/Password (Default)
- Already configured
- Use `/api/auth/login` and `/api/auth/signup`

#### Magic Links (Add-on)
```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com'
});
```

#### OAuth Providers (Add-on)
Enable in Supabase Dashboard → Authentication → Providers:
- Google, GitHub, GitLab, Bitbucket, etc.

---

## 🗄️ Database Structure

### `connections` Table Schema:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| user_id | UUID | Foreign key to auth.users |
| name | TEXT | Connection name |
| host | TEXT | VPS IP or domain |
| port | INTEGER | SSH port (default 22) |
| username | TEXT | SSH username |
| password | TEXT | Encrypted SSH password |
| auth_method | TEXT | 'password' or 'key' |
| private_key | TEXT | SSH key file path |
| passphrase | TEXT | Encrypted key passphrase |
| private_key_content | TEXT | Encrypted uploaded key content |
| key_type | TEXT | 'file' or 'uploaded' |
| key_fingerprint | TEXT | SSH key fingerprint |
| ssh_keys | JSONB | Array of multiple SSH keys |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### Row Level Security (RLS) Policies:

✅ Users can only **SELECT** their own connections  
✅ Users can only **INSERT** with their own user_id  
✅ Users can only **UPDATE** their own connections  
✅ Users can only **DELETE** their own connections  

**This means:**
- User A cannot see User B's connections
- User A cannot modify/delete User B's connections
- Enforced at database level (not just application)

---

## 🌐 Deploy with Supabase

### Vercel (Finally Possible!)

With Supabase, you can now deploy to Vercel, but **WebSocket still won't work** for SSH. Use this for the frontend + API only.

**Alternative Architecture:**
1. **Vercel**: Host Next.js frontend + API routes
2. **Railway/VPS**: Run WebSocket server for SSH connections
3. Frontend connects to external WebSocket server

### Railway (Recommended - Full Stack)

Railway supports everything including WebSockets:

```bash
railway login
railway init
railway up

# Add environment variables in Railway dashboard
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# ENCRYPTION_KEY
```

### Docker with Supabase

Update `docker-compose.yml` environment:

```yaml
environment:
  - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
  - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
  - ENCRYPTION_KEY=${ENCRYPTION_KEY}
```

---

## 🔧 Common Tasks

### Add New User via SQL

```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  role
) VALUES (
  'user@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  'authenticated'
);
```

### View All Connections (Admin)

```sql
-- View connections across all users (admin only)
SELECT 
  c.*,
  u.email as user_email
FROM connections c
JOIN auth.users u ON c.user_id = u.id
ORDER BY c.updated_at DESC;
```

### Reset User Password

In Supabase Dashboard:
1. **Authentication** → **Users**
2. Click on user
3. Click **"Send password recovery email"**

Or via API:
```typescript
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com'
);
```

### Backup Database

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Backup
supabase db dump -f backup.sql
```

---

## 📊 Supabase Free Tier Limits

- ✅ 500MB database space
- ✅ 2GB bandwidth/month
- ✅ 50,000 monthly active users
- ✅ Unlimited API requests
- ✅ Social OAuth providers
- ✅ 2GB file storage

**Perfect for:**
- Personal use
- Small teams (< 50 users)
- Development and testing

**Upgrade needed for:**
- Heavy production usage (>500MB data)
- >2GB bandwidth/month
- Custom domains
- Point-in-time recovery

---

## 🐛 Troubleshooting

### "Invalid API key"
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` matches your project
- Ensure no extra spaces in `.env` file

### "Row Level Security: new row violates policy"
- RLS policies are working correctly
- Make sure user is authenticated
- Check `user_id` matches authenticated user

### "relation does not exist"
- Database migration not run
- Run the SQL migration in Supabase SQL Editor
- Check table name is `connections` (lowercase)

### Authentication not persisting
- Cookies may be blocked
- Check browser privacy settings
- Ensure domain/localhost is accessible

### "Failed to fetch connections"
- User not authenticated
- Check authentication token in cookies
- Verify API routes are using `createClient` from server.ts

---

## 🔒 Security Best Practices

### 1. Never Expose Service Role Key
❌ **Never use service_role key in frontend**  
✅ Only use `anon` key in client code  
✅ Service role bypasses RLS - use only in secure backend scripts

### 2. Enable Email Confirmations (Production)
In Supabase Dashboard → **Authentication** → **Settings**:
- Enable "Email Confirmations"
- Configure email templates
- Add custom SMTP (optional)

### 3. Enable Additional Auth Security
- **Enable reCAPTCHA** for signup
- **Rate limiting** for auth endpoints
- **Password strength** requirements
- **Session timeout** settings

### 4. Database Security
- ✅ RLS is already enabled
- ✅ Encryption at rest (automatic)
- ✅ SSL connections (automatic)
- 🔐 Regularly rotate encryption keys

### 5. Backup Strategy
- Enable Point-in-Time Recovery (paid plans)
- Regular manual backups via CLI
- Export critical data regularly

---

## 🚀 Next Steps

### Optional Enhancements:

1. **Social OAuth**
   - Enable Google/GitHub login in Supabase Dashboard
   - Add OAuth buttons to login page

2. **Email Verification**
   - Enable in Authentication settings
   - Customize email templates

3. **Real-time Updates**
   - Subscribe to connection changes
   - Show live connection status

4. **User Profiles**
   - Create `profiles` table
   - Store additional user metadata

5. **Shared Connections**
   - Add team/sharing functionality
   - Update RLS policies for sharing

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Next.js + Supabase**: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security
- **Supabase CLI**: https://supabase.com/docs/guides/cli

---

**Author:** MiniMax Agent  
**Version:** 4.0.0 (Supabase Edition)  
**Last Updated:** 2025-11-25

✨ **Your web terminal is now powered by Supabase!** ✨
