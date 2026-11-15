package app.ophiuchus.watch

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Small view helpers shared by every screen. The app draws its views in code; there are no layout files. */

fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

fun Context.column(): LinearLayout = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL
    gravity = Gravity.CENTER_HORIZONTAL
}

fun Context.label(
    value: String,
    size: Float = 15f,
    color: Int = R.color.text_primary,
    bold: Boolean = false,
    mono: Boolean = false,
): TextView = TextView(this).apply {
    text = value
    textSize = size
    setTextColor(getColor(color))
    gravity = Gravity.CENTER
    if (bold) typeface = Typeface.DEFAULT_BOLD
    if (mono) typeface = Typeface.create(Typeface.MONOSPACE, if (bold) Typeface.BOLD else Typeface.NORMAL)
    setPadding(0, dp(2), 0, dp(2))
}

fun Context.pillButton(text: String, height: Int = 52, onClick: () -> Unit): Button = Button(this).apply {
    this.text = text
    isAllCaps = false
    textSize = 18f
    setTextColor(getColor(R.color.text_primary))
    background = GradientDrawable().apply {
        setColor(getColor(R.color.surface_raised))
        cornerRadius = dp(28).toFloat()
    }
    minHeight = dp(height)
    minimumHeight = dp(height)
    setOnClickListener { onClick() }
    layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { bottomMargin = dp(6) }
}

/** A short word in a thin outline, such as LIVE or SIMULATED. */
fun Context.badge(text: String, color: Int = R.color.text_secondary): TextView = TextView(this).apply {
    this.text = text
    textSize = 10f
    letterSpacing = 0.08f
    setTextColor(getColor(color))
    typeface = Typeface.DEFAULT_BOLD
    setPadding(dp(6), dp(1), dp(6), dp(1))
    background = GradientDrawable().apply {
        setStroke(dp(1), getColor(color))
        cornerRadius = dp(8).toFloat()
    }
}

/** A page body that scrolls, with room for a round face. Rotary input scrolls it. */
fun Context.scrolling(content: View): ScrollView {
    val metrics = resources.displayMetrics
    val round = resources.configuration.isScreenRound
    val side = if (round) (metrics.widthPixels * 0.13f).toInt() else dp(12)
    val top = if (round) (metrics.heightPixels * 0.17f).toInt() else dp(12)
    val bottom = if (round) (metrics.heightPixels * 0.2f).toInt() else dp(12)
    return ScrollView(this).apply {
        setBackgroundColor(getColor(R.color.background))
        isFillViewport = true
        isFocusable = true
        isFocusableInTouchMode = true
        isVerticalScrollBarEnabled = false
        clipToPadding = false
        setPadding(side, top, side, bottom)
        addView(content, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        post { requestFocus() }
    }
}

/** One screen the person can swipe to. */
interface Page {
    val view: View
    fun onShow() {}
    fun onHide() {}
    /** The live data changed (a new summary, a new reading, the link going up or down). */
    fun refresh() {}
}
