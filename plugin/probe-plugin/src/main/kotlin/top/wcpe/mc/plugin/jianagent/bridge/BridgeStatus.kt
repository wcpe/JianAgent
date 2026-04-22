package top.wcpe.mc.plugin.jianagent.bridge

import top.wcpe.mc.plugin.jianagent.api.ProbeStatus
import java.util.concurrent.atomic.AtomicReference

class BridgeStatus {
    private val _status = AtomicReference(ProbeStatus.UNAVAILABLE)

    val current: ProbeStatus get() = _status.get()

    fun transition(newStatus: ProbeStatus): ProbeStatus {
        val old = _status.getAndSet(newStatus)
        return old
    }

    fun isReady(): Boolean = _status.get() == ProbeStatus.READY
}
