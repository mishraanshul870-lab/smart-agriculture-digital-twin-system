# Smart Agriculture Digital Twin System 🌾🚜

An advanced, AI-powered Smart Agriculture Digital Twin system featuring a live telemetry dashboard, Gemini Vision leaf diagnostics, structured soil analysis, yield predictions, and professional executive PDF reports.

---

## 🌟 Key Features
* **Real-time IoT Dashboard:** Live visualization charts for ambient temperature, soil moisture, and humidity trends, updating automatically via 30-second polling.
* **Gemini Vision leaf diagnostics:** Upload crop leaf images to run diagnoses on plant health and diseases using live Gemini models, with automatic image persistence to MongoDB.
* **Soil Chemistry Analysis:** Performs diagnostic testing based on manual input or IoT telemetry values. Employs Gemini to output a Soil Health Score, deficiencies, suitable crops list, and fertilizer advice.
* **Yield Prediction:** Calculates estimated yield volumes using real-time farm size, current weather reports, soil measurements, and historical irrigation logs.
* **Reports Center:** Instantly compiles professional branded executive PDF reports (using `jspdf` and `jspdf-autotable`) detailing full farm status, diagnostics, and AI recommendations.
* **AI Agronomist Chat:** A persistent, context-aware agronomist assistant chat focused strictly on farming queries.

---

## 🛠️ Technology Stack
* **Frontend:** React 19 (SPA), TypeScript, Recharts, Framer Motion, TailwindCSS, Lucide Icons, jsPDF.
* **Backend:** Node.js Express, TypeScript, Mongoose/MongoDB, esbuild.
* **AI Integration:** Google Gen AI SDK (`gemini-3.5-flash`), Google Gemini REST API.

---

## 📋 API Documentation

### 👤 User Authentication
* `POST /api/auth/register` — Register a new user account.
* `POST /api/auth/login` — Sign in and receive a JWT token.

### 🚜 Farm twin Management
* `GET /api/farms` — Fetch all farm twins owned by the user.
* `POST /api/farms` — Register a new farm twin.
* `POST /api/farms/actuator` — Toggle farm actuator valves (sprinklers, fans).

### 📈 IoT Telemetry
* `GET /api/sensors` — Fetch registered sensor nodes.
* `POST /api/sensors` — Add a new sensor node to a farm.
* `GET /api/sensors/readings` — Fetch historical telemetry readings for charts.
* `POST /api/sensors/reading` — Log a new reading from a telemetry node.

### 🧪 Soil Analysis
* `GET /api/soil-analysis` — Get historical soil logs.
* `POST /api/soil-analysis` — Log and analyze a new soil chemistry test using Gemini AI.

### 🍂 Leaf Diagnostics
* `GET /api/disease-history` — Fetch diagnostic history.
* `POST /api/disease-detection` — Analyze a leaf image using Gemini Vision API.

### 🔮 Yield Predictions
* `GET /api/yield-predictions` — Fetch historical predictions.
* `POST /api/yield-predictions/predict` — Generate a new crop yield prediction.

---

## 🚀 Setup & Installation

### Prerequisites
* [Node.js](https://nodejs.org) (v18 or higher)
* [MongoDB](https://www.mongodb.com) (or Atlas cloud account. Local in-memory MongoDB will run automatically if no URI is provided).

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY="your-google-ai-studio-key"
AI_PROVIDER="gemini"
MONGODB_URI="your-mongodb-atlas-uri"
```

### 3. Run Development Server
```bash
npm run dev
```
*Access the app at http://localhost:3000*

### 4. Build for Production
```bash
npm run build
```
This command compiles the React frontend to `/dist` and bundles the Express backend to `/dist/server.cjs`.

### 5. Launch Production Server
```bash
npm run start
```
