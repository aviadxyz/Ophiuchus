package app.ophiuchus.watch

import android.content.Context
import android.view.View
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** About: what the app is, where it is connected, which version, and the pairing code. */
class AboutPage(
    private val context: Context,
    private val code: String,
    private val person: () -> String?,
    private val onShowIntro: () -> Unit,
    private val onChangePerson: () -> Unit,
) : Page {
    private val host = context.column()
    override val view: View = context.scrolling(host)

    private var drawn: List<Any?>? = null

    override fun onShow() {
        drawn = null
        refresh()
    }

    override fun refresh() {
        val state = listOf(Live.online, person())
        if (state == drawn) return
        drawn = state
        host.removeAllViews()
        host.addView(context.label("Ophiuchus", 20f, bold = true))
        host.addView(
            context.label(
                "A health console for astronauts. This watch sends your heart rate, raises an emergency alert, and lets you talk to Ophi.",
                13f,
                R.color.text_secondary,
            ),
        )
        host.addView(context.label("Made for the NASA Space Apps Challenge 2026.", 12f, R.color.text_secondary))
        host.addView(spacer())
        host.addView(fact("Connected to", BASE_URL.removePrefix("https://")))
        host.addView(fact("Link", when (Live.online) { true -> "Online"; false -> "Offline"; null -> "Checking" }))
        host.addView(fact("Worn by", person() ?: "Nobody chosen"))
        host.addView(context.label("Pairing code", 12f, R.color.text_secondary))
        host.addView(context.label(code, 24f, R.color.accent, bold = true, mono = true))
        host.addView(fact("Version", version()))
        host.addView(fact("Installed", installed()))
        host.addView(context.label("Demo. Not a medical device.", 12f, R.color.text_secondary))
        host.addView(spacer())
        host.addView(context.pillButton("Show intro", 44) { onShowIntro() })
        host.addView(context.pillButton("Change person", 44) { onChangePerson() })
    }

    private fun spacer() = View(context).apply {
        minimumHeight = context.dp(6)
    }

    private fun fact(name: String, value: String): View = context.column().apply {
        setPadding(0, context.dp(3), 0, context.dp(3))
        addView(context.label(name, 11f, R.color.text_secondary))
        addView(context.label(value, 14f))
    }

    private fun version(): String = try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        "${info.versionName} (build ${info.longVersionCode})"
    } catch (e: Exception) {
        "Unknown"
    }

    private fun installed(): String = try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        SimpleDateFormat("d MMM yyyy, HH:mm", Locale.getDefault()).format(Date(info.lastUpdateTime))
    } catch (e: Exception) {
        "Unknown"
    }
}
