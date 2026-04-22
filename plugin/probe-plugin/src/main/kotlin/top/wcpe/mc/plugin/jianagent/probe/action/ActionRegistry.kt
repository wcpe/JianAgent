package jianagent.probe.action

import java.util.concurrent.ConcurrentHashMap

/**
 * Registry holding all available whitelist actions.
 * Thread-safe for runtime registration.
 */
object ActionRegistry {
    private val actions = ConcurrentHashMap<String, WhitelistAction>()

    fun register(action: WhitelistAction) {
        actions[action.name] = action
    }

    fun unregister(name: String) {
        actions.remove(name)
    }

    fun get(name: String): WhitelistAction? = actions[name]

    fun list(): List<String> = actions.keys().toList()

    fun clear() {
        actions.clear()
    }
}
