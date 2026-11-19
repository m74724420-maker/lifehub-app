package com.maria.lifehub;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.IOException;

public class AudioRecordingService extends Service {
    private static final String TAG = "AudioRecordingService";
    private static final String CHANNEL_ID = "lifehub_recording";
    private static final int SAMPLE_RATE = 16000;
    private static final int THRESHOLD = 2500; // RMS threshold
    private static final int SILENCE_MS = 2000;

    private AudioRecord audioRecord;
    private MediaRecorder mediaRecorder;
    private Thread monitorThread;
    private volatile boolean running = false;
    private volatile boolean recording = false;
    private long recordingStart;
    private String currentFile;
    private long lastSoundTime;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            stopAll();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(1, buildNotification());
        startMonitoring();
        return START_STICKY;
    }

    private void startMonitoring() {
        running = true;
        int bufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufSize);
        audioRecord.startRecording();

        monitorThread = new Thread(() -> {
            short[] buffer = new short[bufSize / 2];
            while (running) {
                int read = audioRecord.read(buffer, 0, buffer.length);
                if (read <= 0) continue;
                long sum = 0;
                for (int i = 0; i < read; i++) sum += buffer[i] * buffer[i];
                double rms = Math.sqrt(sum / (double) read);
                long now = System.currentTimeMillis();
                if (rms > THRESHOLD) {
                    lastSoundTime = now;
                    if (!recording) startChunk();
                } else {
                    if (recording && now - lastSoundTime > SILENCE_MS) {
                        stopChunk();
                    }
                }
            }
        });
        monitorThread.start();
    }

    private void startChunk() {
        try {
            File dir = getExternalFilesDir("sleep");
            if (dir != null && !dir.exists()) dir.mkdirs();
            currentFile = new File(dir, "sleep_" + System.currentTimeMillis() + ".m4a").getAbsolutePath();
            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setOutputFile(currentFile);
            mediaRecorder.prepare();
            mediaRecorder.start();
            recording = true;
            recordingStart = System.currentTimeMillis();
            Log.d(TAG, "Chunk started: " + currentFile);
        } catch (IOException e) {
            Log.e(TAG, "startChunk failed", e);
        }
    }

    private void stopChunk() {
        if (mediaRecorder != null && recording) {
            try {
                mediaRecorder.stop();
            } catch (Exception e) {
                Log.e(TAG, "stopChunk failed", e);
            }
            mediaRecorder.release();
            mediaRecorder = null;
            recording = false;
            Log.d(TAG, "Chunk stopped: " + currentFile);
        }
    }

    private void stopAll() {
        running = false;
        if (monitorThread != null) {
            try { monitorThread.join(1000); } catch (InterruptedException ignored) {}
        }
        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
            audioRecord = null;
        }
        stopChunk();
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Мой Личный Хаб")
                .setContentText("Запись звуков сна (только громкие)")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Запись сна", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopAll();
        super.onDestroy();
    }
}