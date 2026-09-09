plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.thirdeye.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.thirdeye.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("prod") {
            dimension = "environment"
            manifestPlaceholders["appName"] = "Third Eye"
            buildConfigField("String", "DEFAULT_SERVER_URL", "\"https://third-eye-backend-a319.onrender.com\"")
            buildConfigField("String", "ENV_LABEL", "\"PROD\"")
            buildConfigField("Boolean", "IS_DEV_ENVIRONMENT", "false")
        }
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            manifestPlaceholders["appName"] = "Third Eye [DEV]"
            buildConfigField("String", "DEFAULT_SERVER_URL", "\"http://192.168.10.120:5000\"")
            buildConfigField("String", "ENV_LABEL", "\"DEV / UAT\"")
            buildConfigField("Boolean", "IS_DEV_ENVIRONMENT", "true")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/DEPENDENCIES"
            excludes += "META-INF/LICENSE"
            excludes += "META-INF/LICENSE.txt"
            excludes += "META-INF/license.txt"
            excludes += "META-INF/NOTICE"
            excludes += "META-INF/NOTICE.txt"
            excludes += "META-INF/notice.txt"
            excludes += "META-INF/ASL2.0"
            excludes += "META-INF/INDEX.LIST"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // CameraX dependencies
    val cameraxVersion = "1.3.4"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-video:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.1")
    implementation("androidx.lifecycle:lifecycle-service:2.8.1")

    // WorkManager for background uploading
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Google Sign-In & Google Drive REST API
    implementation("com.google.android.gms:play-services-auth:21.1.1")
    implementation("com.google.apis:google-api-services-drive:v3-rev20260428-2.0.0")
    implementation("com.google.api-client:google-api-client-android:2.6.0")
    implementation("com.google.http-client:google-http-client-gson:1.44.2")

    // Socket.io for Real-Time Live Streaming & Remote Commands
    implementation("io.socket:socket.io-client:2.1.1")
}
