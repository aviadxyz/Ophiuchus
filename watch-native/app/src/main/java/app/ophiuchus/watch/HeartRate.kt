package app.ophiuchus.watch

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import kotlin.concurrent.thread

private const val SEND_EVERY_MS = 5_000L
private const val STALE_AFTER_MS = 15_000L
private const val MIN_BPM = 20f
private const val MAX_BPM = 250f

/** Wear OS 6 (API 36) replaced BODY_SENSORS with the health permission for heart rate. */
fun heartRatePermission(): String =
    if (Build.VERSION.SDK_INT >= 36) "android.permission.health.READ_HEART_RATE"
    else Manifest.permission.BODY_SENSORS

fun hasHeartRatePermission(context: Context): Boolean =
    context.checkSelfPermission(heartRatePermission()) == PackageManager.PERMISSION_GRANTED

/**
 * Reads the watch's heart-rate sensor while started and sends the latest value to the
 * events endpoint every five seconds. The reading lives in memory only until the next send.
 */
class HeartRateSender(context: Context, private val room: String) : SensorEventListener {
    private val sensors = context.getSystemService(SensorManager::class.java)
    private val sensor: Sensor? = sensors?.getDefaultSensor(Sensor.TYPE_HEART_RATE)
    private val handler = Handler(Looper.getMainLooper())

    private var latest: Float? = null
    private var latestAt = 0L
    private var running = false

    private val tick = object : Runnable {
        override fun run() {
            sendLatest()
            if (running) handler.postDelayed(this, SEND_EVERY_MS)
        }
    }

    fun start() {
        val sensor = sensor ?: return
        if (running) return
        running = true
        sensors?.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        handler.postDelayed(tick, SEND_EVERY_MS)
    }

    fun stop() {
        running = false
        handler.removeCallbacks(tick)
        sensors?.unregisterListener(this)
        latest = null
        Live.clearHeartRate()
    }

    override fun onSensorChanged(event: SensorEvent) {
        val value = event.values.firstOrNull() ?: return
        latest = value
        latestAt = SystemClock.elapsedRealtime()
        if (value in MIN_BPM..MAX_BPM) Live.setHeartRate(Math.round(value))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun sendLatest() {
        val value = latest ?: return
        val fresh = SystemClock.elapsedRealtime() - latestAt <= STALE_AFTER_MS
        if (!fresh || value < MIN_BPM || value > MAX_BPM) return
        post(room, Math.round(value))
    }

    private fun post(room: String, heartRate: Int) {
        thread(name = "ophiuchus-send") {
            Relay.post(
                room,
                "vitals.sample",
                JSONObject().put("heartRate", heartRate).put("source", "live"),
            )
        }
    }
}
