package jianagent.helper.attach

enum class AttachState { IDLE, ATTACHING, ATTACHED, DETACHING, FAILED }

class AttachManager {
    var state: AttachState = AttachState.IDLE
        private set
    var attachedPid: String? = null
        private set
    private var vmInstance: Any? = null

    fun attach(pid: String): Result<Unit> {
        state = AttachState.ATTACHING
        return try {
            val vmClass = Class.forName("com.sun.tools.attach.VirtualMachine")
            val attachMethod = vmClass.getMethod("attach", String::class.java)
            vmInstance = attachMethod.invoke(null, pid)
            attachedPid = pid
            state = AttachState.ATTACHED
            Result.success(Unit)
        } catch (e: Exception) {
            state = AttachState.FAILED
            Result.failure(e)
        }
    }

    fun detach(): Result<Unit> {
        state = AttachState.DETACHING
        return try {
            val vm = vmInstance ?: return Result.success(Unit)
            vm.javaClass.getMethod("detach").invoke(vm)
            vmInstance = null
            attachedPid = null
            state = AttachState.IDLE
            Result.success(Unit)
        } catch (e: Exception) {
            state = AttachState.FAILED
            Result.failure(e)
        }
    }

    fun getLocalConnectorAddress(): String? {
        val vm = vmInstance ?: return null
        return try {
            val props = vm.javaClass.getMethod("getAgentProperties").invoke(vm) as java.util.Properties
            props.getProperty("com.sun.management.jmxremote.localConnectorAddress")
        } catch (_: Exception) {
            null
        }
    }
}
