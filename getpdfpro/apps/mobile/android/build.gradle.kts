allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Transitive compileSdk override — several Flutter plugins (notably
// file_picker 8.3.7) pin `compileSdk 34` in their own android/build.gradle
// even though flutter_plugin_android_lifecycle 2.0.x AAR metadata requires
// compileSdk >= 36. The project-level `compileSdk = 36` in app/build.gradle.kts
// only applies to the :app subproject; it does NOT propagate to plugin
// subprojects, which is why the build fails with:
//   :file_picker:checkDebugAarMetadata
//   Dependency ':flutter_plugin_android_lifecycle' requires libraries
//   and applications that depend on it to compile against version 36
//   or later of the Android APIs.
//   :file_picker is currently compiled against android-34.
//
// Force every Android plugin subproject to compileSdk 36. Several
// Flutter plugins (notably file_picker 8.3.7) pin `compileSdk 34`
// in their own android/build.gradle even though
// flutter_plugin_android_lifecycle 2.0.x AAR metadata requires
// compileSdk >= 36. The project-level `compileSdk = 36` in
// app/build.gradle.kts only applies to the :app subproject; it does
// NOT propagate to plugin subprojects, which is why the build fails
// with:
//   :file_picker:checkDebugAarMetadata
//   Dependency ':flutter_plugin_android_lifecycle' requires libraries
//   and applications that depend on it to compile against version 36
//   or later of the Android APIs.
//   :file_picker is currently compiled against android-34.
//
// Reflection on com.android.build.gradle.BaseExtension#setCompileSdkVersion(int)
// works in AGP 7, 8, 9, and 10.
//
// The Gradle evaluation order in this build is:
//   1. Root build.gradle.kts (this file) runs.
//   2. The `subprojects { project.evaluationDependsOn(":app") }` block
//      below forces :app to be evaluated last.
//   3. Each plugin subproject is evaluated as part of :app's
//      evaluation, in dependency order.
//
// To override the compileSdk AFTER each plugin subproject's
// build.gradle has run (so the `android` extension exists) but
// BEFORE the AAR metadata check fires, we register an
// afterEvaluate callback inside gradle.beforeProject. The
// `beforeProject` hook fires for every subproject before its
// build script runs, so the afterEvaluate registration lands
// while the subproject is still being evaluated.
//
// We use a Groovy build script (compile-sdk-override.gradle) for
// this because the Kotlin DSL `gradle.beforeProject { ... }` lambda
// is typed as `(Closure<Any>..Closure<*>)` and can't take a typed
// Kotlin lambda. The Groovy apply is a one-liner.
//
// ALTERNATIVE: also re-set compileSdk via projectsEvaluated, which
// fires after every subproject has been evaluated, as a safety net
// in case the beforeProject hook was too early.
apply(from = "compile-sdk-override.gradle")

gradle.projectsEvaluated {
    rootProject.allprojects {
        if (this == rootProject) return@allprojects
        val androidExt = this.extensions.findByName("android")
        if (androidExt != null) {
            try {
                val method = androidExt.javaClass.getMethod(
                    "setCompileSdkVersion",
                    Int::class.javaPrimitiveType,
                )
                method.invoke(androidExt, 36)
            } catch (_: NoSuchMethodException) {
                // Best effort.
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
