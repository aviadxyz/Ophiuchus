package app.ophiuchus.watch

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.VibratorManager
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.concurrent.thread

private const val HOLD_MS = 2_000L
private const val CANCEL_WINDOW_MS = 10_000L
private const val RETRY_MS = 3_000L
private const val POLL_MS = 2_000L
private const val GIVE_UP_AFTER_MS = 10 * 60_000L
private const val EMERGENCY_MESSAGE = "Emergency from watch"
private const val EMERGENCY = "#F59E0B"

/**
 * The distress screen: hold the amber button for two seconds to raise `emergency.raised`,
 * cancel within ten seconds, and see when the console acknowledges it.
 */
class DistressScreen(
    private val context: Context,
    private val room: String,
    private val onClose: () -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val root = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(context.getColor(R.color.background))
    }
    private var alertId: String? = null
    private var sentAt = 0L
    private var stopped = false
    private var cursor: String? = null

    val view: View get() = root

    init {
        showReady()
    }

    fun stop() {
        stopped = true
        handler.removeCallbacksAndMessages(null)
    }

    private fun showReady() {
        root.removeAllViews()
        root.addView(text("Distress", 18f, R.color.text_primary, bold = true))
        val hold = HoldButton(context) { raise() }
        root.addView(hold, LinearLayout.LayoutParams(dp(120), dp(120)).apply { topMargin = dp(6) })
        root.addView(text("Hold for 2 seconds", 14f, R.color.text_primary))
        root.addView(text("Demo. No real alert is sent.", 12f, R.color.text_secondary))
        root.addView(button("Back") { stop(); onClose() })
    }

    private fun raise() {
        val id = UUID.randomUUID().toString()
        alertId = id
        sentAt = System.currentTimeMillis()
        buzz(longArrayOf(0, 400))
        showSent(delivered = false)
        send(id)
        handler.postDelayed({ hideCancel() }, CANCEL_WINDOW_MS)
        handler.postDelayed(::poll, POLL_MS)
    }

    private fun send(id: String) {
        thread(name = "ophiuchus-distress") {
            val ok = Relay.post(
                room,
                "emergency.raised",
                JSONObject().put("alertId", id).put("message", EMERGENCY_MESSAGE),
            )
            handler.post {
                if (stopped || alertId != id) return@post
                if (ok) showSent(delivered = true) else handler.postDelayed({ retry(id) }, RETRY_MS)
            }
        }
    }

    private fun retry(id: String) {
        if (stopped || alertId != id) return
        if (System.currentTimeMillis() - sentAt > GIVE_UP_AFTER_MS) return
        send(id)
    }

    private var cancelButton: Button? = null
    private var statusView: TextView? = null

    private fun showSent(delivered: Boolean, acknowledged: Boolean = false) {
        root.removeAllViews()
        val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(sentAt))
        root.addView(text(if (delivered) "Alert sent" else "Alert saved", 20f, R.color.text_primary, bold = true))
        root.addView(text(time, 14f, R.color.text_secondary))
        val status = text(
            when {
                acknowledged -> "Help is on the way"
                delivered -> "Waiting for the console"
                else -> "Sending when connected"
            },
            16f,
            if (acknowledged) R.color.accent else R.color.text_primary,
        )
        statusView = status
        root.addView(status)
        if (!acknowledged && System.currentTimeMillis() - sentAt < CANCEL_WINDOW_MS) {
            cancelButton = button("Cancel alert") { cancel() }.also { root.addView(it) }
        }
        root.addView(button("Done") { stop(); onClose() })
    }

    private fun hideCancel() {
        cancelButton?.let { root.removeView(it) }
        cancelButton = null
    }

    private fun cancel() {
        val id = alertId ?: return
        alertId = null
        handler.removeCallbacksAndMessages(null)
        thread(name = "ophiuchus-distress") {
            Relay.post(room, "emergency.cancelled", JSONObject().put("alertId", id))
        }
        showReady()
    }

    private fun poll() {
        val id = alertId ?: return
        if (stopped) return
        thread(name = "ophiuchus-distress") {
            val result = Relay.pollAcknowledgement(room, id, cursor)
            handler.post {
                if (stopped || alertId != id) return@post
                if (result != null) cursor = result.cursor
                if (result?.acknowledged == true) {
                    buzz(longArrayOf(0, 200, 120, 200))
                    showSent(delivered = true, acknowledged = true)
                } else if (System.currentTimeMillis() - sentAt < GIVE_UP_AFTER_MS) {
                    handler.postDelayed(::poll, POLL_MS)
                }
            }
        }
    }

    private fun buzz(pattern: LongArray) {
        val vibrator = context.getSystemService(VibratorManager::class.java)?.defaultVibrator ?: return
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }

    private fun text(value: String, size: Float, color: Int, bold: Boolean = false) =
        TextView(context).apply {
            text = value
            textSize = size
            setTextColor(context.getColor(color))
            gravity = Gravity.CENTER
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(2), 0, dp(2))
        }

    private fun button(label: String, onClick: () -> Unit) = Button(context).apply {
        text = label
        isAllCaps = false
        textSize = 15f
        setTextColor(context.getColor(R.color.text_primary))
        setBackgroundColor(context.getColor(R.color.surface_raised))
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(dp(150), dp(44)).apply { topMargin = dp(4) }
    }

    private fun dp(value: Int) = (value * context.resources.displayMetrics.density).toInt()
}

/** A round amber button that fires only after being held for two seconds, with a ring that fills. */
private class HoldButton(context: Context, private val onHeld: () -> Unit) : View(context) {
    private var progress = 0f
    private var animator: ValueAnimator? = null
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor(EMERGENCY) }
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        color = Color.WHITE
    }
    private val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#07090F")
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }

    init {
        contentDescription = "Distress. Press and hold for two seconds."
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val radius = minOf(cx, cy) - 6f
        canvas.drawCircle(cx, cy, radius, fill)
        ring.strokeWidth = width * 0.05f
        val inset = ring.strokeWidth / 2f
        canvas.drawArc(RectF(inset, inset, width - inset, height - inset), -90f, 360f * progress, false, ring)
        label.textSize = width * 0.2f
        canvas.drawText("SOS", cx, cy + label.textSize / 3f, label)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                start()
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> reset()
        }
        return true
    }

    private fun start() {
        animator?.cancel()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = HOLD_MS
            addUpdateListener { progress = it.animatedValue as Float; invalidate() }
            addListener(object : AnimatorListenerAdapter() {
                private var cancelled = false
                override fun onAnimationCancel(animation: Animator) { cancelled = true }
                override fun onAnimationEnd(animation: Animator) { if (!cancelled) onHeld() }
            })
            start()
        }
    }

    private fun reset() {
        animator?.cancel()
        progress = 0f
        invalidate()
    }
}
