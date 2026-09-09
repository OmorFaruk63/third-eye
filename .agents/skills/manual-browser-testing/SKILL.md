---
name: manual-browser-testing
description: >-
  Enforces manual browser testing by the user instead of AI automated browser subagents.
  AI will not open or test browsers autonomously; instead, it asks the user to test in their browser
  and provide feedback or screenshots.
---

# Manual Browser Testing Policy & Workflow

## 🎯 Core Principle (মূল নীতি)
AI নিজ থেকে কখনো **Browser Auto-Testing** বা Browser Subagent/Tools (যেমন: `browser_subagent`, `read_browser_page`) দিয়ে নিজে ব্রাউজার খুলে টেস্ট করবে না।

যদি Web App, Admin Dashboard, বা Frontend-এ কোনো কিছু টেস্ট বা ভেরিফাই করার প্রয়োজন হয়:
1. **AI ইউজারকে টেস্ট করতে অনুরোধ জানাবে**: কোনো কোড পরিবর্তন বা ফিচার যুক্ত করার পর ইউজারকে জানাবে কী টেস্ট করতে হবে এবং ব্রাউজার URL কী (যেমন `http://localhost:5173`)।
2. **ইউজার টেস্ট করবেন**: ইউজার তার নিজস্ব ব্রাউজারে টেস্ট করে সমস্যার কথা বলবেন এবং প্রয়োজনে স্ক্রিনশট বা ফিডব্যাক দেবেন।
3. **AI ইউজারের ফিডব্যাক অনুযায়ী কাজ করবে**: ইউজারের দেওয়া বিবরণ ও স্ক্রিনশট দেখে সমস্যা সমাধান বা পরবর্তী ডেভেলপমেন্ট সম্পন্ন করবে।

---

## 📋 Rules & Guidelines (নিয়মাবলী)

### 1. No Autonomous Browser Execution
- **নিষিদ্ধ**: AI নিজ থেকে কোনো `browser_subagent` রান করবে না বা হেডলেস/অটোমেটেড ব্রাউজার চালিয়ে সাইট ভিজুট/ক্লিক/নেভিগেট করবে না।

### 2. User Testing Notification Format
কোড ফিক্স বা চেঞ্জ করার পর AI ইউজারকে নিচের ফরম্যাটে আপডেট দেবে:
- 🛠 **কী পরিবর্তন করা হয়েছে**: (সংক্ষিপ্ত বিবরণ)
- 🌐 **টেস্ট করার অনুরোধ**: "অনুগ্রহ করে আপনার ব্রাউজারে `[URL]` এ গিয়ে `[Feature/Action]` টেস্ট করুন।"
- 📸 **ফিডব্যাক চাওয়া**: "যদি কোনো সমস্যা দেখতে পান, তবে বিস্তারিত জানান বা স্ক্রিনশট দিন।"

### 3. Processing User Feedback & Screenshots
- ইউজার ব্রাউজারে টেস্ট করে ফিডব্যাক বা স্ক্রিনশট দিলে, AI সেই ফিডব্যাক বিশ্লেষণ করে প্রয়োজনীয় পরিবর্তন আনবে।
