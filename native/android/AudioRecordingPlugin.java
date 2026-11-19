package com.maria.lifehub;

import android.content.Intent;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;

@CapacitorPlugin(name = "AudioRecording")
public class AudioRecordingPlugin extends Plugin {
    private static final String TAG = "AudioRecordingPlugin";

    @PluginMethod
    public void startRecording(PluginCall call) {
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