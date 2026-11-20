package com.maria.lifehub;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StepCounter")
public class StepCounterPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor stepSensor;
    private boolean listening = false;

    @PluginMethod
    public void start(PluginCall call) {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        if (stepSensor == null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
        if (stepSensor == null) {
            call.reject("Step sensor not available");
            return;
        }
        listening = true;
        sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        listening = false;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!listening) return;
        JSObject data = new JSObject();
        data.put("value", event.values.length > 0 ? event.values[0] : 1.0);
        notifyListeners("step", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }
}
