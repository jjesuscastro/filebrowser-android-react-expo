param(
  [ValidateSet('universal', 'x86_64', 'arm64-v8a')]
  [string]$Architecture = 'universal'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$gradleWrapper = Join-Path $repositoryRoot 'android\gradlew.bat'

if (-not $env:JAVA_HOME) {
  $androidStudioJdk = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
  if (Test-Path -LiteralPath (Join-Path $androidStudioJdk 'bin\java.exe')) {
    $env:JAVA_HOME = $androidStudioJdk
  }
}

if (-not $env:ANDROID_HOME) {
  $defaultAndroidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  if (Test-Path -LiteralPath $defaultAndroidSdk) {
    $env:ANDROID_HOME = $defaultAndroidSdk
  }
}

if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
  throw 'Java was not found. Install Android Studio or set JAVA_HOME to a compatible JDK.'
}
if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME)) {
  throw 'The Android SDK was not found. Install it through Android Studio or set ANDROID_HOME.'
}
if (-not (Test-Path -LiteralPath $gradleWrapper)) {
  throw 'android\gradlew.bat is missing. Run npm run android:prebuild first.'
}

$env:NODE_ENV = 'production'
$gradleArguments = @('-p', (Join-Path $repositoryRoot 'android'), 'assembleRelease')
if ($Architecture -ne 'universal') {
  $gradleArguments += "-PreactNativeArchitectures=$Architecture"
}

Write-Host "Building Android release ($Architecture) with $env:JAVA_HOME"
& $gradleWrapper @gradleArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $repositoryRoot 'android\app\build\outputs\apk\release\app-release.apk'
Write-Host "APK: $apk"
