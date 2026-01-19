# Auto-Updater Setup Guide

## Overview
This Tauri application includes an integrated auto-updater that checks for new versions from your custom backend API and prompts users to install updates automatically.

## How It Works

### 1. **On App Launch**
- The app automatically checks for updates 2 seconds after launch
- This happens silently in the background

### 2. **Update Detection**
- If a new version is found, a professional dialog appears with:
  - Current version vs new version comparison
  - Release notes
  - Install or postpone options

### 3. **Installation Process**
- User clicks "Install Now"
- Download progress is shown in real-time
- App automatically relaunches after installation

## Backend Setup

### Required Endpoints

Your backend must provide these endpoints (already implemented in your UpdaterController):

#### 1. **GET /api/updater/latest.json**
Returns update manifest in this format:
```json
{
  "version": "1.0.4",
  "notes": "Bug fixes and improvements",
  "pub_date": "2026-01-19T13:30:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "http://localhost:5000/api/updater/download/sync-app-poc_1.0.4_x64-setup.nsis.exe",
      "with_elevated_task": false
    }
  }
}
```

#### 2. **GET /api/updater/download/{filename}**
- Downloads the installer (.exe file)
- Must return `application/octet-stream`

#### 3. **GET /api/updater/signature/{filename}**
- Returns the signature file (.sig)
- Used to verify installer integrity

### Signature Generation

To generate signed updates:

1. **Generate Key Pair** (one-time setup):
```bash
# Install Tauri CLI
npm install -g @tauri-apps/cli

# Generate keys
tauri signer generate -w ~/.tauri/myapp.key
```

This creates:
- Private key: `~/.tauri/myapp.key`
- Public key: Printed to console

2. **Configure Environment**:
```env
TAURI_SIGNING_PRIVATE_KEY=C:/Users/HP/.tauri/myapp.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_password
TAURI_PUBLIC_KEY=dW50cnVzdGVk... # Base64 public key
```

3. **Build with Updater Artifacts**:
```bash
npm run tauri build
```

This generates in `src-tauri/target/release/bundle/nsis/`:
- `app-name_version_x64-setup.nsis.exe` - Installer
- `app-name_version_x64-setup.nsis.exe.sig` - Signature

4. **Deploy Files**:
Place these files in your backend's `updates/` directory:
- Installer exe
- Signature .sig file
- `latest.json` manifest

## Configuration Files

### 1. **tauri.conf.json**
```json
{
  "version": "1.0.3",
  "plugins": {
    "updater": {
      "pubkey": "YOUR_BASE64_PUBLIC_KEY",
      "endpoints": ["http://localhost:5000/api/updater/latest.json"],
      "dangerousInsecureTransportProtocol": true
    }
  },
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

### 2. **.env**
```env
VITE_UPDATER_URL=http://localhost:5000/api/updater
```

## Components

### UpdateDialog.tsx
Professional Material-UI dialog showing:
- Version comparison (current → new)
- Release notes
- Download progress bar
- Install/Later buttons

### useAppUpdater.ts
Custom hook managing:
- Auto-check on mount
- Update state management
- Download progress tracking
- Error handling
- Relaunch after installation

### App.tsx
Integrates updater with:
- Automatic check on startup
- Dialog display
- Error notifications

## Testing the Updater

### 1. **Prepare New Version**

Update `src-tauri/tauri.conf.json`:
```json
{
  "version": "1.0.4"
}
```

Build the new version:
```bash
npm run tauri build
```

### 2. **Deploy to Backend**

Copy from `src-tauri/target/release/bundle/nsis/`:
- `sync-app-poc_1.0.4_x64-setup.nsis.exe`
- `sync-app-poc_1.0.4_x64-setup.nsis.exe.sig`

to your backend's `updates/` folder.

### 3. **Update Manifest**

Create/update `updates/latest.json`:
```json
{
  "version": "1.0.4",
  "notes": "• Added new features\n• Fixed bugs\n• Improved performance",
  "pub_date": "2026-01-19T13:30:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "PASTE_SIGNATURE_FROM_SIG_FILE_HERE",
      "url": "http://localhost:5000/api/updater/download/sync-app-poc_1.0.4_x64-setup.nsis.exe",
      "with_elevated_task": false
    }
  }
}
```

### 4. **Test**

Run the app (version 1.0.3):
```bash
npm run tauri dev
```

The update dialog should appear automatically!

## Production Deployment

### 1. **Use HTTPS**

Change in production `.env`:
```env
VITE_UPDATER_URL=https://your-domain.com/api/updater
```

Update `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://your-domain.com/api/updater/latest.json"],
      "dangerousInsecureTransportProtocol": false  // Remove for HTTPS
    }
  }
}
```

### 2. **Secure Key Storage**

- Store private key securely (not in repo)
- Use environment variables in CI/CD
- Rotate keys periodically

### 3. **CDN for Downloads**

For better performance, host installer files on CDN:
```json
{
  "url": "https://cdn.your-domain.com/downloads/app_1.0.4.exe"
}
```

## Troubleshooting

### Update Not Detected
- Check backend is running at correct URL
- Verify `latest.json` is accessible
- Check console for error messages
- Ensure version in manifest > current version

### Signature Verification Failed
- Verify public key in `tauri.conf.json` matches private key
- Ensure `.sig` file signature is correct
- Check signature wasn't corrupted during copy/paste

### Download Fails
- Verify installer file exists in `updates/` folder
- Check file permissions
- Ensure filename matches URL in manifest
- Verify backend returns `application/octet-stream`

## Version Comparison

Tauri uses semantic versioning (semver):
- `1.0.4` > `1.0.3` ✅ Update shown
- `1.0.3` = `1.0.3` ❌ No update
- `1.1.0` > `1.0.9` ✅ Update shown

## Security Notes

- Always use HTTPS in production
- Keep private keys secure and encrypted
- Validate all downloaded files
- Use code signing certificates for Windows
- Implement rate limiting on backend endpoints

## Advanced Features

### Silent Updates
```typescript
// In useAppUpdater.ts
const installUpdate = async () => {
  await pendingUpdate.downloadAndInstall(); // No dialog
  await relaunch(); // Auto-relaunch
};
```

### Manual Check
```typescript
// Add button in UI
<Button onClick={checkForUpdates}>
  Check for Updates
</Button>
```

### Update Channels
```json
{
  "endpoints": [
    "https://api.example.com/updates/stable/latest.json",
    "https://api.example.com/updates/beta/latest.json"
  ]
}
```

## Files Created/Modified

✅ **New Files:**
- `src/components/UpdateDialog.tsx` - Update UI dialog
- `src/hooks/useAppUpdater.ts` - Update logic hook
- `UPDATER.md` - This documentation

✅ **Modified Files:**
- `src/App.tsx` - Integrated updater
- `src-tauri/tauri.conf.json` - Updater configuration
- `.env` - Added updater URL

## Support

For issues:
1. Check console logs
2. Verify backend endpoints
3. Test signature manually
4. Review Tauri updater docs: https://v2.tauri.app/plugin/updater/
