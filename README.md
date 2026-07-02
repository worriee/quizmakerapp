# TUON AI

> To Understand Own Navigation.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PWA](https://img.shields.io/badge/PWA-ready-orange)

**URL:** [quizmakerapp.vercel.app](https://quizmakerapp.vercel.app)\
**APPLICATION:** [Download Here](https://github.com/worriee/quizmakerapp/releases)

---

## What is TUON AI?

TUON AI is an AI-powered learning platform that helps you explore topics, generate structured notes, and take interactive quizzes — all in one place. Built for students who want to understand, not just memorize.

---

## Features

| Feature             | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| AI Chat             | Ask anything, get structured explanations with reasoning                    |
| Smart Notes         | Auto-generated study notes on any topic                                     |
| Interactive Quizzes | Test yourself with adaptive questions and track weak areas                  |
| Multi-Model         | Choose from Gemini, Step, GLM, or connect your own openAI compatible models |
| Email Verification  | Secure account creation with email confirmation                             |
| Password Reset      | Self-service account recovery                                               |
| Account Protection  | Auto-lock after 5 failed login attempts                                     |
| PWA                 | Install on your phone, works offline                                        |

---

## Tech Stack

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Resend](https://img.shields.io/badge/Resend_Email-000000?style=flat&logo=resend&logoColor=white)

---

## Security

- Content Security Policy (CSP) headers
- Input sanitization and prompt injection detection
- Email verification on signup
- Password reset with time-limited tokens
- Account lockout after 5 failed attempts
- Per-model rate limiting (Gemini 15 RPM, NVIDIA 40 RPM)
- 1-day JWT expiry
- Custom LLM history consent toggle
- Self-hosted service worker (no CDN dependencies)

---

## Author

Built by [Julry](https://github.com/worriee)

_"Study to Understand, Navigate to Succeed."_
