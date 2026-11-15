package app.ophiuchus.watch

import android.content.Context
import java.security.SecureRandom

const val BASE_URL = "https://ophiuchus.ramisaada8.workers.dev"

val PEOPLE = listOf("Rami", "Aviad", "Shoval", "Elia", "Tal", "Demo")
const val DEMO = "Demo"

private const val CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
private const val PREFS = "ophiuchus"
private const val KEY_NAME = "name"
private const val KEY_CODE = "code"
private const val KEY_INTRO = "intro_seen"

/** The only things the app remembers: who wears the watch and the pairing code. */
class Settings(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var name: String?
        get() = prefs.getString(KEY_NAME, null)?.takeIf { it in PEOPLE }
        set(value) = prefs.edit().putString(KEY_NAME, value).apply()

    var introSeen: Boolean
        get() = prefs.getBoolean(KEY_INTRO, false)
        set(value) = prefs.edit().putBoolean(KEY_INTRO, value).apply()

    /** Made once, on first run, and kept. */
    val code: String
        get() = prefs.getString(KEY_CODE, null)?.takeIf(::isValidCode) ?: newCode().also {
            prefs.edit().putString(KEY_CODE, it).apply()
        }

    private fun isValidCode(value: String) =
        value.length == 6 && value.all { it in CODE_ALPHABET }

    private fun newCode(): String {
        val random = SecureRandom()
        return String(CharArray(6) { CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)] })
    }
}

