package top.wcpe.mc.plugin.jianagent.api.protocol

object ProtocolVersion {
    const val CURRENT = 1
    const val MIN_COMPATIBLE = 1

    fun isCompatible(remote: Int): Boolean {
        return remote in MIN_COMPATIBLE..CURRENT
    }
}
