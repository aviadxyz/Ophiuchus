package app.ophiuchus.watch

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.VibratorManager
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import org.json.JSONObject
import kotlin.math.abs

private const val CODE_SECONDS = 10_000L
private const val PERMISSION_REQUEST = 1
private const val ABOUT_LINE = "Demo. Not a medical device."
private const val SLIDE_MS = 180L
private const val FLING_VELOCITY = 600f

private enum class Stage { INTRO, PICKER, RATIONALE, CODE, MAIN }

private const val EMERGENCY_PAGE = 0
private const val ABOUT_PAGE = 3

class MainActivity : Activity() {
    private lateinit var settings: Settings
    private val handler = Handler(Looper.getMainLooper())
    private var stage = Stage.PICKER
    private var resumed = false

    private var sender: HeartRateSender? = null
    private var feed: Feed? = null
    private var pages: List<Page> = emptyList()
    private var ophi: OphiPage? = null
    private var distress: DistressScreen? = null
    private var index = EMERGENCY_PAGE

    private var pageHost: FrameLayout? = null
    private var dots: TextView? = null
    private var overlay: FrameLayout? = null
    private var overlayAlertId: String? = null
    private lateinit var swipe: GestureDetector

    private val goToMain = Runnable { showMain() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = Settings(this)
        swipe = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true

            override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
                if (stage != Stage.MAIN || overlay != null) return false
                if (abs(vx) < FLING_VELOCITY || abs(vx) < abs(vy) * 1.5f) return false
                goTo(if (vx < 0) index + 1 else index - 1)
                return true
            }
        })
        when {
            !settings.introSeen -> showIntro { afterIntro() }
            settings.name == null -> showPicker()
            else -> showMain()
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        swipe.onTouchEvent(ev)
        return super.dispatchTouchEvent(ev)
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        if (stage == Stage.MAIN) startServices()
    }

    override fun onPause() {
        resumed = false
        stopServices()
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacks(goToMain)
        distress?.stop()
        ophi?.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            PERMISSION_REQUEST -> if (stage == Stage.RATIONALE) showCode()
            MIC_REQUEST -> ophi?.onMicPermission(grantResults.firstOrNull() == android.content.pm.PackageManager.PERMISSION_GRANTED)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == SPEECH_REQUEST) ophi?.onSpeechIntentResult(resultCode, data)
    }

    // ---- Set-up screens ----

    private fun afterIntro() {
        if (settings.name == null) showPicker() else showMain()
    }

    private fun showIntro(done: () -> Unit) {
        enter(Stage.INTRO)
        setContentView(Intro(this) {
            settings.introSeen = true
            done()
        }.view)
    }

    private fun showPicker() {
        enter(Stage.PICKER)
        val list = column()
        list.addView(label("Who is wearing this watch?", 18f, bold = true))
        PEOPLE.forEach { person -> list.addView(pillButton(person, 56) { choose(person) }) }
        list.addView(label(ABOUT_LINE, 13f, R.color.text_secondary))
        setContentView(scrolling(list))
    }

    private fun choose(person: String) {
        settings.name = person
        // What the console shared about the last person is not this person's.
        Live.summary = null
        Live.incoming = null
        val needsPermission = person != DEMO && !hasHeartRatePermission(this)
        if (needsPermission) showRationale() else showCode()
    }

    private fun showRationale() {
        enter(Stage.RATIONALE)
        val content = column()
        content.addView(label("Heart rate", 18f, bold = true))
        content.addView(label("Ophiuchus reads your heart rate and shows it on your console.", 15f))
        content.addView(pillButton("Continue") {
            requestPermissions(arrayOf(heartRatePermission()), PERMISSION_REQUEST)
        })
        setContentView(scrolling(content))
    }

    private fun showCode() {
        enter(Stage.CODE)
        val content = column()
        content.addView(label("Type this code into the console's Watch tab", 15f))
        content.addView(label(settings.code, 34f, R.color.accent, bold = true, mono = true))
        content.addView(label(ABOUT_LINE, 13f, R.color.text_secondary))
        content.setOnClickListener { handler.removeCallbacks(goToMain); showMain() }
        setContentView(scrolling(content))
        handler.postDelayed(goToMain, CODE_SECONDS)
    }

    // ---- The four pages ----

    private fun showMain(startAt: Int = EMERGENCY_PAGE) {
        enter(Stage.MAIN)
        val room = settings.code
        if (pages.isEmpty()) {
            val emergencyPage = DistressScreen(this, room).also { distress = it }
            val ophiPage = OphiPage(this, { settings.name }, { goTo(EMERGENCY_PAGE) }).also { ophi = it }
            pages = listOf(
                emergencyPage,
                ophiPage,
                HealthPage(this, room) { settings.name },
                AboutPage(
                    this,
                    room,
                    { settings.name },
                    { showIntro { showMain(ABOUT_PAGE) } },
                    { showPicker() },
                ),
            )
        }
        index = startAt.coerceIn(0, pages.lastIndex)
        val host = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.background)) }
        val page = FrameLayout(this)
        val dotsView = TextView(this).apply {
            textSize = 10f
            setTextColor(getColor(R.color.text_secondary))
            gravity = Gravity.CENTER
            setBackgroundColor(getColor(R.color.background))
            setPadding(0, dp(3), 0, dp(if (resources.configuration.isScreenRound) 12 else 3))
        }
        host.addView(page, matchParent())
        host.addView(
            dotsView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM)
        )
        pageHost = page
        dots = dotsView
        overlay = null
        overlayAlertId = null
        page.addView(pages[index].view, matchParent())
        updateDots()
        setContentView(host)
        pages[index].onShow()
        feed = Feed(room) { onFeedChange() }
        if (resumed) startServices()
    }

    private fun goTo(target: Int) {
        val host = pageHost ?: return
        val next = target.coerceIn(0, pages.lastIndex)
        if (next == index) return
        val outgoing = pages[index]
        val incoming = pages[next]
        val direction = if (next > index) 1 else -1
        outgoing.onHide()
        // Drop anything left from a swipe that was still sliding.
        for (i in host.childCount - 1 downTo 0) {
            val child = host.getChildAt(i)
            if (child !== outgoing.view) { child.animate().cancel(); host.removeViewAt(i) }
        }
        val width = host.width.toFloat().coerceAtLeast(1f)
        incoming.view.translationX = direction * width
        host.addView(incoming.view, matchParent())
        incoming.view.animate().translationX(0f).setDuration(SLIDE_MS).start()
        outgoing.view.animate().translationX(-direction * width).setDuration(SLIDE_MS).withEndAction {
            if (outgoing.view !== pages[index].view) host.removeView(outgoing.view)
            outgoing.view.translationX = 0f
        }.start()
        index = next
        incoming.onShow()
        incoming.refresh()
        updateDots()
    }

    private fun updateDots() {
        dots?.text = pages.indices.joinToString(" ") { if (it == index) "●" else "○" }
    }

    private fun onFeedChange() {
        pages.getOrNull(index)?.refresh()
        updateOverlay()
    }

    // ---- A crew emergency arriving on the watch ----

    private fun updateOverlay() {
        val frame = window.decorView.findViewById<ViewGroup>(android.R.id.content) ?: return
        val incoming = Live.incoming
        if (incoming == null) {
            overlay?.let { frame.removeView(it) }
            overlay = null
            overlayAlertId = null
            return
        }
        if (overlayAlertId == incoming.alertId) return
        overlay?.let { frame.removeView(it) }
        overlayAlertId = incoming.alertId
        val view = buildAlert(incoming)
        overlay = view
        frame.addView(view, matchParent())
        buzz(longArrayOf(0, 500, 200, 500, 200, 500))
    }

    private fun buildAlert(alert: IncomingAlert): FrameLayout {
        val dark = getColor(R.color.background)
        val content = column().apply { gravity = Gravity.CENTER }
        content.addView(label("Emergency from ${alert.role ?: "the crew"}", 20f, R.color.background, bold = true))
        content.addView(label(alert.message, 15f, R.color.background))
        content.addView(pillButton("Acknowledge") { acknowledge(alert) }.apply {
            setTextColor(getColor(R.color.text_primary))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(dark)
                cornerRadius = dp(28).toFloat()
            }
        })
        return FrameLayout(this).apply {
            setBackgroundColor(getColor(R.color.emergency))
            isClickable = true
            addView(scrolling(content).apply { setBackgroundColor(Color.TRANSPARENT) }, matchParent())
        }
    }

    private fun acknowledge(alert: IncomingAlert) {
        val room = settings.code
        Thread {
            Relay.post(room, "emergency.acknowledged", JSONObject().put("alertId", alert.alertId))
        }.start()
        feed?.forget(alert.alertId)
        updateOverlay()
    }

    private fun buzz(pattern: LongArray) {
        val vibrator = getSystemService(VibratorManager::class.java)?.defaultVibrator ?: return
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }

    // ---- Services that run while the pages are in front ----

    private fun startServices() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        feed?.start()
        val person = settings.name
        if (person == null || person == DEMO || !hasHeartRatePermission(this)) return
        if (sender == null) sender = HeartRateSender(this, settings.code)
        sender?.start()
    }

    private fun stopServices() {
        feed?.stop()
        sender?.stop()
        sender = null
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun enter(next: Stage) {
        handler.removeCallbacks(goToMain)
        stopServices()
        if (next != Stage.MAIN) {
            pages.getOrNull(index)?.onHide()
            overlay = null
            overlayAlertId = null
        }
        stage = next
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
    )
}
