param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExpoArguments
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Set-AndroidSdkEnvironment {
  $sdk = $env:ANDROID_HOME
  if (-not $sdk -and $env:ANDROID_SDK_ROOT) {
    $sdk = $env:ANDROID_SDK_ROOT
  }
  if (-not $sdk) {
    $defaultAndroidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (Test-Path -LiteralPath $defaultAndroidSdk) {
      $sdk = $defaultAndroidSdk
    }
  }

  if (-not $sdk -or -not (Test-Path -LiteralPath $sdk)) {
    throw 'The Android SDK was not found. Install it through Android Studio or set ANDROID_HOME to your SDK path.'
  }

  $env:ANDROID_HOME = $sdk
  $env:ANDROID_SDK_ROOT = $sdk

  $emulator = Join-Path $sdk 'emulator\emulator.exe'
  if (-not (Test-Path -LiteralPath $emulator)) {
    throw "The Android emulator was not found. Install Android SDK Platform-Tools and Android Emulator in Android Studio, then try: `"$emulator`" -list-avds"
  }

  $androidDirectory = Join-Path $repositoryRoot 'android'
  if (Test-Path -LiteralPath $androidDirectory) {
    $localProperties = Join-Path $androidDirectory 'local.properties'
    $escapedAndroidSdk = $sdk.Replace('\', '\\')
    Set-Content -LiteralPath $localProperties -Value "sdk.dir=$escapedAndroidSdk"
  }
}

Set-AndroidSdkEnvironment

if (-not $ExpoArguments) {
  $ExpoArguments = @('run:android')
}

& npx expo @ExpoArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
