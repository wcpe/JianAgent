plugins {
    kotlin("jvm") version "1.9.22" apply false
    id("io.izzel.taboolib") version "2.0.36" apply false
}

allprojects {
    repositories {
        mavenLocal()
        maven("https://repo.tabooproject.org/repository/releases/")
        maven("https://maven.wcpe.top/repository/maven-public/")
        maven("https://repo.papermc.io/repository/maven-public/")
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")

    dependencies {
        val implementation by configurations
        val testImplementation by configurations

        implementation(kotlin("stdlib"))
        testImplementation(kotlin("test"))
        testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }

    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    tasks.withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
}
