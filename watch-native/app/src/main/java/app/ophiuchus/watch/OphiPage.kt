package app.ophiuchus.watch

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.View
import java.util.Locale

const val MIC_REQUEST = 2
const val SPEECH_REQUEST = 3

private val QUICK_QUESTIONS = listOf("How am I doing today?", "What should I do next?", "I don't feel well.")
private const val OFFLINE_REPLY = "I can't reach the console right now. Check the watch's connection and try again."
private const val FLIGHT_SURGEON_REPLY = "Tell your flight surgeon. If it is urgent, use Emergency."

/** Talk to Ophi: speak or tap a quick question, read the answer, and hear it spoken. */
class OphiPage(
    private val activity: Activity,
    private val profile: () -> String?,
    private val goToEmergency: () -> Unit,
) : Page {
    private val handler = Handler(Looper.getMainLooper())
    private val host = activity.column()
    private var recognizer: SpeechRecognizer? = null
    private var speech: TextToSpeech? = null
    private var speechReady = false

    private var status = "Tap to talk, or pick a question."
    private var heard: String? = null
    private var reply: String? = null
    private var urgent = false
    private var busy = false
    private var listening = false

    override val view: View = activity.scrolling(host)

    init {
        speech = TextToSpeech(activity) { result ->
            speechReady = result == TextToSpeech.SUCCESS
            if (speechReady) speech?.language = Locale.getDefault()
        }
        render()
    }

    override fun onHide() {
        recognizer?.cancel()
        listening = false
        speech?.stop()
    }

    fun destroy() {
        recognizer?.destroy()
        recognizer = null
        speech?.shutdown()
        speech = null
    }

    // ---- Input ----

    private fun talk() {
        if (busy || listening) return
        speech?.stop()
        when {
            SpeechRecognizer.isRecognitionAvailable(activity) -> listenInApp()
            intentAvailable() -> launchIntent()
            else -> setStatus("Voice input is not available on this watch. Pick a question.")
        }
    }

    private fun listenInApp() {
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MIC_REQUEST)
            return
        }
        val engine = recognizer ?: SpeechRecognizer.createSpeechRecognizer(activity).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        listening = true
        heard = null
        reply = null
        setStatus("Listening…")
        engine.startListening(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1),
        )
    }

    fun onMicPermission(granted: Boolean) {
        if (granted) listenInApp() else setStatus("The microphone is off. Pick a question instead.")
    }

    private fun speechIntent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)

    private fun intentAvailable() =
        speechIntent().resolveActivity(activity.packageManager) != null

    private fun launchIntent() {
        try {
            @Suppress("DEPRECATION")
            activity.startActivityForResult(speechIntent(), SPEECH_REQUEST)
        } catch (e: ActivityNotFoundException) {
            setStatus("Voice input is not available on this watch. Pick a question.")
        }
    }

    fun onSpeechIntentResult(resultCode: Int, data: Intent?) {
        val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (resultCode == Activity.RESULT_OK && !text.isNullOrBlank()) ask(text)
        else setStatus("I didn't catch that. Try again.")
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) { heard = text; render() }
        }

        override fun onResults(results: Bundle?) {
            listening = false
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (text.isNullOrBlank()) setStatus("I didn't catch that. Try again.") else ask(text)
        }

        override fun onError(error: Int) {
            listening = false
            val message = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "I didn't catch that. Try again."
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "The microphone is off. Pick a question instead."
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
                    "Voice input needs a connection. Pick a question."
                else -> "Voice input failed. Try again or pick a question."
            }
            setStatus(message)
        }
    }

    // ---- Asking ----

    private fun ask(question: String) {
        recognizer?.cancel()
        listening = false
        heard = question
        reply = null
        urgent = false
        busy = true
        status = "Ophi is thinking…"
        render()
        val context = chatContext()
        Thread {
            val answer = Relay.chat(question, context)
            handler.post {
                busy = false
                if (answer == null) {
                    reply = offlineReply(question)
                    status = "Offline"
                } else {
                    reply = answer.reply
                    urgent = answer.urgent
                    status = "Ophi"
                    speak(answer.reply)
                }
                render()
            }
        }.apply { name = "ophiuchus-chat" }.start()
    }

    private fun offlineReply(question: String): String {
        val q = question.lowercase()
        val unwell = listOf("feel well", "unwell", "sick", "pain", "dizzy").any { it in q }
        return if (unwell) "$OFFLINE_REPLY $FLIGHT_SURGEON_REPLY" else OFFLINE_REPLY
    }

    private fun speak(text: String) {
        if (speechReady) speech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ophi")
    }

    /** What Ophi is told about the person, in the block the Med bot expects. Only what the console shared. */
    private fun chatContext(): String {
        val lines = mutableListOf("[context]", "screen: Watch")
        lines += if (profile() == DEMO) "profile: demo crew member, all values simulated"
        else "profile: team member, real readings and entries"
        Live.summary?.let { s ->
            lines += areaLine("sleep", s.sleep)
            lines += areaLine("food", s.food)
            lines += areaLine("water", s.water)
            lines += areaLine("exercise", s.exercise)
            lines += areaLine("mood", s.mood)
            lines += "open alerts: ${if (s.openAlerts == 0) "none" else s.openAlerts.toString()}"
        }
        val bpm = Live.freshHeartRate()
        lines += if (bpm != null) "heart rate: $bpm bpm, source live" else "heart rate: no sensor"
        lines += "reply mode: watch"
        lines += "[end context]"
        return lines.joinToString("\n")
    }

    private fun areaLine(name: String, area: Area): String {
        val status = when (area.level) { "ok" -> "on target"; "watch" -> "watch"; "act" -> "act"; else -> "no data" }
        return "$name: $status, ${area.text}, source ${area.source ?: "no data"}"
    }

    // ---- View ----

    private fun setStatus(message: String) {
        status = message
        render()
    }

    private fun render() {
        host.removeAllViews()
        host.addView(activity.label("Ophi", 18f, bold = true))
        host.addView(activity.pillButton(if (listening) "Listening…" else "Tap to talk") { talk() })
        host.addView(activity.label(status, 12f, R.color.text_secondary))
        heard?.let { host.addView(activity.label("You: $it", 13f, R.color.text_secondary)) }
        reply?.let { host.addView(activity.label(it, 15f)) }
        if (urgent) host.addView(activity.pillButton("Go to Emergency", 44) { goToEmergency() })
        QUICK_QUESTIONS.forEach { question ->
            host.addView(activity.pillButton(question, 44) { if (!busy) ask(question) })
        }
    }
}
