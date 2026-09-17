# Add project specific ProGuard rules here.
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes InnerClasses,EnclosingMethod

# Dontwarn for legacy Java standard library packages not present in Android SDK
-dontwarn javax.naming.**
-dontwarn org.ietf.jgss.**
-dontwarn org.apache.http.**

# Google Drive API & Client
-keep class com.google.api.services.drive.** { *; }
-keep class com.google.api.client.** { *; }

# Socket.io & Engine.io
-keep class io.socket.** { *; }
-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.client.** { *; }
-keep class okhttp3.** { *; }

# Firebase Messaging
-keep class com.google.firebase.** { *; }

# CameraX & AndroidX Lifecycle / WorkManager
-keep class androidx.camera.** { *; }
-keep class androidx.work.** { *; }
-keep class com.thirdeye.app.service.** { *; }
-keep class com.thirdeye.app.uploader.** { *; }
