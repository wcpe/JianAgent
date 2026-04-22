import io.izzel.taboolib.gradle.*
import org.gradle.jvm.toolchain.JavaLanguageVersion
import org.gradle.jvm.toolchain.JvmVendorSpec
import org.gradle.jvm.tasks.Jar
plugins {
    java
    kotlin("jvm")
    id("io.izzel.taboolib")
}


java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

taboolib {
    description {
        name("JianAgent")
        desc("JianAgent 服务器端插件")
        contributors {
            name("WCPE")
        }
        dependencies {
        }
    }
    env {
        install(Basic)
        install(CommandHelper)
        install(Bukkit)
        install(BukkitUtil)
        install(I18n)
        repoTabooLib = "https://maven.wcpe.top/repository/maven-public/"
    }
    version {
        taboolib = "6.2.4-wcpe-SNAPSHOT"
    }
}

dependencies {
    taboo(project(":api"))
    taboo("com.google.code.gson:gson:2.10.1")
    taboo("org.java-websocket:Java-WebSocket:1.5.6")

    compileOnly("ink.ptms.core:v12004:12004:mapped")
    compileOnly("ink.ptms.core:v12004:12004:universal")
    testImplementation("com.google.code.gson:gson:2.10.1")
}
