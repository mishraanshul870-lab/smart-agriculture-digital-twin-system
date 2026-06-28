import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Farm, DiseaseDiagnosis, SoilAnalysis, YieldPrediction, Notification, Field, Crop, SensorDevice, SensorReading, IrrigationRecord, FertilizerRecord, WeatherRecord } from './models';
import { seedSensorHistory } from "./telemetrySimulator";
import { checkDBConnection } from './db';
import { aiService } from './aiService';
import { createNewFarm, generateSensorData } from '../src/utils/simData';

const router = Router();

// Middleware for validation
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
};

// Middleware to check DB
const requireDB = (req: any, res: any, next: any) => {
  try {
    checkDBConnection();
    next();
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Middleware to verify JWT token
const requireAuth = (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    
    // Inject or validate userId across requests for extra safety
    if (req.query.userId) {
      req.query.userId = decoded.id;
    }
    if (req.body.userId) {
      req.body.userId = decoded.id;
    }
    
    next();
  } catch (error: any) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// --- Auth Routes ---
router.put('/profile/:id', requireDB, requireAuth, [
  body('name').notEmpty().withMessage('Name is required'),
], validate, async (req: any, res: any) => {
  try {
    const { name } = req.body;
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized profile update" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.name = name;
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        farmCount: await Farm.countDocuments({ userId: user._id })
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/register', requireDB, [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, async (req: any, res: any) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, passwordHash });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

    res.json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        farmCount: 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/login', requireDB, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const farmCount = await Farm.countDocuments({ userId: user._id });

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        farmCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/forgot-password', requireDB, [
  body('email').isEmail().withMessage('Valid email is required')
], validate, async (req: any, res: any) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "User with this email does not exist" });
    }
    res.json({
      success: true,
      message: "Reset link has been generated and sent (simulated)"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/reset-password', requireDB, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    
    res.json({
      success: true,
      message: "Password successfully reset"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Farm Routes ---
router.get('/farms', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const farms = await Farm.find({ userId }).lean();
    
    // Map _id to id for frontend
    const mappedFarms = farms.map((f: any) => {
      f.id = f._id.toString();
      delete f._id;
      delete f.__v;
      return f;
    });

    res.json({ success: true, farms: mappedFarms });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/farms', requireDB, requireAuth, [
  body('name').notEmpty().withMessage('Name is required'),
  body('area').isNumeric().withMessage('Area must be a number'),
  body('cropType').notEmpty().withMessage('Crop Type is required'),
  body('location').notEmpty().withMessage('Location is required')
], validate, async (req: any, res: any) => {
  try {
    const { name, area, cropType, location } = req.body;
    const userId = req.user.id;

    const count = await Farm.countDocuments({ userId });
    if (count >= 10) {
      return res.status(400).json({ success: false, message: "Maximum limit of 10 farms reached" });
    }

    const newFarm = await Farm.create({
      userId,
      name,
      area,
      cropType,
      location,
      sensorData: {
        moisture: 0,
        pH: 7.0,
        temperature: 0,
        humidity: 0,
        predictedYield: 0,
        waterRecommendation: 'Wait 24 hours'
      },
      sensorHistory: [],
      actuators: []
    });

    await Notification.create({
      userId,
      title: 'New Farm Registered',
      message: `Digital Twin for "${name}" has been successfully created with ${area} acres of ${cropType}.`,
      category: 'ai_recommendation',
      priority: 'low'
    });

    const farmResponse = newFarm.toObject() as any;
    farmResponse.id = farmResponse._id.toString();

    res.json({ success: true, farm: farmResponse });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/farms/:id', requireDB, requireAuth, [
  param('id').notEmpty().withMessage('Farm ID is required')
], validate, async (req: any, res: any) => {
  try {
    const { name, area, cropType, location } = req.body;
    const farm = await Farm.findOne({ _id: req.params.id, userId: req.user.id });

    if (!farm) {
      return res.status(404).json({ success: false, message: "Farm not found or access denied" });
    }

    if (name) farm.name = name;
    if (location) farm.location = location;
    
    if (area) {
      farm.area = area;
    }
    if (cropType) {
      farm.cropType = cropType;
    }

    await farm.save();

    await Notification.create({
      userId: req.user.id,
      title: 'Farm Updated',
      message: `Details of your farm "${farm.name}" have been updated.`,
      category: 'ai_recommendation',
      priority: 'low'
    });

    const farmResponse = farm.toObject() as any;
    farmResponse.id = farmResponse._id.toString();

    res.json({ success: true, farm: farmResponse });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/farms/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const result = await Farm.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!result) return res.status(404).json({ success: false, message: "Farm not found or access denied" });

    await Notification.create({
      userId: req.user.id,
      title: 'Farm Deleted',
      message: `Farm "${result.name}" has been removed.`,
      category: 'ai_recommendation',
      priority: 'medium'
    });

    res.json({ success: true, message: "Farm deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/farms/refresh', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required')
], validate, async (req: any, res: any) => {
  try {
    const farm = await Farm.findOne({ _id: req.body.farmId, userId: req.user.id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found or access denied" });

    // Update telemetry using the latest readings from MongoDB
    const latestReadings = await SensorReading.find({ farmId: farm._id }).sort({ timestamp: -1 }).limit(10);
    const sensorsList = await SensorDevice.find({ farmId: farm._id });
    const moistureReading = latestReadings.find(r => {
      const sensor = sensorsList.find(s => s._id.toString() === r.sensorId.toString());
      return sensor?.type === 'moisture';
    });
    const tempReading = latestReadings.find(r => {
      const sensor = sensorsList.find(s => s._id.toString() === r.sensorId.toString());
      return sensor?.type === 'temperature';
    });
    const humidityReading = latestReadings.find(r => {
      const sensor = sensorsList.find(s => s._id.toString() === r.sensorId.toString());
      return sensor?.type === 'humidity';
    });
    const phReading = latestReadings.find(r => {
      const sensor = sensorsList.find(s => s._id.toString() === r.sensorId.toString());
      return sensor?.type === 'ph';
    });

    if (!farm.sensorData) {
      farm.sensorData = {
        moisture: 0,
        pH: 7.0,
        temperature: 0,
        humidity: 0,
        predictedYield: 0,
        waterRecommendation: 'Wait 24 hours'
      };
    }

    if (moistureReading) farm.sensorData.moisture = moistureReading.value;
    if (tempReading) farm.sensorData.temperature = tempReading.value;
    if (humidityReading) farm.sensorData.humidity = humidityReading.value;
    if (phReading) farm.sensorData.pH = phReading.value;

    if (moistureReading) {
      if (moistureReading.value < 30) farm.sensorData.waterRecommendation = 'Irrigate now';
      else if (moistureReading.value < 55) farm.sensorData.waterRecommendation = 'Wait 12 hours';
      else farm.sensorData.waterRecommendation = 'Wait 24 hours';
    }

    if (moistureReading || tempReading || humidityReading) {
      const now = new Date();
      const hourStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      farm.sensorHistory = farm.sensorHistory || [];
      farm.sensorHistory.push({
        timestamp: hourStr,
        moisture: farm.sensorData.moisture || 0,
        temperature: farm.sensorData.temperature || 0,
        humidity: farm.sensorData.humidity || 0
      });
      if (farm.sensorHistory.length > 8) {
        farm.sensorHistory.shift();
      }
    }

    await farm.save();

    // Check for abnormal IoT sensor readings during refresh
    if (farm.sensorData.moisture > 0 && farm.sensorData.moisture < 25) {
      await Notification.create({
        userId: req.user.id,
        title: 'Low Soil Moisture Warning',
        message: `Moisture level at "${farm.name}" has dropped to ${farm.sensorData.moisture}%. Recommended to activate irrigation system.`,
        category: 'irrigation',
        priority: 'high'
      });
    } else if (farm.sensorData.moisture > 80) {
      await Notification.create({
        userId: req.user.id,
        title: 'High Soil Moisture Alert',
        message: `Moisture level at "${farm.name}" is unusually high (${farm.sensorData.moisture}%). Potential waterlogging.`,
        category: 'irrigation',
        priority: 'medium'
      });
    }

    if (farm.sensorData.temperature > 38) {
      await Notification.create({
        userId: req.user.id,
        title: 'Extreme Temperature Warning',
        message: `Temperature at "${farm.name}" is critically high (${farm.sensorData.temperature}°C). Crop heat stress risk detected.`,
        category: 'weather',
        priority: 'high'
      });
    }
    
    const farmResponse = farm.toObject() as any;
    farmResponse.id = farmResponse._id.toString();

    res.json({ success: true, farm: farmResponse });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/farms/actuator', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('actuatorId').notEmpty().withMessage('Actuator ID is required'),
  body('state').isIn(['on', 'off']).withMessage('State must be on or off')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, actuatorId, state } = req.body;
    const farm = await Farm.findOne({ _id: farmId, userId: req.user.id });
    if (!farm) {
      return res.status(404).json({ success: false, message: "Farm not found or access denied" });
    }

    if (!farm.actuators || farm.actuators.length === 0) {
      // Initialize if empty
      farm.actuators = [
        { id: 'a1', name: 'Zone 1 Irrigation Valve', type: 'valve', state: 'off', lastAction: 'Closed 2h ago' },
        { id: 'a2', name: 'Main Water Pump', type: 'pump', state: 'on', lastAction: 'Started 15m ago' },
        { id: 'a3', name: 'Nutrient Doser', type: 'pump', state: 'off', lastAction: 'Closed 1d ago' },
        { id: 'a4', name: 'Zone 2 Irrigation Valve', type: 'valve', state: 'error', lastAction: 'Failed to close' }
      ];
    }

    const actuator = farm.actuators.find((a: any) => a.id === actuatorId);
    if (!actuator) {
      return res.status(404).json({ success: false, message: "Actuator not found on this farm" });
    }

    if (actuator.state === 'error') {
      return res.status(400).json({ success: false, message: `Cannot control ${actuator.name}. Device in error state.` });
    }

    actuator.state = state;
    actuator.lastAction = `${state === 'on' ? 'Started' : 'Closed'} just now`;
    farm.markModified('actuators');
    await farm.save();

    // Create real notification
    await Notification.create({
      userId: req.user.id,
      title: `${actuator.name} Command Sent`,
      message: `Actuator "${actuator.name}" on farm "${farm.name}" was turned ${state.toUpperCase()} via IoT Command Center.`,
      category: 'iot',
      priority: 'low'
    });

    const farmResponse = farm.toObject() as any;
    farmResponse.id = farmResponse._id.toString();

    res.json({ success: true, farm: farmResponse });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- AI Routes ---

router.post('/disease-detection', requireDB, requireAuth, [
  body('base64Image').notEmpty().withMessage('Image data is required'),
  body('mimeType').notEmpty().withMessage('MIME Type is required'),
  body('cropType').notEmpty().withMessage('Crop Type is required')
], validate, async (req: any, res: any) => {
  const { base64Image, mimeType, cropType, farmId, language } = req.body;
  const userId = req.user.id;

  try {
    let farmName = "";
    // Verify farm ownership if farmId is provided
    if (farmId) {
      const farm = await Farm.findOne({ _id: farmId, userId });
      if (!farm) {
        return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
      }
      farmName = farm.name;
    }

    const predictionData = await aiService.detectDisease(base64Image, mimeType, cropType, language || 'en');

    // Save diagnosis to DB
    const diagnosis = await DiseaseDiagnosis.create({
      userId,
      farmId,
      cropType: predictionData.cropType || cropType,
      diseaseName: predictionData.diseaseName || "Healthy",
      confidence: predictionData.confidence || 0.90,
      treatment: predictionData.treatment || "None required",
      imageUrl: base64Image ? `data:${mimeType};base64,${base64Image}` : undefined,
      severity: predictionData.severity || 'Low',
      symptoms: predictionData.symptoms || '',
      causes: predictionData.causes || '',
      prevention: predictionData.prevention || '',
      estimatedRecovery: predictionData.estimatedRecovery || 'N/A',
      irrigation: predictionData.irrigation || '',
      fertilizer: predictionData.fertilizer || ''
    });

    // Create a real notification
    const isHealthy = diagnosis.diseaseName.toLowerCase().includes('healthy');
    await Notification.create({
      userId,
      title: isHealthy ? 'Crop Health Scan Complete' : 'Crop Disease Detected!',
      message: `A leaf scan for crop "${cropType}"${farmName ? ` on farm "${farmName}"` : ''} detected "${diagnosis.diseaseName}" with ${Math.round(diagnosis.confidence * 100)}% confidence.`,
      category: 'disease',
      priority: isHealthy ? 'low' : 'high'
    });

    res.json({
      success: true,
      prediction: {
        diseaseName: diagnosis.diseaseName,
        confidence: diagnosis.confidence,
        treatment: diagnosis.treatment,
        cropType: diagnosis.cropType,
        severity: diagnosis.severity,
        symptoms: diagnosis.symptoms,
        causes: diagnosis.causes,
        prevention: diagnosis.prevention,
        estimatedRecovery: diagnosis.estimatedRecovery,
        irrigation: diagnosis.irrigation,
        fertilizer: diagnosis.fertilizer
      },
      diagnosisId: diagnosis._id
    });
  } catch (error: any) {
    const status = error.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/disease-history', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const history = await DiseaseDiagnosis.find({ userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/disease-history/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const result = await DiseaseDiagnosis.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    res.json({ success: true, message: "Disease report deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Soil Analysis Routes ---
router.post('/soil-analysis', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('moisture').isNumeric().withMessage('Moisture must be a number'),
  body('pH').isNumeric().withMessage('pH must be a number'),
  body('nitrogen').isNumeric().withMessage('Nitrogen must be a number'),
  body('phosphorus').isNumeric().withMessage('Phosphorus must be a number'),
  body('potassium').isNumeric().withMessage('Potassium must be a number'),
  body('organicCarbon').isNumeric().withMessage('Organic Carbon must be a number'),
  body('temperature').isNumeric().withMessage('Temperature must be a number'),
  body('humidity').isNumeric().withMessage('Humidity must be a number')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, moisture, pH, nitrogen, phosphorus, potassium, organicCarbon, temperature, humidity, language } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    const enhancedResult = await aiService.getSoilRecommendations({
      cropType: farm.cropType,
      moisture, pH, nitrogen, phosphorus, potassium, organicCarbon, temperature, humidity,
      language: language || 'en'
    });

    const analysis = await SoilAnalysis.create({
      userId,
      farmId,
      moisture, pH, nitrogen, phosphorus, potassium, organicCarbon, temperature, humidity,
      recommendations: enhancedResult.recommendations,
      soilHealth: enhancedResult.soilHealth,
      deficiencies: enhancedResult.deficiencies,
      fertilizerRecommendation: enhancedResult.fertilizerRecommendation,
      irrigationRecommendation: enhancedResult.irrigationRecommendation,
      suitableCrops: enhancedResult.suitableCrops,
      riskLevel: enhancedResult.riskLevel
    });

    // Trigger Notification for the new soil analysis
    const isOptimal = pH >= 6.0 && pH <= 7.5 && moisture >= 30 && moisture <= 70;
    await Notification.create({
      userId,
      title: 'Soil Analysis Completed',
      message: `Soil analysis for "${farm.name}" completed. Health Score: ${enhancedResult.soilHealth}/10. Risk: ${enhancedResult.riskLevel}.`,
      category: 'soil',
      priority: isOptimal ? 'low' : 'high'
    });

    res.json({ success: true, analysis });
  } catch (error: any) {
    const status = error.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/soil-analysis', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const farmId = req.query.farmId;
    let history;
    if (farmId) {
      // Verify farm ownership
      const farm = await Farm.findOne({ _id: farmId, userId: req.user.id });
      if (!farm) {
        return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
      }
      history = await SoilAnalysis.find({ farmId }).sort({ createdAt: -1 }).limit(100);
    } else {
      // Fetch all user's farms
      const userFarms = await Farm.find({ userId: req.user.id });
      const farmIds = userFarms.map(f => f._id);
      history = await SoilAnalysis.find({ farmId: { $in: farmIds } }).sort({ createdAt: -1 }).limit(100);
    }
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/soil-analysis/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const result = await SoilAnalysis.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    res.json({ success: true, message: "Soil report deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Yield Prediction Routes ---
router.post('/yield-predictions/predict', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('cropType').notEmpty().withMessage('Crop Type is required'),
  body('area').isNumeric().withMessage('Area must be a number'),
  body('season').notEmpty().withMessage('Season is required'),
  body('soilType').notEmpty().withMessage('Soil Type is required'),
  body('irrigation').notEmpty().withMessage('Irrigation type is required'),
  body('fertilizer').notEmpty().withMessage('Fertilizer regimen is required')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, cropType, area, season, soilType, irrigation, fertilizer, historicalYield, language } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) return res.status(403).json({ success: false, message: 'Farm not found.' });

    // Fetch actual DB context in parallel
    const [latestSoil, latestWeather, irrigationRecords, fertilizerRecords, activeCrops] = await Promise.all([
      SoilAnalysis.findOne({ farmId }).sort({ createdAt: -1 }).lean(),
      WeatherRecord.findOne({ $or: [{ farmId }, { userId }] }).sort({ timestamp: -1 }).lean(),
      IrrigationRecord.find({ farmId }).sort({ date: -1 }).limit(5).lean(),
      FertilizerRecord.find({ farmId }).sort({ date: -1 }).limit(5).lean(),
      Crop.find({ farmId, status: 'Growing' }).lean()
    ]);

    const irrigationSummary = irrigationRecords.length > 0
      ? irrigationRecords.map((i: any) => `${new Date(i.date).toLocaleDateString()}: ${i.waterAmount}L/${i.duration}min`).join(', ')
      : 'No recent records';
    const fertilizerSummary = fertilizerRecords.length > 0
      ? fertilizerRecords.map((f: any) => `${new Date(f.date).toLocaleDateString()}: ${f.type} ${f.quantity}kg`).join(', ')
      : 'No recent records';
    const activeCropSummary = activeCrops.length > 0
      ? activeCrops.map((c: any) => `${c.name} (${c.variety})`).join(', ')
      : 'None recorded';

    const predictionResult = await aiService.predictYield({
      cropType, area, season, soilType, irrigation, fertilizer,
      historicalYield: parseFloat(historicalYield || '0'),
      weather: latestWeather ? latestWeather.condition : 'Unknown',
      // Extra DB context fields (passed through as any)
      ...(latestSoil ? {
        soilPH: latestSoil.pH,
        soilMoisture: latestSoil.moisture,
        soilNitrogen: latestSoil.nitrogen,
        soilPhosphorus: latestSoil.phosphorus,
        soilPotassium: latestSoil.potassium
      } : {}),
      ...(latestWeather ? { weatherTemp: latestWeather.temperature, weatherHumidity: latestWeather.humidity } : {}),
      irrigationSummary,
      fertilizerSummary,
      activeCrops: activeCropSummary,
      language: language || 'en'
    } as any);

    res.json({ success: true, prediction: predictionResult });
  } catch (error: any) {
    const status = error.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.post('/yield-predictions', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('cropType').notEmpty().withMessage('Crop Type is required'),
  body('area').isNumeric().withMessage('Area must be a number'),
  body('predictedYield').isNumeric().withMessage('Predicted Yield must be a number'),
  body('errorMargin').isNumeric().withMessage('Error Margin must be a number')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, cropType, area, predictedYield, errorMargin } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId: req.user.id });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    const prediction = await YieldPrediction.create({ userId: req.user.id, farmId, cropType, area, predictedYield, errorMargin });
    
    // Create automatic notification for Yield Prediction
    await Notification.create({
      userId: req.user.id,
      title: 'Yield Projection Generated',
      message: `AI model projected a yield of ${predictedYield} tons for "${farm.name}" with ${(100 - errorMargin).toFixed(1)}% confidence accuracy.`,
      category: 'ai_recommendation',
      priority: 'low'
    });

    res.json({ success: true, prediction });
  } catch (error: any) {
    const status = error.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/yield-predictions', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const history = await YieldPrediction.find({ userId }).sort({ createdAt: -1 }).limit(150);
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/yield-predictions/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const result = await YieldPrediction.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    res.json({ success: true, message: "Yield prediction report deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Sensor Readings Routes ---
router.get('/sensors/readings', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { farmId, limit = '100' } = req.query;
    const userId = req.user.id;
    if (!farmId) return res.status(400).json({ success: false, message: 'farmId is required' });
    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId }).lean();
    if (!farm) return res.status(403).json({ success: false, message: 'Farm not found' });
    // Get sensor devices for this farm
    const devices = await SensorDevice.find({ farmId, userId }).lean();
    const sensorIds = devices.map((d: any) => d._id);
    const readings = await SensorReading.find({ sensorId: { $in: sensorIds } })
      .sort({ timestamp: -1 }).limit(parseInt(limit as string)).lean();
    // Enrich readings with sensor name/type
    const enriched = readings.map((r: any) => {
      const device = devices.find((d: any) => String(d._id) === String(r.sensorId));
      return { ...r, sensorName: device?.name, sensorType: device?.type };
    });
    res.json({ success: true, readings: enriched.reverse() });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sensors/reading', requireDB, requireAuth, [
  body('sensorId').notEmpty().withMessage('Sensor ID is required'),
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('value').isNumeric().withMessage('Value must be a number')
], validate, async (req: any, res: any) => {
  try {
    const { sensorId, farmId, value } = req.body;
    const userId = req.user.id;
    const reading = await SensorReading.create({ userId, farmId, sensorId, value, timestamp: new Date() });
    res.json({ success: true, reading });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Full Summary Report Endpoint (for PDF generation) ---
router.get('/reports/full-summary', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { farmId } = req.query;
    const userId = req.user.id;
    if (!farmId) return res.status(400).json({ success: false, message: 'farmId is required' });
    const farm = await Farm.findOne({ _id: farmId, userId }).lean();
    if (!farm) return res.status(403).json({ success: false, message: 'Farm not found' });
    const [soilAnalyses, diseaseReports, yieldPredictions, irrigationRecords, fertilizerRecords, weatherRecords, crops] = await Promise.all([
      SoilAnalysis.find({ farmId }).sort({ createdAt: -1 }).limit(5).lean(),
      DiseaseDiagnosis.find({ farmId }).sort({ createdAt: -1 }).limit(5).lean(),
      YieldPrediction.find({ farmId }).sort({ createdAt: -1 }).limit(5).lean(),
      IrrigationRecord.find({ farmId }).sort({ date: -1 }).limit(5).lean(),
      FertilizerRecord.find({ farmId }).sort({ date: -1 }).limit(5).lean(),
      WeatherRecord.find({ $or: [{ farmId }, { userId }] }).sort({ timestamp: -1 }).limit(3).lean(),
      Crop.find({ farmId }).lean()
    ]);
    res.json({ success: true, farm, soilAnalyses, diseaseReports, yieldPredictions, irrigationRecords, fertilizerRecords, weatherRecords, crops });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports/toggle-favorite', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { id, type } = req.body;
    if (!id || !type) return res.status(400).json({ success: false, message: "ID and Type are required" });

    let model: any;
    if (type === 'Soil Analysis') model = SoilAnalysis;
    else if (type === 'Disease Diagnosis') model = DiseaseDiagnosis;
    else if (type === 'Yield Prediction') model = YieldPrediction;
    else if (type === 'AI Insights') model = Notification;
    else return res.status(400).json({ success: false, message: "Invalid report type" });

    const doc = await model.findOne({ _id: id, userId: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: "Report not found" });

    doc.isFavorite = !doc.isFavorite;
    await doc.save();

    res.json({ success: true, isFavorite: doc.isFavorite });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports/toggle-archive', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { id, type } = req.body;
    if (!id || !type) return res.status(400).json({ success: false, message: "ID and Type are required" });

    let model: any;
    if (type === 'Soil Analysis') model = SoilAnalysis;
    else if (type === 'Disease Diagnosis') model = DiseaseDiagnosis;
    else if (type === 'Yield Prediction') model = YieldPrediction;
    else if (type === 'AI Insights') model = Notification;
    else return res.status(400).json({ success: false, message: "Invalid report type" });

    const doc = await model.findOne({ _id: id, userId: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: "Report not found" });

    doc.isArchived = !doc.isArchived;
    await doc.save();

    res.json({ success: true, isArchived: doc.isArchived });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Notifications Routes ---
router.post('/notifications', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    if (Array.isArray(req.body)) {
      const docs = req.body.map(item => ({
        userId,
        title: item.title,
        message: item.message,
        category: item.category || 'ai_recommendation',
        priority: item.priority || 'medium',
        isRead: !!item.isRead,
        isArchived: !!item.isArchived,
        createdAt: item.timestamp ? new Date(item.timestamp) : new Date()
      }));
      const created = await Notification.insertMany(docs);
      return res.json({ success: true, notifications: created });
    } else {
      const { title, message, category, priority } = req.body;
      const notification = await Notification.create({
        userId,
        title,
        message,
        category: category || 'ai_recommendation',
        priority: priority || 'medium',
        isRead: false,
        isArchived: false
      });
      return res.json({ success: true, notification });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/notifications', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/notifications/:id/read', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true }, { new: true });
    res.json({ success: true, notification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/notifications/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { isRead, isArchived } = req.body;
    const update: any = {};
    if (isRead !== undefined) update.isRead = isRead;
    if (isArchived !== undefined) update.isArchived = isArchived;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      update,
      { new: true }
    );
    res.json({ success: true, notification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/notifications/bulk', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { ids, action } = req.body;
    if (!ids || !Array.isArray(ids) || !action) {
      return res.status(400).json({ success: false, message: "Missing ids or action" });
    }
    
    if (action === 'read') {
      await Notification.updateMany({ _id: { $in: ids }, userId: req.user.id }, { isRead: true });
    } else if (action === 'archive') {
      await Notification.updateMany({ _id: { $in: ids }, userId: req.user.id }, { isArchived: true });
    } else if (action === 'delete') {
      await Notification.deleteMany({ _id: { $in: ids }, userId: req.user.id });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/notifications/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Chat Assistant Route ---
router.post('/chat', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { message, base64Image, mimeType } = req.body;
    const userId = req.user.id;
    
    if (!message && !base64Image) {
      return res.status(400).json({ success: false, message: 'Either message or image is required' });
    }

    console.log(`[Frontend Request] User ID: ${userId}, Has Image: ${!!base64Image}, Message: "${message || ''}"`);
    
    // Fetch all related databases in parallel
    const [
      farms,
      fields,
      crops,
      soilAnalyses,
      sensorDevices,
      weatherRecords,
      irrigationRecords,
      fertilizerRecords,
      diseaseReports
    ] = await Promise.all([
      Farm.find({ userId }).lean(),
      Field.find({ userId }).lean(),
      Crop.find({ userId }).lean(),
      SoilAnalysis.find({ userId }).lean(),
      SensorDevice.find({ userId }).lean(),
      WeatherRecord.find({ userId }).sort({ timestamp: -1 }).limit(5).lean(),
      IrrigationRecord.find({ userId }).sort({ date: -1 }).limit(10).lean(),
      FertilizerRecord.find({ userId }).sort({ date: -1 }).limit(10).lean(),
      DiseaseDiagnosis.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    // Requirement: If no farm data exists, clearly say: "No farm data is available yet. Please add a farm and sensor records."
    if (!farms || farms.length === 0) {
      console.log(`[Chat Route empty state] No farms found for user ${userId}`);
      return res.json({ success: true, reply: "No farm data is available yet. Please add a farm and sensor records." });
    }

    // Build dynamic context from records
    const contextParts: string[] = [];

    contextParts.push(`Farms:\n` + farms.map((f: any) => `- Name: ${f.name}, Location: ${f.location}, Area: ${f.area} acres, Crop: ${f.cropType}. Current sensor data: Moisture ${f.sensorData?.moisture ?? 'N/A'}%, pH ${f.sensorData?.pH ?? 'N/A'}, Temp ${f.sensorData?.temperature ?? 'N/A'}C, Humidity ${f.sensorData?.humidity ?? 'N/A'}%`).join('\n'));

    if (fields.length > 0) {
      contextParts.push(`Fields:\n` + fields.map((f: any) => `- Name: ${f.name}, Crop: ${f.cropType}, Area: ${f.area} acres`).join('\n'));
    }
    if (crops.length > 0) {
      contextParts.push(`Crops:\n` + crops.map((c: any) => `- Name: ${c.name}, Variety: ${c.variety}, Status: ${c.status}, Planted: ${c.plantedDate ? new Date(c.plantedDate).toLocaleDateString() : 'N/A'}`).join('\n'));
    }
    if (soilAnalyses.length > 0) {
      contextParts.push(`Soil Analyses:\n` + soilAnalyses.map((s: any) => `- Moisture: ${s.moisture}%, pH: ${s.pH}, Nitrogen: ${s.nitrogen ?? 0} mg/kg, Phosphorus: ${s.phosphorus ?? 0} mg/kg, Potassium: ${s.potassium ?? 0} mg/kg, Organic Carbon: ${s.organicCarbon ?? 0}%`).join('\n'));
    }
    if (sensorDevices.length > 0) {
      contextParts.push(`IoT Sensors:\n` + sensorDevices.map((d: any) => `- Name: ${d.name}, Type: ${d.type}, Status: ${d.status}, Battery: ${d.battery}%`).join('\n'));
    }
    if (weatherRecords.length > 0) {
      contextParts.push(`Weather Records (recent):\n` + weatherRecords.map((w: any) => `- Temp: ${w.temperature}C, Humidity: ${w.humidity}%, Wind: ${w.windSpeed} km/h, Rainfall: ${w.rainfall}mm, Condition: ${w.condition} (at ${new Date(w.timestamp).toLocaleDateString()})`).join('\n'));
    }
    if (irrigationRecords.length > 0) {
      contextParts.push(`Irrigation History:\n` + irrigationRecords.map((i: any) => `- Date: ${new Date(i.date).toLocaleDateString()}, Duration: ${i.duration} mins, Water: ${i.waterAmount}L, Status: ${i.status}`).join('\n'));
    }
    if (fertilizerRecords.length > 0) {
      contextParts.push(`Fertilizer Application History:\n` + fertilizerRecords.map((f: any) => `- Date: ${new Date(f.date).toLocaleDateString()}, Type: ${f.type}, Quantity: ${f.quantity}kg`).join('\n'));
    }
    if (diseaseReports.length > 0) {
      contextParts.push(`Disease Diagnostics Reports:\n` + diseaseReports.map((d: any) => `- Crop: ${d.cropType}, Disease: ${d.diseaseName}, Confidence: ${(d.confidence * 100).toFixed(0)}%, Treatment: ${d.treatment}`).join('\n'));
    }

    const farmContext = contextParts.join('\n\n');

    if (base64Image) {
      console.log(`[Chat Route Vision] Running Gemini Vision detection on attached image...`);
      const activeCropType = farms[0]?.cropType || 'Tomato';
      const predictionData = await aiService.detectDisease(base64Image, mimeType || 'image/jpeg', activeCropType);

      // Save diagnosis to DB
      const diagnosis = await DiseaseDiagnosis.create({
        userId,
        farmId: farms[0]?._id,
        cropType: predictionData.cropType || activeCropType,
        diseaseName: predictionData.diseaseName || "Healthy",
        confidence: predictionData.confidence || 0.90,
        treatment: predictionData.treatment || "None required",
        imageUrl: `data:${mimeType || 'image/jpeg'};base64,${base64Image}`,
        severity: predictionData.severity || 'Low',
        symptoms: predictionData.symptoms || '',
        causes: predictionData.causes || '',
        prevention: predictionData.prevention || '',
        estimatedRecovery: predictionData.estimatedRecovery || 'N/A',
        irrigation: predictionData.irrigation || '',
        fertilizer: predictionData.fertilizer || ''
      });

      // Construct rich markdown response
      let reply = `### Leaf Diagnosis Complete\n\n`;
      reply += `* **Crop Type:** ${diagnosis.cropType}\n`;
      reply += `* **Detected Condition:** **${diagnosis.diseaseName}**\n`;
      reply += `* **AI Confidence:** ${(diagnosis.confidence * 100).toFixed(0)}%\n`;
      reply += `* **Severity Level:** ${diagnosis.severity}\n`;
      reply += `* **Estimated Recovery:** ${diagnosis.estimatedRecovery}\n\n`;
      reply += `---\n\n`;
      reply += `### Symptoms & Causes\n`;
      reply += `* **Symptoms:** ${diagnosis.symptoms || 'No distinct symptoms visible.'}\n`;
      reply += `* **Causes:** ${diagnosis.causes || 'Environmental stress or normal growth patterns.'}\n\n`;
      reply += `---\n\n`;
      reply += `### Treatment Plan\n${diagnosis.treatment}\n\n`;
      reply += `---\n\n`;
      reply += `### Recommendations & Prevention\n`;
      reply += `* **Prevention:** ${diagnosis.prevention || 'Maintain standard crop hygiene.'}\n`;
      reply += `* **Irrigation Advice:** ${diagnosis.irrigation || 'Ensure adequate irrigation.'}\n`;
      reply += `* **Fertilization Advice:** ${diagnosis.fertilizer || 'Provide balanced nutrient plan.'}\n`;

      if (message) {
        const visionContext = `The user uploaded an image of crop [${diagnosis.cropType}]. Gemini Vision analyzed the image and detected [${diagnosis.diseaseName}] with severity [${diagnosis.severity}]. Symptoms: [${diagnosis.symptoms}]. Treatment: [${diagnosis.treatment}]. Prevention: [${diagnosis.prevention}].`;
        const customResponse = await aiService.chat(message, `${farmContext}\n\nVision Context: ${visionContext}`);
        reply += `\n\n---\n\n### Response to prompt ("${message}")\n\n${customResponse}`;
      }

      return res.json({ success: true, reply });
    }

    const reply = await aiService.chat(message, farmContext);
    res.json({ success: true, reply });
  } catch (error: any) {
    const status = error.name === 'ValidationError' ? 400 : 500;
    console.error(`[Chat Route Error] Status: ${status}, Message: "${error.message}"`);
    res.status(status).json({ success: false, message: error.message });
  }
});

// --- Weather Proxy Route ---
router.get('/weather', requireAuth, async (req: any, res: any) => {
  try {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Latitude and longitude required" });
    }
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
      
      const apiResponse = await fetch(url, { signal: controller.signal as any });
      clearTimeout(timeoutId);
      
      if (!apiResponse.ok) {
        throw new Error(`Open-Meteo API returned status ${apiResponse.status}`);
      }
      const data = await apiResponse.json();
      res.json(data);
    } catch (fetchError: any) {
      console.error("Backend failed to fetch from open-meteo", fetchError);
      res.status(502).json({ success: false, message: "Weather service is currently offline. Please enter weather records manually." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Fields Routes ---
router.post('/fields', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('name').notEmpty().withMessage('Field Name is required'),
  body('area').isNumeric().withMessage('Area must be a number'),
  body('cropType').notEmpty().withMessage('Crop Type is required')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, name, area, cropType } = req.body;
    const userId = req.user.id;

    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });

    const field = await Field.create({ userId, farmId, name, area, cropType });

    await Notification.create({
      userId,
      title: 'New Field Added',
      message: `Field "${name}" has been added to farm "${farm.name}".`,
      category: 'ai_recommendation',
      priority: 'low'
    });

    res.json({ success: true, field });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/fields', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const fields = await Field.find(query);
    res.json({ success: true, fields });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Crops Routes ---
router.post('/crops', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('name').notEmpty().withMessage('Crop name is required'),
  body('variety').notEmpty().withMessage('Variety is required'),
  body('plantedDate').notEmpty().withMessage('Planted date is required')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, fieldId, name, variety, plantedDate } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    // Verify field ownership if fieldId is provided
    if (fieldId) {
      const field = await Field.findOne({ _id: fieldId, farmId, userId });
      if (!field) {
        return res.status(403).json({ success: false, message: "Access denied. Field does not belong to user's farm." });
      }
    }

    const crop = await Crop.create({
      userId,
      farmId,
      fieldId: fieldId || undefined,
      name,
      variety,
      plantedDate: new Date(plantedDate),
      status: 'Growing'
    });

    await Notification.create({
      userId,
      title: 'New Crop Registered',
      message: `Crop "${name}" (${variety}) registered as growing on farm "${farm.name}".`,
      category: 'ai_recommendation',
      priority: 'low'
    });

    res.json({ success: true, crop });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/crops', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const crops = await Crop.find(query);
    res.json({ success: true, crops });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Sensors Routes ---
router.post('/sensors', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('name').notEmpty().withMessage('Sensor Name is required'),
  body('type').notEmpty().withMessage('Sensor Type is required')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, fieldId, name, type } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    // Verify field ownership if fieldId is provided
    if (fieldId) {
      const field = await Field.findOne({ _id: fieldId, farmId, userId });
      if (!field) {
        return res.status(403).json({ success: false, message: "Access denied. Field does not belong to user's farm." });
      }
    }

    const sensor = await SensorDevice.create({
      userId,
      farmId,
      fieldId: fieldId || undefined,
      name,
      type,
      status: 'online',
      battery: 100
    });

    try {
      await seedSensorHistory(userId, farmId, sensor._id, type);
    } catch (e: any) {
      console.error('Failed to seed sensor history in post route:', e.message);
    }

    await Notification.create({
      userId,
      title: 'New Sensor Configured',
      message: `Sensor device "${name}" (${type}) is online on farm "${farm.name}".`,
      category: 'iot',
      priority: 'low'
    });

    res.json({ success: true, sensor });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sensors', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const sensors = await SensorDevice.find(query);
    res.json({ success: true, sensors });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Sensor Readings Routes ---
router.post('/sensor-readings', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('sensorId').notEmpty().withMessage('Sensor ID is required'),
  body('value').isNumeric().withMessage('Reading value must be a number')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, sensorId, value } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    // Verify sensor ownership and association
    const sensor = await SensorDevice.findOne({ _id: sensorId, farmId, userId });
    if (!sensor) {
      return res.status(403).json({ success: false, message: "Access denied. Sensor device does not belong to user's farm." });
    }

    const reading = await SensorReading.create({
      userId,
      farmId,
      sensorId,
      value,
      timestamp: new Date()
    });

    // Update telemetry in the Farm document directly
    if (!farm.sensorData) {
      farm.sensorData = {
        moisture: 0,
        pH: 7.0,
        temperature: 0,
        humidity: 0,
        predictedYield: 0,
        waterRecommendation: 'Wait 24 hours'
      };
    }
    if (sensor.type === 'moisture') farm.sensorData.moisture = value;
    else if (sensor.type === 'temperature') farm.sensorData.temperature = value;
    else if (sensor.type === 'humidity') farm.sensorData.humidity = value;
    else if (sensor.type === 'ph') farm.sensorData.pH = value;

    if (sensor.type === 'moisture') {
      if (value < 30) farm.sensorData.waterRecommendation = 'Irrigate now';
      else if (value < 55) farm.sensorData.waterRecommendation = 'Wait 12 hours';
      else farm.sensorData.waterRecommendation = 'Wait 24 hours';
    }

    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    farm.sensorHistory = farm.sensorHistory || [];
    farm.sensorHistory.push({
      timestamp: timestampStr,
      moisture: farm.sensorData.moisture || 0,
      temperature: farm.sensorData.temperature || 0,
      humidity: farm.sensorData.humidity || 0
    });
    if (farm.sensorHistory.length > 8) {
      farm.sensorHistory.shift();
    }
    await farm.save();

    res.json({ success: true, reading });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sensor-readings', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const readings = await SensorReading.find(query).sort({ timestamp: -1 });
    res.json({ success: true, readings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Irrigation Records Routes ---
router.post('/irrigation-records', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('waterAmount').isNumeric().withMessage('Water amount must be a number')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, duration, waterAmount, status } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    const record = await IrrigationRecord.create({
      userId,
      farmId,
      date: new Date(),
      duration,
      waterAmount,
      status: status || 'Completed'
    });

    await Notification.create({
      userId,
      title: 'Irrigation Event Logged',
      message: `Watered "${farm.name}" for ${duration} minutes, usage: ${waterAmount}L.`,
      category: 'irrigation',
      priority: 'low'
    });

    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/irrigation-records', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const records = await IrrigationRecord.find(query).sort({ date: -1 });
    res.json({ success: true, records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Fertilizer Records Routes ---
router.post('/fertilizer-records', requireDB, requireAuth, [
  body('farmId').notEmpty().withMessage('Farm ID is required'),
  body('type').notEmpty().withMessage('Fertilizer type is required'),
  body('quantity').isNumeric().withMessage('Quantity must be a number')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, type, quantity } = req.body;
    const userId = req.user.id;

    // Verify farm ownership
    const farm = await Farm.findOne({ _id: farmId, userId });
    if (!farm) {
      return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
    }

    const record = await FertilizerRecord.create({
      userId,
      farmId,
      date: new Date(),
      type,
      quantity
    });

    await Notification.create({
      userId,
      title: 'Fertilizer Applied',
      message: `Applied ${quantity}kg of ${type} to farm "${farm.name}".`,
      category: 'soil',
      priority: 'low'
    });

    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/fertilizer-records', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const records = await FertilizerRecord.find(query).sort({ date: -1 });
    res.json({ success: true, records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Weather Records Routes ---
router.post('/weather-records', requireDB, requireAuth, [
  body('temperature').isNumeric().withMessage('Temperature must be a number'),
  body('humidity').isNumeric().withMessage('Humidity must be a number'),
  body('windSpeed').isNumeric().withMessage('Wind Speed must be a number'),
  body('rainfall').isNumeric().withMessage('Rainfall must be a number'),
  body('condition').notEmpty().withMessage('Condition is required')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, temperature, humidity, windSpeed, rainfall, condition } = req.body;
    const userId = req.user.id;

    // Verify farm ownership if farmId is provided
    if (farmId) {
      const farm = await Farm.findOne({ _id: farmId, userId });
      if (!farm) {
        return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
      }
    }

    const record = await WeatherRecord.create({
      userId,
      farmId: farmId || undefined,
      temperature,
      humidity,
      windSpeed,
      rainfall,
      condition,
      timestamp: new Date()
    });

    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/weather-records', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const records = await WeatherRecord.find({ userId }).sort({ timestamp: -1 });
    res.json({ success: true, records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Manual Disease Reports Routes ---
router.post('/disease-reports', requireDB, requireAuth, [
  body('cropType').notEmpty().withMessage('Crop Type is required'),
  body('diseaseName').notEmpty().withMessage('Disease Name is required'),
  body('confidence').isNumeric().withMessage('Confidence must be a number'),
  body('treatment').notEmpty().withMessage('Treatment is required')
], validate, async (req: any, res: any) => {
  try {
    const { farmId, cropType, diseaseName, confidence, treatment } = req.body;
    const userId = req.user.id;

    // Verify farm ownership if farmId is provided
    if (farmId) {
      const farm = await Farm.findOne({ _id: farmId, userId });
      if (!farm) {
        return res.status(403).json({ success: false, message: "Access denied. Farm does not belong to user." });
      }
    }

    const diagnosis = await DiseaseDiagnosis.create({
      userId,
      farmId: farmId || undefined,
      cropType,
      diseaseName,
      confidence: confidence / 100,
      treatment
    });

    await Notification.create({
      userId,
      title: 'Crop Disease Record Added',
      message: `A manual disease record for crop "${cropType}" has been saved: "${diseaseName}".`,
      category: 'disease',
      priority: 'medium'
    });

    res.json({ success: true, diagnosisId: diagnosis._id });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Soil Analysis GET / DELETE / PUT ---
router.get('/soil-analysis', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const farmId = req.query.farmId;
    const query = farmId ? { userId, farmId } : { userId };
    const history = await SoilAnalysis.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/soil-analysis/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { moisture, pH, nitrogen, phosphorus, potassium, organicCarbon, temperature, humidity, recommendations } = req.body;
    const analysis = await SoilAnalysis.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { moisture, pH, nitrogen, phosphorus, potassium, organicCarbon, temperature, humidity, recommendations },
      { new: true }
    );
    res.json({ success: true, analysis });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/soil-analysis/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const result = await SoilAnalysis.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    res.json({ success: true, message: "Soil report deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Fields PUT / DELETE ---
router.put('/fields/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { name, area, cropType } = req.body;
    const field = await Field.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name, area, cropType },
      { new: true }
    );
    res.json({ success: true, field });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/fields/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await Field.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Crops PUT / DELETE ---
router.put('/crops/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { name, variety, plantedDate, status } = req.body;
    const crop = await Crop.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name, variety, plantedDate: plantedDate ? new Date(plantedDate) : undefined, status },
      { new: true }
    );
    res.json({ success: true, crop });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/crops/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await Crop.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Sensors PUT / DELETE ---
router.put('/sensors/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { name, type, status, battery } = req.body;
    const sensor = await SensorDevice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name, type, status, battery },
      { new: true }
    );
    res.json({ success: true, sensor });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/sensors/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await SensorDevice.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Sensor Readings PUT / DELETE ---
router.put('/sensor-readings/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { value } = req.body;
    const reading = await SensorReading.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { value },
      { new: true }
    );
    res.json({ success: true, reading });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/sensor-readings/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await SensorReading.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Irrigation Records PUT / DELETE ---
router.put('/irrigation-records/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { duration, waterAmount, status } = req.body;
    const record = await IrrigationRecord.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { duration, waterAmount, status },
      { new: true }
    );
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/irrigation-records/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await IrrigationRecord.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Fertilizer Records PUT / DELETE ---
router.put('/fertilizer-records/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { type, quantity } = req.body;
    const record = await FertilizerRecord.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { type, quantity },
      { new: true }
    );
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/fertilizer-records/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await FertilizerRecord.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Weather Records PUT / DELETE ---
router.put('/weather-records/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { temperature, humidity, windSpeed, rainfall, condition } = req.body;
    const record = await WeatherRecord.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { temperature, humidity, windSpeed, rainfall, condition },
      { new: true }
    );
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/weather-records/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await WeatherRecord.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Disease Reports PUT / DELETE ---
router.put('/disease-reports/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    const { cropType, diseaseName, confidence, treatment } = req.body;
    const diagnosis = await DiseaseDiagnosis.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { cropType, diseaseName, confidence: confidence / 100, treatment },
      { new: true }
    );
    res.json({ success: true, diagnosis });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/disease-reports/:id', requireDB, requireAuth, async (req: any, res: any) => {
  try {
    await DiseaseDiagnosis.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

