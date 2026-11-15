package app.ophiuchus.watch

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val TICK_MS = 1_000L

/** Health overview: heart rate from this watch, and the console's summary of sleep, food, water, exercise and mood. */
class HealthPage(
    private val context: Context,
    private val code: String,
    private val person: () -> String?,
) : Page {
    private val handler = Handler(Looper.getMainLooper())
    private val host = context.column()
    private var showing = false

    override val view: View = context.scrolling(host)

    private val tick = object : Runnable {
        override fun run() {
            if (!showing) return
            refresh()
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onShow() {
        drawn = null
        showing = true
        handler.post(tick)
    }

    override fun onHide() {
        showing = false
        handler.removeCallbacks(tick)
    }

    private var drawn: List<Any?>? = null

    override fun refresh() {
        // Redraw only when something shown has changed, so a scroll position is not lost every second.
        val state = listOf(Live.freshHeartRate(), Live.summary, person())
        if (state == drawn) return
        drawn = state
        host.removeAllViews()
        host.addView(context.label("Health", 18f, bold = true))
        host.addView(heartRate())
        val summary = Live.summary
        if (summary == null) {
            host.addView(context.label("Waiting for the console.", 14f, R.color.text_secondary))
            host.addView(context.label("Type this code into the console's Watch tab:", 12f, R.color.text_secondary))
            host.addView(context.label(code, 22f, R.color.accent, bold = true, mono = true))
            return
        }
        host.addView(area("Sleep", summary.sleep))
        host.addView(area("Exercise", summary.exercise))
        host.addView(area("Mood", summary.mood))
        host.addView(area("Food", summary.food))
        host.addView(area("Water", summary.water))
        if (summary.openAlerts > 0) {
            host.addView(context.label("Open alerts: ${summary.openAlerts}", 14f, R.color.amber, bold = true))
        }
        if (summary.ophiLine.isNotBlank()) {
            host.addView(context.label("Ophi: ${summary.ophiLine}", 13f, R.color.text_primary))
        }
        host.addView(context.label(updated(summary.updatedAt), 11f, R.color.text_secondary))
    }

    private fun heartRate(): View {
        val box = context.column()
        val bpm = Live.freshHeartRate()
        when {
            bpm != null -> {
                box.addView(context.label("$bpm bpm", 30f, R.color.text_primary, bold = true))
                box.addView(context.badge("LIVE", R.color.accent))
            }
            person() == DEMO -> {
                box.addView(context.label("Heart rate", 14f, R.color.text_secondary))
                box.addView(context.label("No sensor reading for Demo", 13f, R.color.text_secondary))
            }
            else -> {
                box.addView(context.label("Heart rate", 14f, R.color.text_secondary))
                box.addView(context.label("No reading", 16f, R.color.text_secondary))
            }
        }
        box.setPadding(0, 0, 0, context.dp(6))
        return box
    }

    private fun area(name: String, area: Area): View {
        val (symbol, word, color) = when (area.level) {
            "ok" -> Triple("✓", "On target", R.color.accent)
            "watch" -> Triple("▲", "Watch", R.color.amber)
            "act" -> Triple("!", "Act", R.color.red)
            else -> Triple("–", "No data", R.color.text_secondary)
        }
        val row = context.column().apply {
            setPadding(0, context.dp(4), 0, context.dp(4))
        }
        val head = LinearLayout(context).apply {
            gravity = Gravity.CENTER
            addView(context.label(name, 15f, bold = true))
            addView(context.label("  $symbol $word", 14f, color, bold = true))
        }
        row.addView(head)
        if (area.text.isNotBlank()) row.addView(context.label(area.text, 12f, R.color.text_secondary))
        area.source?.let { row.addView(context.badge(it.uppercase())) }
        return row
    }

    private fun updated(at: String): String = try {
        val time = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(at))
        "Updated $time"
    } catch (e: Exception) {
        "Updated from the console"
    }
}
