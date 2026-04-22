package top.wcpe.mc.plugin.jianagent.bridge

interface ProbeBridgeClient {
    val status: BridgeStatus

    fun connect()

    fun send(channel: String, payload: Any)

    fun disconnect()
}