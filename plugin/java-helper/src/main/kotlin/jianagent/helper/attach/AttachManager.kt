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

            // Ensure JMX agent is started
            ensureJmxAgentStarted()

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

    private fun ensureJmxAgentStarted() {
        val vm = vmInstance ?: return
        try {
            // Check if JMX agent is already running
            val agentProps = vm.javaClass.getMethod("getAgentProperties").invoke(vm) as java.util.Properties
            val connectorAddress = agentProps.getProperty("com.sun.management.jmxremote.localConnectorAddress")

            if (connectorAddress == null) {
                // JMX agent not started, start it
                val startLocalManagementAgentMethod = vm.javaClass.getMethod("startLocalManagementAgent")
                startLocalManagementAgentMethod.invoke(vm)
            }
        } catch (e: Exception) {
            // If startLocalManagementAgent doesn't exist (older JDK), try loading management-agent.jar
            try {
                val systemProps = vm.javaClass.getMethod("getSystemProperties").invoke(vm) as java.util.Properties
                val javaHome = systemProps.getProperty("java.home")
                val agentPath = "$javaHome/lib/management-agent.jar"

                val loadAgentMethod = vm.javaClass.getMethod("loadAgent", String::class.java)
                loadAgentMethod.invoke(vm, agentPath)
            } catch (_: Exception) {
                // Ignore if we can't start the agent
            }
        }
    }
}
