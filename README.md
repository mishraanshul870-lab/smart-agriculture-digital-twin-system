
# 🌾 Smart Agriculture Digital Twin System

> **AI-powered Digital Twin platform for smart agriculture using React, Node.js, MongoDB, and Google Gemini AI.**

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge)
![Render](https://img.shields.io/badge/Hosted%20On-Render-6A5ACD?style=for-the-badge)

---

# 📖 Project Overview

Smart Agriculture Digital Twin System is a full-stack AI-powered agriculture platform that combines Digital Twin concepts, IoT simulation, cloud technologies, and Google Gemini AI to help farmers monitor farms, analyze soil, detect plant diseases, predict crop yield, and generate professional reports.

## ✨ Key Features

- 📊 Interactive Dashboard
- 🚜 Farm Management
- 📡 IoT Sensor Monitoring
- 🧪 AI Soil Analysis
- 🍃 AI Leaf Disease Detection
- 🌾 AI Yield Prediction
- 🤖 AI Agriculture Assistant
- 📑 PDF Report Generation
- 🔔 Notification Center
- 🔐 JWT Authentication
- ☁️ MongoDB Atlas Integration
- 🚀 Render Deployment

## 🌱 Supported Crops

- Wheat
- Rice
- Cotton
- Maize
- Sugarcane
- Bajra
- Green Chillies
- Tomato
- Potato
- Onion
- Mustard
- Custom Crops

---

# 🛠 Technology Stack

## Frontend
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Lucide React

## Backend
- Node.js
- Express.js
- TypeScript

## Database
- MongoDB Atlas
- Mongoose

## AI
- Google Gemini API
- Gemini Vision

## Deployment
- GitHub
- Render

---

# 📂 Project Structure

```text
client/
server/
shared/
README.md
package.json
```

---

# 📚 API Documentation

## Authentication

| Method | Endpoint |
|--------|----------|
| POST | /api/auth/register |
| POST | /api/auth/login |

## Farm Management

| Method | Endpoint |
|--------|----------|
| GET | /api/farms |
| POST | /api/farms |

## IoT Sensors

| Method | Endpoint |
|--------|----------|
| GET | /api/sensors |
| POST | /api/sensors |

## Soil Analysis

| Method | Endpoint |
|--------|----------|
| GET | /api/soil-analysis |
| POST | /api/soil-analysis |

## Disease Detection

| Method | Endpoint |
|--------|----------|
| GET | /api/disease-history |
| POST | /api/disease-detection |

## Yield Prediction

| Method | Endpoint |
|--------|----------|
| GET | /api/yield-predictions |
| POST | /api/yield-predictions/predict |

---

# ⚙️ Installation

```bash
git clone https://github.com/mishraanshul870-lab/smart-agriculture-digital-twin-system.git
cd smart-agriculture-digital-twin-system
npm install
```

## Environment Variables

```env
GEMINI_API_KEY=your_api_key
AI_PROVIDER=gemini
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
```

Run:

```bash
npm run dev
```

Build:

```bash
npm run build
```

---

# ☁️ Deployment

The application is deployed on **Render** with automatic deployment from the **main** GitHub branch.

---

# 📸 Screenshots

Add screenshots here:

- Dashboard
- Farm Management
- Soil Analysis
- Disease Detection
- Yield Prediction
- AI Assistant
- Reports

---

# 🔮 Future Enhancements

- Real IoT Integration
- Weather API
- Mobile Application
- Satellite Monitoring
- SMS/Email Alerts
- Multi-language Support
- Advanced Analytics

---

# 📋 Known Limitations

- Uses simulated IoT data.
- Gemini API depends on available quota.
- Weather data is manually entered.
- No mobile application yet.

---

# 👨‍💻 Developer

**Anshul Mishra**

B.Tech Computer Science & Engineering

GitHub:
https://github.com/mishraanshul870-lab

---

# 📜 License

This project is intended for **educational and portfolio purposes**.

---

# ⭐ Support

If you found this repository useful, please consider giving it a ⭐ on GitHub.
