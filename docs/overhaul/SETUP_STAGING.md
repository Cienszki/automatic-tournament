# Setting up staging, step by step

Written on 2026-11-13 by Fable, for the owner. "Staging" is a private copy of the whole system where every change is tried before visitors see it. It needs a few accounts that only you can create. This page says exactly what to click and what to copy.

**How it works.** You collect the values below into one file on your computer. From that file, Claude sets up everything else from the terminal (GitHub, Vercel, the database). You never paste a secret into a chat.

**The file.** In VS Code, in the `overhaul` worktree, copy `.env.staging.example` to a new file named `.env.staging.local`. Git ignores that file. Each step below ends with "paste into the file": put the value after the `=` on the matching line, with no quotes and no spaces.

**What is needed when.**

| Step | Service | Needed for | When |
|---|---|---|---|
| 1 | Supabase connection strings | every database test on staging, the trial (WP-06) | now |
| 2 | Firebase staging project | sign-in and file upload on staging | before WP-06 |
| 3 | Vercel | previews of every branch | before WP-06 |
| 4 | Discord application | Discord sign-in on staging | before WP-38; can wait |
| 5 | Sentry and an alert channel | being told about errors | can wait |
| 6 | GitHub secrets | tests in CI that use staging | Claude does it from the file |

If something on a website looks different from what is written here, stop and tell Claude what you see. These sites change their menus often.

---

## 1. Supabase: the two connection strings

A connection string is the address and password of the database in one line. The app needs two forms of it.

**First, change the password.** The password you sent in the chat is now stored in the chat history, so treat it as known. In the Supabase dashboard open the staging project, then **Project Settings → Database → Reset database password**. Let it generate one, and copy it somewhere for the next minute. It is only staging, so this is hygiene, not an emergency.

**Check the region.** **Project Settings → General** shows the region. It must be Central EU (Frankfurt). A region cannot be changed later; if it is another one, delete the project and create it again in Frankfurt.

**Copy the strings.**

1. Open the project and click **Connect** at the top of the page.
2. Find the entry named **Transaction pooler**. Its string ends in `:6543/postgres`. Copy it.
3. In the copied text, replace `[YOUR-PASSWORD]` (brackets included) with the new password. Paste the result into the file as `DATABASE_URL`.
4. Find the entry named **Session pooler**. Its string ends in `:5432/postgres` and its host contains `pooler.supabase.com`. Copy it, replace the password the same way, and paste it as `DATABASE_URL_SESSION`.

Do not use the entry named "Direct connection". It needs a kind of internet connection (IPv6) that many home networks and hosting services do not have.

**Switch off the browser API.** We use Supabase only as a database, so nothing should be reachable from a browser. **Project Settings → Data API** (it may be under **API**): turn off the switch that enables the Data API, and save. If you cannot find it, skip it and tell Claude; it can also be closed from the database side.

## 2. Firebase: the staging project

You created the project. It needs four things switched on. Open the [Firebase console](https://console.firebase.google.com) and pick the staging project.

**2a. Sign-in with Google.**
1. Left menu: **Build → Authentication**. Click **Get started**.
2. Tab **Sign-in method** → **Google** → turn on **Enable**.
3. Choose your e-mail as the support e-mail. **Save**.

**2b. A place for files (Storage).**
1. Left menu: **Build → Storage**. Click **Get started**.
2. It asks to upgrade the project to the pay-as-you-go plan (Blaze). Accept and pick your existing billing account. Staging stays inside the free allowance, and step 2e sets an alarm in case it ever does not.
3. Location: choose one in Europe (for example `europe-west3`, Frankfurt, or `europe-west1`).
4. Rules: choose **production mode**. Finish.

**2c. The six public values.** They tell the website which Firebase project to talk to. They are not secret.
1. Click the gear next to "Project Overview" → **Project settings** → tab **General**.
2. Scroll to **Your apps**. Click the web icon `</>`.
3. Nickname: `staging web`. Leave "Firebase Hosting" unticked. **Register app**.
4. The page shows a block named `firebaseConfig`. Copy each value into the file:

| In `firebaseConfig` | Line in the file |
|---|---|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

If you prefer the terminal, the same values come from two commands (replace the project id with yours):

```
firebase apps:create WEB "staging web" --project YOUR-STAGING-PROJECT-ID
firebase apps:sdkconfig WEB --project YOUR-STAGING-PROJECT-ID
```

**2d. The server key.** This one is secret: it lets our server act as the project's administrator.
1. **Project settings** → tab **Service accounts** → **Generate new private key** → **Generate key**. A `.json` file is downloaded.
2. The app wants it as one long line of text. In a PowerShell terminal, with the real path of the downloaded file:
   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\you\Downloads\the-file.json")) | Set-Clipboard
   ```
3. Paste (Ctrl+V) into the file as `FIREBASE_SERVICE_ACCOUNT_BASE64`. It is one very long line.
4. Delete the downloaded `.json` file.

**2e. The cost alarm.** In the [Google Cloud billing page](https://console.cloud.google.com/billing), open your billing account → **Budgets & alerts** → **Create budget** → limit it to the staging project → amount `1` (dollar) → finish. You get an e-mail if staging ever costs anything.

Do not create a Firestore database in this project. The new platform does not use one.

## 3. Vercel

Vercel can be driven from the terminal, which you asked for. Two commands are yours, because they open your browser to confirm who you are:

```
npm install -g vercel
vercel login
```

After that, tell Claude "Vercel is logged in". Claude then does the rest from the terminal: links the worktree to your project, connects it to the GitHub repository, sets the region to Frankfurt in the code, and loads the values from your file as environment variables.

One setting has no terminal command. Do it once on the website:

1. Open the project → **Settings → Environments**.
2. Click **Production** → **Branch Tracking**.
3. Change the branch name to `overhaul` → **Save**.

If the project you created is not connected to anything yet, that is fine. If it is easier, delete it; Claude can create a fresh one from the terminal.

What you will see afterwards: every push of a work-package branch gets its own preview address. Until the first pages of the new platform exist, those previews show the old site's code without data. That is expected.

## 4. Discord: the staging application

You created the application named "staging". Two values are needed from the [Developer Portal](https://discord.com/developers/applications):

1. Open the application → left menu **OAuth2**.
2. **Client ID**: copy it into the file as `DISCORD_CLIENT_ID`.
3. **Client Secret**: click **Reset Secret**, confirm, copy the value shown (it is shown once) into the file as `DISCORD_CLIENT_SECRET`.

Later, when staging has its web address, one more line goes in the same page under **Redirects**. Claude will give you the exact address to paste then.

## 5. Error monitoring and alerts (can wait)

"Error monitoring" means: when the website or the bot crashes for someone, a service records what happened and where, so we find out from a message and not from an angry player. The service is Sentry. Its free plan is enough.

1. Sign up at [sentry.io](https://sentry.io) and create an organization (any name).
2. **Create project** → platform **Next.js** → name `tournament-web`. The setup page shows a **DSN**, an address that starts with `https://` and contains `sentry.io`. Copy it into the file as `SENTRY_DSN_WEB`. Skip the rest of their setup page; the code is added by a work package.
3. Create a second project → platform **Node.js** → name `tournament-bot` → copy its DSN as `SENTRY_DSN_BOT`.

Alerts go to a Discord channel only you see:

1. In your Discord server, create a private channel, for example `#alerts`.
2. Channel settings (the gear) → **Integrations** → **Webhooks** → **New Webhook** → **Copy Webhook URL**.
3. Paste it into the file as `ALERT_DISCORD_WEBHOOK_URL`.

## 6. GitHub secrets

GitHub runs the tests on every push. For the tests that use staging, it needs the same values. You do not have to click anything: when the file is filled, Claude runs one command that copies the values from `.env.staging.local` into the repository's secret store, where they can be used by test runs but never read back.

If you want to do it yourself, in the `overhaul` worktree:

```
gh secret set --env-file .env.staging.local
```

## 7. The last line of the file

`CRON_SECRET` is a password we invent, used by the database when it calls the website on a schedule. Any long random text works. In PowerShell:

```
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N") | Set-Clipboard
```

Paste it into the file.

## When you are done

Tell Claude which steps are filled in. It will check each value by using it (connect to the database, read the Firebase project, list the Vercel project) and report what works. Steps 4 and 5 can be left empty for now.
