package app.ophiuchus.watch

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.GestureDetector
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

private const val CODE_SECONDS = 10_000L
private const val PERMISSION_REQUEST = 1
private const val ABOUT_LINE = "Demo. Not a medical device."
private const val LONG_PRESS_TOP_FRACTION = 0.15f

private enum class Screen { PICKER, RATIONALE, CODE, FACE, MENU, DISTRESS }

class MainActivity : Activity() {
    private lateinit var settings: Settings
    private val handler = Handler(Looper.getMainLooper())
    private var screen = Screen.PICKER
    private var sender: HeartRateSender? = null
    private var webView: WebView? = null
    private var faceFailed = false
    private lateinit var longPress: GestureDetector

    private var distress: DistressScreen? = null

    private val goToFace = Runnable { showFace() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = Settings(this)
        longPress = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onLongPress(e: MotionEvent) {
                val inTopEdge = e.y < window.decorView.height * LONG_PRESS_TOP_FRACTION
                if (screen == Screen.FACE && inTopEdge) showMenu()
            }
        })
        if (settings.name == null) showPicker() else showFace()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        longPress.onTouchEvent(ev)
        return super.dispatchTouchEvent(ev)
    }

    override fun onResume() {
        super.onResume()
        if (screen == Screen.FACE) {
            if (faceFailed) loadFace()
            startHeartRate()
        }
    }

    override fun onPause() {
        stopHeartRate()
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacks(goToFace)
        distress?.stop()
        webView?.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST && screen == Screen.RATIONALE) showCode()
    }

    // ---- Screens ----

    private fun showPicker() {
        enter(Screen.PICKER)
        val list = column()
        list.addView(title("Who is wearing this watch?"))
        PEOPLE.forEach { person -> list.addView(personRow(person)) }
        list.addView(small(ABOUT_LINE))
        setContentView(scrolling(list))
    }

    private fun showMenu() {
        enter(Screen.MENU)
        val content = column()
        content.addView(title("Ophiuchus"))
        content.addView(button("Send distress") { showDistress { showFace() } })
        content.addView(button("Change person") { showPicker() })
        content.addView(button("Back to face") { showFace() })
        content.addView(small(ABOUT_LINE))
        setContentView(scrolling(content))
    }

    private fun showDistress(back: () -> Unit) {
        enter(Screen.DISTRESS)
        val screenView = DistressScreen(this, settings.code, back)
        distress = screenView
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(screenView.view)
    }

    private fun choose(person: String) {
        settings.name = person
        val needsPermission = person != DEMO && !hasHeartRatePermission(this)
        if (needsPermission) showRationale() else showCode()
    }

    private fun showRationale() {
        enter(Screen.RATIONALE)
        val content = column()
        content.addView(title("Heart rate"))
        content.addView(body("Ophiuchus reads your heart rate and shows it on your console."))
        content.addView(button("Continue") {
            requestPermissions(arrayOf(heartRatePermission()), PERMISSION_REQUEST)
        })
        setContentView(scrolling(content))
    }

    private fun showCode() {
        enter(Screen.CODE)
        val content = column()
        content.addView(body("Type this code into the console's Watch tab"))
        content.addView(TextView(this).apply {
            text = settings.code
            setTextColor(color(R.color.accent))
            textSize = 34f
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            letterSpacing = 0.12f
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(8))
        })
        content.addView(small(ABOUT_LINE))
        content.setOnClickListener { handler.removeCallbacks(goToFace); showFace() }
        setContentView(scrolling(content))
        handler.postDelayed(goToFace, CODE_SECONDS)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showFace() {
        enter(Screen.FACE)
        val view = try {
            WebView(this).apply {
                setBackgroundColor(color(R.color.background))
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                webViewClient = FaceClient()
            }
        } catch (e: Throwable) {
            setContentView(scrolling(fallbackContent()))
            return
        }
        webView = view
        setContentView(FrameLayout(this).apply { addView(view, matchParent()) })
        loadFace()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        startHeartRate()
    }

    private fun fallbackContent(): LinearLayout {
        val content = column()
        content.addView(title("No web view on this watch"))
        content.addView(body(watchFaceUrl(settings.code, settings.name)))
        content.addView(TextView(this).apply {
            text = settings.code
            setTextColor(color(R.color.accent))
            textSize = 30f
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            gravity = Gravity.CENTER
        })
        content.addView(button("Send distress") { showDistress { showFace() } })
        content.addView(small(ABOUT_LINE))
        return content
    }

    private fun loadFace() {
        faceFailed = false
        webView?.loadUrl(watchFaceUrl(settings.code, settings.name))
    }

    private inner class FaceClient : WebViewClient() {
        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (!request.isForMainFrame) return
            faceFailed = true
            val message = "<body style='background:#07090F;color:#E6EAF2;font:18px sans-serif;" +
                "text-align:center;padding:30% 12%'>Cannot reach the console. " +
                "Check the watch's connection.</body>"
            view.loadData(message, "text/html", "utf-8")
        }
    }

    // ---- Heart rate ----

    private fun startHeartRate() {
        val person = settings.name
        if (person == null || person == DEMO || !hasHeartRatePermission(this)) return
        if (sender == null) sender = HeartRateSender(this, settings.code)
        sender?.start()
    }

    private fun stopHeartRate() {
        sender?.stop()
        sender = null
    }

    private fun enter(next: Screen) {
        handler.removeCallbacks(goToFace)
        distress?.stop()
        distress = null
        stopHeartRate()
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (next != Screen.FACE) {
            webView?.destroy()
            webView = null
        }
        screen = next
    }

    // ---- Views ----

    private fun column() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
    }

    private fun scrolling(content: View): ScrollView {
        val metrics = resources.displayMetrics
        val round = resources.configuration.isScreenRound
        val sideInset = if (round) (metrics.widthPixels * 0.12f).toInt() else dp(12)
        val edgeInset = if (round) (metrics.heightPixels * 0.2f).toInt() else dp(12)
        return ScrollView(this).apply {
            setBackgroundColor(color(R.color.background))
            isFocusable = true
            isFocusableInTouchMode = true
            setPadding(sideInset, edgeInset, sideInset, edgeInset)
            clipToPadding = false
            isVerticalScrollBarEnabled = false
            addView(content, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            post { requestFocus() }
        }
    }

    private fun title(text: String) = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.text_primary))
        textSize = 18f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        setPadding(0, 0, 0, dp(10))
    }

    private fun body(text: String) = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.text_primary))
        textSize = 15f
        gravity = Gravity.CENTER
        setPadding(0, 0, 0, dp(8))
    }

    private fun small(text: String) = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.text_secondary))
        textSize = 13f
        gravity = Gravity.CENTER
        setPadding(0, dp(8), 0, dp(8))
    }

    private fun personRow(person: String) = button(person) { choose(person) }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 20f
        setTextColor(color(R.color.text_primary))
        background = GradientDrawable().apply {
            setColor(color(R.color.surface_raised))
            cornerRadius = dp(28).toFloat()
        }
        minHeight = dp(56)
        minimumHeight = dp(56)
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = dp(6) }
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
    )

    private fun color(id: Int) = getColor(id)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
