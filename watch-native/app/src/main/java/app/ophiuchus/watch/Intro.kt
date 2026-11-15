package app.ophiuchus.watch

import android.content.Context
import android.view.View

private data class Slide(val title: String, val body: String)

private val SLIDES = listOf(
    Slide("Hi, I'm Ophi", "I'm your health guide on this mission."),
    Slide("Four screens", "Emergency, Talk to Ophi, Health and About. Swipe sideways to move between them."),
    Slide("Good to know", "Demo. Not a medical device. For any health decision, ask your flight surgeon."),
)

/** The short introduction shown the first time the app opens, and again from About. */
class Intro(private val context: Context, private val onDone: () -> Unit) {
    private var index = 0
    private val host = context.column()

    val view: View = context.scrolling(host)

    init {
        show()
    }

    private fun show() {
        host.removeAllViews()
        val slide = SLIDES[index]
        val last = index == SLIDES.lastIndex
        host.addView(context.label(slide.title, 20f, bold = true))
        host.addView(context.label(slide.body, 15f, R.color.text_secondary))
        host.addView(context.label(SLIDES.indices.joinToString(" ") { if (it == index) "●" else "○" }, 12f, R.color.accent))
        host.addView(context.pillButton(if (last) "Start" else "Next") {
            if (last) onDone() else { index += 1; show() }
        })
    }
}
