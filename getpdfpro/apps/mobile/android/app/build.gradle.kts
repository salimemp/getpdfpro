import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Load signing secrets from android/key.properties (gitignored).
// The file is generated locally from android/key.properties.example after
// the user creates their upload keystore. See android/key.properties.example
// for instructions.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.getpdfpro.getpdfpro_mobile"
    // Pinned to 36 to satisfy flutter_plugin_android_lifecycle 2.0.x
    // AAR metadata, which requires compileSdk >= 36. file_picker 8.x
    // pins 34 transitively, so we override the Flutter SDK default
    // (which was 34 / 35 at the time those packages were published).
    // See: apps/mobile/docs/build-faq.md (or the release-readiness
    // audit at .mavis/plans/.../mobile-audit/deliverable.md) for the
    // full story.
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.getpdfpro.getpdfpro_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // Release signing — Google Play rejects APKs signed with the
    // debug keystore. The actual signing material lives in
    // android/key.properties (gitignored) which references
    // android/app/upload-keystore.jks (also gitignored).
    // To set up:
    //   1. keytool -genkey -v -keystore android/app/upload-keystore.jks \
    //        -keyalg RSA -keysize 2048 -validity 10000 -alias upload
    //   2. cp android/key.properties.example android/key.properties
    //   3. Fill in the passwords in android/key.properties
    //   4. flutter build apk --release
    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Uses the release signing config above when
            // android/key.properties exists, falls back to the debug
            // keystore otherwise (so `flutter run --release` still
            // works for developers who haven't set up signing yet).
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

// Transitive compileSdk override — several Flutter plugins (notably
// file_picker 8.3.7) pin `compileSdk 34` in their own android/build.gradle
// even though flutter_plugin_android_lifecycle 2.0.x AAR metadata requires
// compileSdk >= 36. The project-level `compileSdk = 36` above only
// applies to the app subproject; it does NOT propagate to plugin
// subprojects, which is why the build was still failing with
//   :file_picker:checkDebugAarMetadata
//   Dependency ':flutter_plugin_android_lifecycle' requires libraries
//   and applications that depend on it to compile against version 36
//   or later of the Android APIs.
//   :file_picker is currently compiled against android-34.
//
// Force every Android plugin subproject to compileSdk 36 + Java 17
// after its own build.gradle has been evaluated.
subprojects {
    afterEvaluate {
        if (project.hasProperty("android")) {
            val androidExt = project.extensions.findByName("android")
            if (androidExt is com.android.build.gradle.BaseExtension) {
                androidExt.compileSdkVersion(36)
            }
        }
    }
}
