#!/usr/bin/env bash
# Compila mybrothar.apk (shell WebView de MyBrothar) con las build-tools del runner.
# Sin Gradle: aapt2 -> javac -> d8 -> zip -> zipalign -> apksigner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/android/app/src/main"
OUT="$ROOT/dist"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$BT" ]; then
  yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" "build-tools;34.0.0" > /dev/null
  BT="$SDK/build-tools/34.0.0"
fi
PLAT="$(ls -d "$SDK"/platforms/android-* 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$PLAT" ]; then
  yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" "platforms;android-34" > /dev/null
  PLAT="$SDK/platforms/android-34"
fi
echo "build-tools: $BT"
echo "platform:    $PLAT"

mkdir -p "$BUILD/gen" "$BUILD/obj" "$BUILD/dex" "$OUT"

# 1) recursos
"$BT/aapt2" compile --dir "$SRC/res" -o "$BUILD/res.zip"
"$BT/aapt2" link \
  -o "$BUILD/app.unaligned.apk" \
  -I "$PLAT/android.jar" \
  --manifest "$SRC/AndroidManifest.xml" \
  -R "$BUILD/res.zip" \
  --java "$BUILD/gen" \
  --auto-add-overlay

# 2) código Java -> .class
find "$SRC/java" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac --release 11 -classpath "$PLAT/android.jar" -d "$BUILD/obj" @"$BUILD/sources.txt"

# 3) .class -> classes.dex
find "$BUILD/obj" -name '*.class' -print0 | xargs -0 "$BT/d8" \
  --release --lib "$PLAT/android.jar" --min-api 24 --output "$BUILD/dex"

# 4) dex dentro del APK
(cd "$BUILD/dex" && zip -q -X "$BUILD/app.unaligned.apk" classes.dex)

# 5) alinear y firmar (keystore debug generado al vuelo)
"$BT/zipalign" -f -p 4 "$BUILD/app.unaligned.apk" "$BUILD/app.aligned.apk"
KS="$BUILD/debug.keystore"
keytool -genkeypair -keystore "$KS" -storepass android -keypass android \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US" > /dev/null 2>&1
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$OUT/mybrothar.apk" "$BUILD/app.aligned.apk"
"$BT/apksigner" verify "$OUT/mybrothar.apk" && echo "✅ firma verificada"
echo "APK listo: $(du -h "$OUT/mybrothar.apk" | cut -f1)"
