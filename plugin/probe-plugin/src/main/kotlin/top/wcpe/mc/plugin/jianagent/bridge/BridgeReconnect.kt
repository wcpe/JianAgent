package top.wcpe.mc.plugin.jianagent.bridge

import kotlin.math.min
import kotlin.math.pow

class BridgeReconnect(
    private val maxRetries: Int = Int.MAX_VALUE,
    private val baseDelayMs: Long = 1000,
    private val maxDelayMs: Long = 60000,
    private val backoffFactor: Double = 2.0,
) {
    private var failures: Int = 0

    fun shouldReconnect(): Boolean = failures < maxRetries

    fun nextDelayMs(): Long {
        val delay = (baseDelayMs * backoffFactor.pow(failures.toDouble())).toLong()
        return min(delay, maxDelayMs)
    }

    fun recordFailure() {
        failures++
    }

    fun reset() {
        failures = 0
    }

    val retryCount: Int get() = failures
}
