# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Outfit native modules (called from JavaScript by name)
-keep class com.outfit.** { *; }
# React Native / Hermes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-dontwarn com.facebook.**
# Google Sign-In / Play services
-keep class com.google.android.gms.auth.** { *; }
-dontwarn com.google.android.gms.**

# ML Kit (offline translation + language id): components are found by reflection
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-keep class com.google.firebase.components.** { *; }
-dontwarn com.google.mlkit.**

# Reanimated / Worklets / Keyboard controller (keyboard animation, new arch)
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.reactnativekeyboardcontroller.** { *; }
-dontwarn com.swmansion.**
# Google Mobile Ads (AdMob) + react-native-google-mobile-ads
-keep class io.invertase.googlemobileads.** { *; }
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
# Firebase Messaging (push) + ML Kit vision (subject segmentation, image labeling)
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.firebase.installations.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.vision.** { *; }
