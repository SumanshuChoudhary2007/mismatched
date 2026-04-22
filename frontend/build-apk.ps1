# -----------------------------------------------------------------------------
# Mismatched - APK Build Script (Windows PowerShell)
# -----------------------------------------------------------------------------

# Auto-detect JAVA_HOME from Android Studio if not set
if (-not $env:JAVA_HOME) {
    $potentialPaths = @(
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Android\Android Studio\jre",
        "$env:LOCALAPPDATA\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Android\Android Studio\jre"
    )
    foreach ($path in $potentialPaths) {
        if (Test-Path $path) {
            $env:JAVA_HOME = $path
            Write-Host "Auto-detected JAVA_HOME: $path"
            break
        }
    }
}

if (-not $env:JAVA_HOME) {
    Write-Host "Error: JAVA_HOME is not set and could not be auto-detected." -ForegroundColor Red
    exit 1
}

$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

Write-Host "Step 1: Building Vite production bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

Write-Host "Step 2: Syncing to Android project..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "Sync failed" -ForegroundColor Red; exit 1 }

Write-Host "Step 3: Building debug APK via Gradle..." -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Host "Gradle build failed" -ForegroundColor Red; Set-Location ..; exit 1 }
Set-Location ..

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $size = [math]::Round((Get-Item $apkPath).length / 1MB, 2)
    Write-Host "APK built successfully!" -ForegroundColor Green
    Write-Host "Location: frontend\$apkPath" -ForegroundColor Yellow
    Write-Host "Size: ${size} MB" -ForegroundColor Yellow
} else {
    Write-Host "APK not found at expected path." -ForegroundColor Yellow
}
