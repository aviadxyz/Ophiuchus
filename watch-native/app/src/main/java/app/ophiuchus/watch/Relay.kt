package app.ophiuchus.watch

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.util.UUID

private const val TAG = "Ophiuchus"
private const val TIMEOUT_MS = 5_000

/** Talks to the console's events endpoint (CONTRACTS section 10 and 11). Blocking: call off the main thread. */
object Relay {
    /** Sends one message. Returns true when the server accepted it. Never logs the payload. */
    fun post(room: String, type: String, payload: JSONObject): Boolean {
        val body = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("room", room)
            .put("type", type)
            .put("at", Instant.now().toString())
            .put("origin", "watch")
            .put("payload", payload)
        return try {
            val connection = URL("$BASE_URL/api/events").openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = TIMEOUT_MS
                connection.readTimeout = TIMEOUT_MS
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
                val status = connection.responseCode
                if (status !in 200..299) Log.w(TAG, "send $type: HTTP $status")
                status in 200..299
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            Log.w(TAG, "send $type failed: ${e.javaClass.simpleName}")
            false
        }
    }

    /** What a poll found: whether the alert was acknowledged, and where to continue from. */
    data class Poll(val acknowledged: Boolean, val cursor: String?)

    fun pollAcknowledgement(room: String, alertId: String, after: String?): Poll? {
        return try {
            val query = "room=${URLEncoder.encode(room, "UTF-8")}" +
                (after?.let { "&after=${URLEncoder.encode(it, "UTF-8")}" } ?: "")
            val connection = URL("$BASE_URL/api/events?$query").openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = TIMEOUT_MS
                connection.readTimeout = TIMEOUT_MS
                if (connection.responseCode !in 200..299) return null
                val json = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                val events = json.optJSONArray("events")
                var acknowledged = false
                if (events != null) {
                    for (i in 0 until events.length()) {
                        val event = events.getJSONObject(i)
                        val sameAlert = event.optJSONObject("payload")?.optString("alertId") == alertId
                        if (event.optString("type") == "emergency.acknowledged" && sameAlert) {
                            acknowledged = true
                        }
                    }
                }
                Poll(acknowledged, json.optString("cursor").ifEmpty { after })
            } finally {
                connection.disconnect()
            }
        } catch (e: Exception) {
            null
        }
    }
}
