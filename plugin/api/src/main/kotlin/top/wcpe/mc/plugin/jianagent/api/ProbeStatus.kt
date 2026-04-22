package top.wcpe.mc.plugin.jianagent.api

enum class ProbeStatus {
    UNAVAILABLE,
    CONNECTING,
    HANDSHAKING,
    READY,
    DISCONNECTED,
    VERSION_MISMATCH,
}
