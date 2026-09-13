# 📍 Third Eye: Next-Gen Smart Mobility & Location Engine Blueprint

## ১. নির্বাহী সারসংক্ষেপ (Executive Summary)
Third Eye-এর বর্তমান পয়েন্ট-ভিত্তিক জিপিএস ট্র্যাকিংকে একটি **রিয়েল-টাইম ইন্টেলিজেন্ট মোবিলিটি ও লোকেশন হিস্ট্রি ইঞ্জিন (Mobility Intelligence)**-এ রূপান্তর করার সম্পূর্ণ স্পেসিফিকেশন।

---

## ২. মূল ফিচারসমূহ (Core Features)

### মডিউল ১: স্মার্ট স্টে-পয়েন্ট ও মুভমেন্ট ডিটেকশন (Stay-Point vs In-Transit)
* **In-Transit (চলাচল অবস্থা):** 
  - গতি > ৩ কিমি/ঘণ্টা হলে কোঅর্ডিনেটগুলো রুট পলিলাইন আঁকার জন্য কাজে লাগবে, টেবিল ভারী করবে না।
* **Stationary Stop (থামা অবস্থা):** 
  - ডিভাইস একই ৩০০ মিটারের মধ্যে ৩+ মিনিট অবস্থান করলে স্বয়ংক্রিয়ভাবে একটি "Stop" তৈরি হবে।
* **সংরক্ষিত ডেটা:**
  - আগমনের সময় (`arrivalTime`)
  - প্রস্থানের সময় (`departureTime`)
  - মোট অবস্থানকাল (`stayDurationMinutes`)
  - পুঙ্খানুপুঙ্খ ঠিকানা (রোড নং, বাড়ি/পাড়া, থানা, জেলা)

### মডিউল ২: ইন্টারেক্টিভ ট্রাভেল রুট ও পলিলাইন ম্যাপ (Route Polyline & Playback)
* **ম্যাপ ভিউ:**
  - সারাদিনের চলাচলের পথ ড্যাশবোর্ডের ম্যাপে নিয়ন ব্লু/সায়ান কালারের পলিলাইন দিয়ে যুক্ত থাকবে।
  - প্রতিটি স্টপে বিশেষ স্টপ মার্কার থাকবে, যাতে ক্লিক করলে দেখা যাবে কতক্ষণ সেখানে ছিল।
* **টাইম প্লেব্যাক (Playback Trail):**
  - টাইম স্লাইডার ড্র্যাগ করে সকাল থেকে রাত পর্যন্ত ফোনটি কোন কোন পথ দিয়ে গেছে তা অ্যানিমেশনের মাধ্যমে দেখার সুবিধা।

### মডিউল ৩: জিও-ফেন্সিং ও রিয়েল-টাইম অ্যালার্ট (Geofencing Engine)
* **জোন ম্যানেজমেন্ট:**
  - ড্যাশবোর্ডের ম্যাপ থেকে নির্দিষ্ট কোনো এলাকা (যেমন: বাসা, অফিস, স্কুল) সার্কেল বা পলিগন দিয়ে "Safe Zone" হিসেবে মার্ক করে রাখা যাবে।
* **লাইভ অ্যালার্ট:**
  - ফোন উক্ত জোনে প্রবেশ করলে (`zone-enter`) বা বের হলে (`zone-exit`) অ্যাডমিন ড্যাশবোর্ডে অডিও বিপ সহ ইনস্ট্যান্ট পপআপ অ্যালার্ট আসবে।
  - পুশ নোটিফিকেশন বা সাইলেন্ট ব্যাকগ্রাউন্ড অ্যাকশন ট্র্রিগার করার সুবিধা।

### মডিউল ৪: বাংলাদেশের জন্য নিখুঁত মাইক্রো-রিভার্স জিওকোডিং (Micro-Location Bangladesh)
* ওপেনস্ট্রিটম্যাপ (OSM Nominatim) এবং ইন-মেমরি ক্যাশিং-এর মাধ্যমে যেকোনো জিপিএস কোঅর্ডিনেট থেকে বাংলাদেশের নির্দিষ্ট গলি, রোড নম্বর, পাড়া এবং থানার নাম বাংলায় ও ইংরেজিতে দ্রুত নিয়ে আসা।

### মডিউল ৫: অফলাইন লোকেশন ভল্ট ও অটো-সিঙ্ক (Offline Caching & Auto-Sync)
* **অ্যান্ড্রয়েড ক্লায়েন্ট:**
  - ইন্টারনেট না থাকলেও ফোনের লোকাল ডাটাবেসে টাইমস্ট্যাম্পসহ লোকেশন জমা থাকবে।
  - মোবাইল ডেটা বা ওয়াইফাই কানেক্ট হওয়া মাত্রই ব্যাকগ্রাউন্ডে ব্যাকফিল সিঙ্ক হয়ে যাবে। কোনো হিস্ট্রি মিস হবে না।

---

## ৩. ডেটাবেস স্কিমা ডিজাইন (Database Schemas)

```javascript
// models/LocationStop.js
const LocationStopSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  areaName: { type: String, required: true }, // e.g., "Kazi Alauddin Road, Bangshal"
  fullAddress: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  arrivalTime: { type: Date, required: true },
  departureTime: { type: Date, default: null },
  stayDurationMinutes: { type: Number, default: 0 },
  accuracy: { type: Number, default: 10 },
  pingsCount: { type: Number, default: 1 },
  isCurrentlyHere: { type: Boolean, default: true }
}, { timestamps: true });

// models/BreadcrumbPoint.js
const BreadcrumbPointSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speedKmh: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true }
});

// models/GeofenceZone.js
const GeofenceZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  centerLat: { type: Number, required: true },
  centerLon: { type: Number, required: true },
  radiusMeters: { type: Number, default: 300 },
  alertOnEnter: { type: Boolean, default: true },
  alertOnExit: { type: Boolean, default: true },
  targetDevices: [{ type: String }]
});
```

---

## ৪. নতুন কনভারসেশনে কাজ শুরু করার জন্য কপি-পেস্ট প্রম্পট

```text
আমি Third Eye প্রজেক্টে একটি আধুনিক এবং ব্যাটারি-সাশ্রয়ী "Smart Mobility & Location History Tracking Engine" তৈরি করতে চাই। পুরো আর্কিটেকচারটি রুট ডিরেক্টরির `location_system_blueprint.md` ফাইলে বিস্তারিত লেখা আছে।

সংক্ষেপে মূল বিষয়গুলো হলো:
১. Stay-Point Detection (৩ মিনিটের বেশি স্থির থাকলে Stop হিসেবে রেকর্ড, চলাচলের সময় পলিলাইন পাথ তৈরি)।
২. Route Polyline Map (ড্যাশবোর্ড ম্যাপে চলাচলের পথ নিয়ন লাইনে দেখানো ও প্লেব্যাক)।
৩. Geofencing (নির্ধারিত জোনে প্রবেশ বা প্রস্থানে ইনস্ট্যান্ট সাউন্ড সহ ড্যাশবোর্ড অ্যালার্ট)।
৪. Micro-Address Bangladesh (রোড, পাড়া, থানা বাংলায় ও ইংরেজিতে সঠিক রিভার্স জিওকোডিং)।
৫. Offline Location Sync (ইন্টারনেট না থাকলেও লোকাল ক্যাশ, নেট পেলেই অটো-সিঙ্ক)।

দয়া করে `location_system_blueprint.md` ফাইলটি পড়ে ধাপে ধাপে ইমপ্লিমেন্টেশন শুরু করো।
```
