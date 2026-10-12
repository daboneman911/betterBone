# RepCoach teardown

How to remove every piece of RepCoach: the published site, the copies installed on your devices, and everything set up on this PC. Do the steps in order, and skip any part you never set up.

> **Want to keep your workout history?** Do this first: open the app → Settings → **Export backup**. Each device stores its own data, and nothing below can recover it afterwards.

---

## 1. Take the website offline (GitHub)

Choose **one** option.

**A. Delete the whole repo** (removes the code and the site):

```powershell
gh repo delete <your-github-username>/repcoach --yes
```

The first time, gh asks for the extra `delete_repo` permission. Grant it with:

```powershell
gh auth refresh -h github.com -s delete_repo
```

You can also do it on the web: repo → **Settings** → bottom of the page → **Delete this repository**.

**B. Keep the code, stop publishing:** repo → **Settings → Pages** → **Unpublish site**. Or from the terminal:

```powershell
gh api -X DELETE repos/<your-github-username>/repcoach/pages
```

**Check it worked:** within a few minutes, `https://<your-github-username>.github.io/repcoach/` should return a 404.

**Copies that may outlive the site:**
- Forks or clones other people made.
- Phones that already installed the app. It keeps working offline from its cache until you remove it (step 2).
- The page has a `noindex` tag, so search engines shouldn't have listed it.

## 2. Remove the app from your devices

### iPhone
1. *(Optional)* In the app: Settings → **Erase everything**.
2. Long-press the RepCoach icon → **Remove App** → **Delete from Home Screen**. (On older iOS: **Delete Bookmark**.)
3. Clear the leftover data: iOS **Settings → Apps → Safari → Advanced → Website Data** → search `github.io` → swipe to delete. (On older iOS: **Settings → Safari → Advanced → Website Data**.)

### Mac (Safari web app)
1. Quit RepCoach.
2. Finder → your home folder → **Applications** → drag **RepCoach** to the Trash. These web apps live in `~/Applications`, not `/Applications`.
3. Safari → **Settings → Privacy → Manage Website Data** → search `github.io` → **Remove**.

### Mac or PC (Chrome or Edge install)
1. Go to `chrome://apps` (or `edge://apps`) → right-click RepCoach → **Remove**. Tick *Also clear data* if offered.
2. If you only used it in a browser tab: site settings for the RepCoach URL → **Clear data**.

### This PC's browser (local testing at localhost:8080)
Open `http://localhost:8080` → DevTools (F12) → **Application** → **Storage** → **Clear site data**. This also removes the service worker and cached images.

## 3. Stop the local dev server

If it's running in a terminal, press **Ctrl+C**. Otherwise, find whatever is holding port 8080 and stop it:

```powershell
$procId = (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($procId) { Get-Process -Id $procId; Stop-Process -Id $procId }
```

Check that the PID belongs to `node` before stopping it. If you allowed `node.exe` through the Windows Firewall prompt, remove that rule too. This needs admin, or ask IT:

```powershell
Get-NetFirewallRule | Where-Object DisplayName -like '*node*'
```

## 4. Sign GitHub out of this PC

```powershell
gh auth logout -h github.com
```

Then open **Credential Manager** (Start → "Credential Manager") → **Windows Credentials**. Remove any entries named `git:https://github.com` or `gh:github.com`.

To also revoke access on GitHub's side: **github.com → Settings → Applications → Authorized OAuth Apps** → *GitHub CLI* → **Revoke**.

## 5. Remove the Git and GitHub CLI tools

Both were installed as portable copies in `C:\Users\X\Documents\Tools`, with no installer and no admin rights. To remove them:

1. Take them off your user PATH:

   ```powershell
   $drop = 'C:\Users\X\Documents\Tools\PortableGit\cmd', 'C:\Users\X\Documents\Tools\gh\bin'
   $keep = ([Environment]::GetEnvironmentVariable('Path','User') -split ';') | Where-Object { $_ -and $drop -notcontains $_ }
   [Environment]::SetEnvironmentVariable('Path', ($keep -join ';'), 'User')
   ```

2. Close all terminals, then delete the folders:

   ```powershell
   Remove-Item -Recurse -Force 'C:\Users\X\Documents\Tools\PortableGit', 'C:\Users\X\Documents\Tools\gh'
   ```

   Delete `C:\Users\X\Documents\Tools` itself if it's now empty.

3. Leftover config files you can delete if they exist:
   - `%USERPROFILE%\.gitconfig`
   - `%APPDATA%\GitHub CLI\`

## 6. Delete the project folder

Move it to the Recycle Bin from Explorer, or:

```powershell
Remove-Item -Recurse -Force 'C:\Users\X\Documents\WorkoutApp'
```

This also deletes the local Git history. If step 1 left the GitHub repo in place, the code still exists there.

## What this doesn't touch

- **`C:\Users\X\Documents\REA`** (Ghidra and the portable Node). RepCoach only *used* that Node to run the dev server and checks. Clean it up separately if you want.
- **The exercise dataset and images.** They're hosted by third parties (GitHub / jsDelivr), not by you, so there's nothing to delete.

## Checklist

- [ ] Backup exported (if wanted)
- [ ] Pages unpublished or repo deleted, and the URL returns 404
- [ ] Removed from iPhone, with Safari website data cleared
- [ ] Removed from Mac, with website data cleared
- [ ] localhost site data cleared on this PC
- [ ] Dev server stopped, and firewall rule removed if one was created
- [ ] `gh auth logout`, stored credentials removed, OAuth app revoked
- [ ] PortableGit and gh removed from PATH and deleted
- [ ] `WorkoutApp` folder deleted
