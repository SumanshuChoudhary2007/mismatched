# ─────────────────────────────────────────────────────────────────────────────
# Mismatched — APK Build Script (Windows PowerShell)
# Run this from: mismatched/frontend/
# Requires: Android Studio installed with SDK & Gradle
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n🔨 Step 1: Building Vite production bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build failed" -ForegroundColor Red; exit 1 }

Write-Host "`n📦 Step 2: Syncing to Android project..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Sync failed" -ForegroundColor Red; exit 1 }

Write-Host "`n🤖 Step 3: Building debug APK via Gradle..." -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Gradle build failed" -ForegroundColor Red; Set-Location ..; exit 1 }
Set-Location ..

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $size = [math]::Round((Get-Item $apkPath).length / 1MB, 2)
    Write-Host "`n✅ APK built successfully!" -ForegroundColor Green
    Write-Host "📱 Location: frontend\$apkPath" -ForegroundColor Yellow
    Write-Host "📦 Size: ${size} MB" -ForegroundColor Yellow
    Write-Host "`n👉 Install on phone: adb install $apkPath" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  APK not found at expected path. Check android/app/build/outputs/" -ForegroundColor Yellow
}
