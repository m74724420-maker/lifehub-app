import os

path = "android/app/src/main/AndroidManifest.xml"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

permissions = [
    "android.permission.RECORD_AUDIO",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    "android.permission.WAKE_LOCK",
]
missing = [p for p in permissions if p not in s]
if missing:
    lines = ''.join('<uses-permission android:name="%s" />\n' % p for p in missing)
    s = s.replace("<application", lines + "<application", 1)

service = ('<service android:name=".AudioRecordingService" '
           'android:foregroundServiceType="microphone" android:exported="false" />')
if "AudioRecordingService" not in s:
    s = s.replace("</application>", service + "\n</application>", 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(s)

print("Manifest patched")
