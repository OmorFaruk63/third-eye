---
name: auto-install-dev
description: >-
  Automatically builds and installs the dev debug APK on a USB-connected Android device
  after completing any coding task in the Third Eye project. If a USB device is detected
  via ADB, always run assembleDevDebug and install app-dev-debug.apk without asking permission.
---

# Auto Install Dev APK Skill

## Core Principle

যখনই কোনো কাজ (code change, bug fix, feature add, etc.) সম্পন্ন হবে — **যদি USB এ কোনো Android device connected থাকে** — তাহলে স্বয়ংক্রিয়ভাবে dev APK build করে install করতে হবে। কোনো permission চাওয়া লাগবে না।

---

## Trigger Condition

এই skill নিচের যেকোনো পরিস্থিতিতে activate হবে:

- User কোনো code change করতে বললে এবং task শেষ হলে
- User explicitly বললে "install করো", "build করো", "phone এ দাও"
- User নতুন feature/fix চাইলে এবং কাজ শেষ হওয়ার পর

**Check করার শর্ত**: USB device connected কিনা নিচের command দিয়ে যাচাই করো:
```bash
adb devices
```
যদি output এ `device` শব্দ থাকে (emulator বাদে real device), তাহলে install workflow শুরু করো।

---

## Install Workflow (Step-by-Step)

### Step 1: Device Check
```bash
adb devices
```
- যদি কোনো real device না থাকে → skip করো, user কে জানাও।
- যদি device থাকে → Step 2 এ যাও।

### Step 2: Build Dev Debug APK
```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home \
  ./gradlew assembleDevDebug 2>&1
```
- Project root: `/Users/omor-faruk/Documents/My Project/third eye/`
- যদি build fail করে → error দেখাও, install skip করো।

### Step 3: Install APK
Device serial নিয়ে install করো:
```bash
# Device serial বের করো:
DEVICE=$(adb devices | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)

# Install করো:
adb -s "$DEVICE" install -r "./app/build/outputs/apk/dev/debug/app-dev-debug.apk"
```

### Step 4: Report Result
- ✅ Success হলে: "Dev APK সফলভাবে install হয়েছে!"
- ❌ Fail হলে: error message দেখাও।

---

## Important Notes

- **JAVA_HOME** সবসময় set করতে হবে: `/opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home`
- APK path: `./app/build/outputs/apk/dev/debug/app-dev-debug.apk`
- Project root: `/Users/omor-faruk/Documents/My Project/third eye/`
- `-r` flag দিয়ে install করো যাতে existing app replace হয়
- Multiple devices থাকলে প্রথমটাতে install করো অথবা user কে জিজ্ঞেস করো

---

## Example Behavior

**User বললো**: "এই bug টা fix করো"

**Agent করবে**:
1. Bug fix করবে (code edit)
2. `adb devices` চেক করবে
3. Device পেলে → `assembleDevDebug` build করবে
4. Build success হলে → `adb install` দিয়ে phone এ install করবে
5. "কাজ শেষ! Dev APK install হয়ে গেছে।" বলবে
