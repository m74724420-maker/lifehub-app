package com.maria.lifehub;

import android.Manifest;
import android.content.Intent;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;

@CapacitorPlugin(
    name = "AudioRecording",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class AudioRecordingPlugin extends Plugin {

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            granted = getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        } else {
            granted = true;
        }
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkMicrophonePermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        if (getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("microphone", call, "microphonePermissionResult");
    }

    @PermissionCallback
    private void microphonePermissionResult(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        requestPermissionForAlias("notifications", call, "notificationPermissionResult");
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            granted = getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        } else {
            granted = true;
        }
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission is required");
            return;
        }
        Intent intent = new Intent(getContext(), AudioRecordingService.class);
        String outputFile = call.getString("outputFile");
        if (outputFile != null) intent.putExtra("outputFile", outputFile);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioRecordingService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void listRecordings(PluginCall call) {
        JSArray arr = new JSArray();
        File dir = getContext().getExternalFilesDir("sleep");
        if (dir != null && dir.exists()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.getName().endsWith(".m4a")) {
                        JSObject o = new JSObject();
                        o.put("name", f.getName());
                        o.put("path", f.getAbsolutePath());
                        o.put("size", f.length());
                        arr.put(o);
                    }
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("files", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void readRecording(PluginCall call) {
        String name = call.getString("name");
        if (name == null) { call.reject("name required"); return; }
        File dir = getContext().getExternalFilesDir("sleep");
        File f = new File(dir, name);
        if (!f.exists()) { call.reject("file not found"); return; }
        try {
            FileInputStream fis = new FileInputStream(f);
            byte[] bytes = new byte[(int) f.length()];
            fis.read(bytes);
            fis.close();
            String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("base64", b64);
            ret.put("name", name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("read failed: " + e.getMessage());
        }
    }
}
