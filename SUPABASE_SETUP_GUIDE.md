# Obsidia AI — Complete Supabase Setup Guide

A step-by-step tutorial to get every Supabase feature in Obsidia fully configured and running.

---

## Prerequisites

- A Supabase account (free tier works) at [supabase.com](https://supabase.com)
- A Google Cloud Console account (for Google Sign-In)
- Your Obsidia project deployed (or running locally)

---

## Step 1: Create Your Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name:** `obsidia-study`
   - **Database Password:** Choose a strong password (save this somewhere safe)
   - **Region:** Pick the one closest to your users
4. Click **"Create new project"** and wait for it to finish provisioning (~2 minutes)
5. Once ready, go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon/public key** (a long JWT string)

> You will paste these into your `public/index.html` file later (lines 5855-5856), replacing the existing values for `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## Step 2: Run the Database Schema (Core Tables)

This creates the `profiles`, `chat_sessions`, and `achievements` tables, plus all security policies and functions.

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the **entire** contents of `supabase-schema.sql` from your repo and paste it into the editor
4. Click **"Run"** (or press Ctrl+Enter)
5. You should see `Success. No rows returned` — this is normal

**What this creates:**
| Item | Purpose |
|------|---------|
| `profiles` table | Stores user data, stats, XP, streak, preferences |
| `chat_sessions` table | Tracks each AI conversation |
| `achievements` table | Stores earned badges/achievements |
| RLS policies | Ensures users can only access their own data |
| `handle_new_user()` trigger | Auto-creates a profile when someone signs up |
| `record_session()` function | Records sessions and updates XP/streak/level |

---

## Step 3: Run the V2 Schema (Classes, Assignments, Subscriptions)

This adds the teacher/classroom system and usage tracking.

1. Still in the **SQL Editor**, click **"New query"** again
2. Copy the **entire** contents of `supabase-v2-schema.sql` and paste it in
3. Click **"Run"**
4. You should see `Success. No rows returned`

**What this creates:**
| Item | Purpose |
|------|---------|
| `role` column on profiles | Distinguishes students vs teachers |
| `classes` table | Teacher-created classrooms with join codes |
| `class_members` table | Tracks which students are in which classes |
| `assignments` table | Teacher-created assignments |
| `submissions` table | Student assignment submissions |
| `subscriptions` table | Subscription tier management |
| `daily_usage` table | Rate limiting by day |
| `generate_join_code()` | Creates unique 6-character class codes |
| `check_and_increment_usage()` | Enforces daily session limits per tier |

---

## Step 4: Create the Recordings Table (Missing from Schema)

The app supports audio/lecture recordings, but the table isn't included in either schema file. You need to create it manually.

1. In the **SQL Editor**, click **"New query"**
2. Paste and run this:

```sql
-- Recordings table for audio/lecture storage
CREATE TABLE public.recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings" ON public.recordings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings" ON public.recordings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings" ON public.recordings
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_recordings_user ON public.recordings(user_id, created_at DESC);
```

3. Click **"Run"** — should see `Success. No rows returned`

---

## Step 5: Create the Recordings Storage Bucket

The app uploads audio files to Supabase Storage. You need to create the bucket and set permissions.

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"**
3. Set:
   - **Name:** `recordings`
   - **Public bucket:** Toggle **ON** (the app uses `getPublicUrl` to serve files)
4. Click **"Create bucket"**

Now add the security policies for the bucket:

5. Click on the `recordings` bucket
6. Click the **"Policies"** tab (or go to **Storage → Policies**)
7. Create these 3 policies:

**Policy 1 — Allow users to upload their own recordings:**
- Click **"New policy"** → **"For full customization"**
- Policy name: `Users upload own recordings`
- Allowed operation: **INSERT**
- Target roles: `authenticated`
- WITH CHECK expression:
  ```sql
  (bucket_id = 'recordings') AND ((auth.uid())::text = (storage.foldername(name))[1])
  ```
- Click **"Review"** → **"Save policy"**

**Policy 2 — Allow public downloads:**
- Click **"New policy"** → **"For full customization"**
- Policy name: `Public read access`
- Allowed operation: **SELECT**
- Target roles: `public`
- USING expression:
  ```sql
  bucket_id = 'recordings'
  ```
- Click **"Review"** → **"Save policy"**

**Policy 3 — Allow users to delete their own recordings:**
- Click **"New policy"** → **"For full customization"**
- Policy name: `Users delete own recordings`
- Allowed operation: **DELETE**
- Target roles: `authenticated`
- USING expression:
  ```sql
  (bucket_id = 'recordings') AND ((auth.uid())::text = (storage.foldername(name))[1])
  ```
- Click **"Review"** → **"Save policy"**

---

## Step 6: Configure Email Authentication (OTP)

This fixes the issue where Supabase sends the default "Magic Link" email instead of a branded verification code.

1. Go to **Authentication** (left sidebar) → **Email Templates**
2. Select the **"Magic Link"** template
3. Change the **Subject** to:
   ```
   Your Obsidia AI Verification Code
   ```
4. Replace the **body** with this HTML:

```html
<div style="max-width:480px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0908;border:1px solid rgba(201,168,76,0.2);border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#141210,#1a1816);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(201,168,76,0.15);">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#e8c96a;letter-spacing:0.05em;">OBSIDIA AI</div>
    <div style="font-size:12px;color:#6a6050;margin-top:4px;letter-spacing:0.1em;">YOUR PERSONAL STUDY ASSISTANT</div>
  </div>
  <div style="padding:32px 24px;text-align:center;">
    <div style="font-size:18px;font-weight:600;color:#e0d6c2;margin-bottom:8px;">Your Verification Code</div>
    <div style="font-size:13px;color:#6a6050;margin-bottom:24px;line-height:1.6;">Enter this code on the Obsidia sign-in screen to verify your identity.</div>
    <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:36px;font-weight:700;color:#e8c96a;letter-spacing:12px;font-family:'Courier New',monospace;">{{ .Token }}</div>
    </div>
    <div style="font-size:12px;color:#5a5040;line-height:1.6;">This code expires in 10 minutes.<br>If you didn't request this, you can safely ignore this email.</div>
  </div>
  <div style="padding:16px 24px;text-align:center;border-top:1px solid rgba(201,168,76,0.1);background:rgba(0,0,0,0.3);">
    <div style="font-size:11px;color:#4a4030;">&copy; Obsidia AI — Your Personal Study Assistant</div>
  </div>
</div>
```

5. Click **"Save"**

> **Why this matters:** The `{{ .Token }}` variable is what inserts the 6-digit code. The default template only has `{{ .ConfirmationURL }}` (the magic link), which is why users were seeing a link instead of a code.

---

## Step 7: Configure the Confirm Signup Email Template

When a new user signs up, they also get a confirmation email. Let's brand that too.

1. Still in **Authentication → Email Templates**
2. Select the **"Confirm signup"** template
3. Change the **Subject** to:
   ```
   Welcome to Obsidia AI — Confirm Your Account
   ```
4. Replace the **body** with:

```html
<div style="max-width:480px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0908;border:1px solid rgba(201,168,76,0.2);border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#141210,#1a1816);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(201,168,76,0.15);">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#e8c96a;letter-spacing:0.05em;">OBSIDIA AI</div>
    <div style="font-size:12px;color:#6a6050;margin-top:4px;letter-spacing:0.1em;">YOUR PERSONAL STUDY ASSISTANT</div>
  </div>
  <div style="padding:32px 24px;text-align:center;">
    <div style="font-size:18px;font-weight:600;color:#e0d6c2;margin-bottom:8px;">Welcome to Obsidia!</div>
    <div style="font-size:13px;color:#6a6050;margin-bottom:24px;line-height:1.6;">Confirm your account to start studying smarter with AI.</div>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#e8c96a);color:#0a0908;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:14px;letter-spacing:0.03em;">Confirm My Account</a>
    <div style="font-size:12px;color:#5a5040;margin-top:24px;line-height:1.6;">If you didn't create this account, you can safely ignore this email.</div>
  </div>
  <div style="padding:16px 24px;text-align:center;border-top:1px solid rgba(201,168,76,0.1);background:rgba(0,0,0,0.3);">
    <div style="font-size:11px;color:#4a4030;">&copy; Obsidia AI — Your Personal Study Assistant</div>
  </div>
</div>
```

5. Click **"Save"**

---

## Step 8: Configure Google OAuth Sign-In

### Part A — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → OAuth consent screen**
4. Choose **External** user type → click **Create**
5. Fill in:
   - **App name:** `Obsidia AI`
   - **User support email:** your email
   - **App logo:** (optional, upload your Obsidia logo)
   - **Authorized domains:** add your production domain (e.g., `obsidia.ai` or your Vercel domain)
   - **Developer contact email:** your email
6. Click **Save and Continue** through the Scopes and Test Users steps (defaults are fine)
7. Now go to **APIs & Services → Credentials**
8. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
9. Set:
   - **Application type:** Web application
   - **Name:** `Obsidia AI`
   - **Authorized JavaScript origins:** Add your site URL (e.g., `https://your-domain.com`)
   - **Authorized redirect URIs:** Add:
     ```
     https://hyrcwqjnhcychrxbumcl.supabase.co/auth/v1/callback
     ```
     (Replace with YOUR Supabase project URL + `/auth/v1/callback`)
10. Click **"Create"**
11. Copy the **Client ID** and **Client Secret**

### Part B — Supabase Dashboard

1. In Supabase, go to **Authentication → Providers**
2. Find **Google** and expand it
3. Toggle it **ON**
4. Paste in:
   - **Client ID** (from Google)
   - **Client Secret** (from Google)
5. Click **"Save"**

---

## Step 9: Set Site URL and Redirect URLs

1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to your production URL:
   ```
   https://your-actual-domain.com
   ```
3. Under **Redirect URLs**, add all URLs where users might sign in from:
   ```
   https://your-actual-domain.com/**
   http://localhost:3000/**
   http://localhost:5173/**
   ```
   (The `/**` wildcard allows any path on that domain)
4. Click **"Save"**

---

## Step 10: Update Your Code with Supabase Credentials

If you created a new Supabase project, update the credentials in your app:

1. Open `public/index.html`
2. Find these lines (around line 5855):
   ```javascript
   const SUPABASE_URL = window.OBSIDIA_SUPABASE_URL || 'https://hyrcwqjnhcychrxbumcl.supabase.co';
   const SUPABASE_ANON_KEY = window.OBSIDIA_SUPABASE_ANON_KEY || 'eyJ...';
   ```
3. Replace with your new project URL and anon key from Step 1

> If you're using the existing Supabase project (`hyrcwqjnhcychrxbumcl`), skip this step.

---

## Step 11: Verify Everything Works

Test each feature in order:

### Auth
- [ ] Open the app and click "Sign In"
- [ ] Enter an email → you should receive a branded Obsidia email with a 6-digit code
- [ ] Enter the code → you should be signed in
- [ ] Sign out, then try "Sign in with Google" → should redirect to Google and back

### Profile
- [ ] After first sign-in, check Supabase **Table Editor → profiles** — a row should exist for your user
- [ ] Change your theme in the app → the `theme` column should update in the profiles table
- [ ] Complete onboarding → `onboarding_complete` should be `true`

### Chat Sessions & XP
- [ ] Start a chat with any AI tool (Essay Writer, Solver, etc.)
- [ ] Send a few messages, then close the chat
- [ ] Check **Table Editor → chat_sessions** — a new row should appear
- [ ] Check **Table Editor → profiles** — `total_sessions`, `total_xp`, and `current_streak` should update

### Achievements
- [ ] Use the app enough to trigger an achievement (e.g., complete your first session)
- [ ] Check **Table Editor → achievements** — a row should appear

### Recordings (if using the lecture recorder feature)
- [ ] Record or upload an audio file
- [ ] Check **Storage → recordings** bucket — the file should appear
- [ ] Check **Table Editor → recordings** — metadata row should exist
- [ ] Delete the recording in the app → both the file and row should be removed

### Classes (Teacher Mode)
- [ ] Toggle teacher mode in settings
- [ ] Create a class → check **Table Editor → classes**
- [ ] Note the join code
- [ ] Sign in as a different user and join the class using the code

---

## Troubleshooting

### "relation 'profiles' does not exist"
You haven't run `supabase-schema.sql` yet. Go back to Step 2.

### "permission denied for table profiles"
RLS is enabled but the policies weren't created. Re-run the schema SQL — the policies are included.

### Email shows "Magic Link" instead of a code
You haven't updated the email template. Go back to Step 6.

### Google sign-in redirects but fails
- Check that the redirect URI in Google Console **exactly** matches: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
- Check that the Client ID and Secret in Supabase match what Google gave you
- Make sure Google provider is toggled ON in Supabase

### "new row violates row-level security policy"
The user trying to insert/update isn't authenticated, or is trying to modify another user's data. Check that `auth.uid()` matches the row's `user_id`.

### Recordings upload fails
- Make sure the `recordings` bucket exists and is set to **public**
- Make sure the storage policies from Step 5 are created
- Check that the upload path follows the format `{user_id}/recordings/{filename}`

### Profile not created on signup
The `handle_new_user()` trigger may not have been created. Re-run the schema SQL, or manually check: **Database → Functions** and look for `handle_new_user`.

---

## Summary

| Step | What | Where |
|------|------|-------|
| 1 | Create Supabase project | Supabase Dashboard |
| 2 | Run core schema SQL | SQL Editor |
| 3 | Run v2 schema SQL | SQL Editor |
| 4 | Create recordings table | SQL Editor |
| 5 | Create recordings storage bucket + policies | Storage |
| 6 | Brand the Magic Link email template | Auth → Email Templates |
| 7 | Brand the Confirm Signup email template | Auth → Email Templates |
| 8 | Configure Google OAuth | Google Cloud + Auth → Providers |
| 9 | Set Site URL + Redirect URLs | Auth → URL Configuration |
| 10 | Update credentials in code (if new project) | `public/index.html` |
| 11 | Test everything | Your app |
