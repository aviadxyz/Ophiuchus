package app.ophiuchus.watch

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject

private const val POLL_MS = 2_000L
private const val STALE_READING_MS = 15_000L
private const val OPEN_ALERT_WINDOW_MS = 10 * 60_000L

/** One health area as the console sends it in `summary.updated`. */
data class Area(val level: String, val text: String, val source: String?)

/** The console's `HealthSummary` (CONTRACTS sections 8 and 10). */
data class Summary(
    val sleep: Area,
    val food: Area,
    val water: Area,
    val exercise: Area,
    val mood: Area,
    val openAlerts: Int,
    val ophiLine: String,
    val updatedAt: String,
)

/** A crew emergency waiting for this watch to acknowledge it. */
data class IncomingAlert(val alertId: String, val message: String, val role: String?)

/** What the screens read. Only ever touched on the main thread. Nothing here is written to disk. */
object Live {
    var summary: Summary? = null
    var online: Boolean? = null
    var incoming: IncomingAlert? = null

    private var heartRate: Int? = null
    private var heartRateAt = 0L

    fun setHeartRate(bpm: Int) {
        heartRate = bpm
        heartRateAt = SystemClock.elapsedRealtime()
    }

    fun clearHeartRate() {
        heartRate = null
    }

    /** The latest reading, or null when there is none or it is old. */
    fun freshHeartRate(): Int? {
        val bpm = heartRate ?: return null
        return if (SystemClock.elapsedRealtime() - heartRateAt <= STALE_READING_MS) bpm else null
    }
}

/**
 * Polls the events endpoint every two seconds while the app is in front. It keeps the latest
 * health summary and the crew emergency that is still open, and tells the activity when either changes.
 */
class Feed(private val room: String, private val onChange: () -> Unit) {
    private val handler = Handler(Looper.getMainLooper())
    private var running = false
    private var cursor: String? = null
    private val open = LinkedHashMap<String, IncomingAlert>()

    private val tick = object : Runnable {
        override fun run() {
            if (!running) return
            Thread {
                val poll = Relay.fetch(room, cursor)
                handler.post {
                    if (!running) return@post
                    Live.online = poll != null
                    if (poll != null) {
                        cursor = poll.cursor ?: cursor
                        apply(poll.events)
                    }
                    onChange()
                    handler.postDelayed(this, POLL_MS)
                }
            }.apply { name = "ophiuchus-feed" }.start()
        }
    }

    fun start() {
        if (running) return
        running = true
        handler.post(tick)
    }

    fun stop() {
        running = false
        handler.removeCallbacks(tick)
    }

    /** Called by the screen after this watch has acknowledged, so the alert is not shown again. */
    fun forget(alertId: String) {
        open.remove(alertId)
        Live.incoming = open.values.lastOrNull()
    }

    private fun apply(events: List<JSONObject>) {
        for (event in events) {
            val payload = event.optJSONObject("payload") ?: continue
            when (event.optString("type")) {
                "summary.updated" -> parseSummary(payload)?.let { Live.summary = it }
                "emergency.raised" -> {
                    if (event.optString("origin") != "console") continue
                    if (!isRecent(event.optString("at"))) continue
                    val id = payload.optString("alertId")
                    if (id.isEmpty()) continue
                    open[id] = IncomingAlert(
                        id,
                        payload.optString("message").ifEmpty { "Emergency" },
                        payload.optString("role").ifEmpty { null },
                    )
                }
                "emergency.cancelled", "emergency.acknowledged" -> open.remove(payload.optString("alertId"))
            }
        }
        Live.incoming = open.values.lastOrNull()
    }

    private fun isRecent(at: String): Boolean = try {
        System.currentTimeMillis() - java.time.Instant.parse(at).toEpochMilli() <= OPEN_ALERT_WINDOW_MS
    } catch (e: Exception) {
        false
    }

    private fun parseSummary(json: JSONObject): Summary? {
        fun area(key: String): Area? {
            val o = json.optJSONObject(key) ?: return null
            return Area(
                o.optString("level", "none"),
                o.optString("text"),
                o.optString("source").ifEmpty { null },
            )
        }
        return Summary(
            sleep = area("sleep") ?: return null,
            food = area("food") ?: return null,
            water = area("water") ?: return null,
            exercise = area("exercise") ?: return null,
            mood = area("mood") ?: return null,
            openAlerts = json.optInt("openAlerts", 0),
            ophiLine = json.optString("ophiLine"),
            updatedAt = json.optString("updatedAt"),
        )
    }
}
