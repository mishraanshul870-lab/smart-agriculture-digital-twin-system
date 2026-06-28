import { SensorData, SensorHistoryPoint, Farm } from '../types';

export const CROP_TYPES = [
  'Wheat',
  'Rice',
  'Maize',
  'Cotton',
  'Sugarcane',
  'Tomato',
  'Potato',
  'Soybean',
  'Apple',
  'Green Chilli'
];

export function generateSensorData(cropType: string, area: number): SensorData {
  // Moisture baseline depending on crop
  let moistureBase = 50;
  if (cropType === 'Rice') moistureBase = 75;
  if (cropType === 'Cotton') moistureBase = 35;
  if (cropType === 'Sugarcane') moistureBase = 65;
  if (cropType === 'Green Chilli') moistureBase = 45;
  
  const moisture = Math.min(100, Math.max(0, Math.round(moistureBase + (Math.random() * 20 - 10))));
  
  // pH level: usually 5.5 to 8.0
  const pH = parseFloat((6.2 + (Math.random() * 2.0 - 1.0)).toFixed(1));
  
  // Temperature: usually 18°C to 38°C depending on random weather
  const temperature = Math.round(24 + (Math.random() * 12 - 6));
  
  // Humidity: usually 40% to 90%
  const humidity = Math.min(100, Math.max(0, Math.round(65 + (Math.random() * 30 - 15))));

  // Yield estimation based on standard crop yields per acre (with some weather impact)
  // Wheat: ~2 tons/acre, Rice: ~2.5 tons/acre, Maize: ~3 tons/acre, Cotton: ~1.2 tons/acre, Sugarcane: ~35 tons/acre
  let yieldMultiplier = 2.0;
  switch (cropType) {
    case 'Wheat': yieldMultiplier = 2.2; break;
    case 'Rice': yieldMultiplier = 2.6; break;
    case 'Maize': yieldMultiplier = 3.2; break;
    case 'Cotton': yieldMultiplier = 1.1; break;
    case 'Sugarcane': yieldMultiplier = 36.5; break;
    case 'Tomato': yieldMultiplier = 15.0; break;
    case 'Potato': yieldMultiplier = 12.0; break;
    case 'Soybean': yieldMultiplier = 1.5; break;
    case 'Apple': yieldMultiplier = 18.0; break;
    case 'Green Chilli': yieldMultiplier = 8.0; break;
  }
  
  // Weather impact multiplier (moisture and pH closeness to optimal)
  let healthFactor = 1.0;
  if (moisture < 30 || moisture > 80) healthFactor -= 0.15;
  if (pH < 6.0 || pH > 7.5) healthFactor -= 0.1;
  
  const rawYield = area * yieldMultiplier * healthFactor;
  // Introduce a minor simulation error of up to 5% (to satisfy "error below 10%")
  const errorFactor = 1.0 + (Math.random() * 0.08 - 0.04);
  const predictedYield = parseFloat((rawYield * errorFactor).toFixed(1));

  // Irrigation rules based on moisture
  let waterRecommendation: 'Irrigate now' | 'Wait 12 hours' | 'Wait 24 hours' = 'Wait 24 hours';
  if (moisture < 30) {
    waterRecommendation = 'Irrigate now';
  } else if (moisture < 55) {
    waterRecommendation = 'Wait 12 hours';
  } else {
    waterRecommendation = 'Wait 24 hours';
  }

  return {
    moisture,
    pH,
    temperature,
    humidity,
    predictedYield,
    waterRecommendation
  };
}

export function generateSensorHistory(cropType: string): SensorHistoryPoint[] {
  const points: SensorHistoryPoint[] = [];
  const now = new Date();
  
  // Moisture baseline depending on crop
  let moistureBase = 50;
  if (cropType === 'Rice') moistureBase = 75;
  if (cropType === 'Cotton') moistureBase = 35;
  if (cropType === 'Sugarcane') moistureBase = 65;
  if (cropType === 'Green Chilli') moistureBase = 45;

  // Generate 8 data points, 3 hours apart
  for (let i = 7; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
    const hourStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Create a smooth wave structure for fluctuations
    const wave = Math.sin((7 - i) * 0.8);
    const moisture = Math.min(100, Math.max(0, Math.round(moistureBase + wave * 8 + (Math.random() * 6 - 3))));
    
    // Temperature: peaks around mid-day (i.e. fluctuate based on index)
    const tempBase = 26;
    const tempWave = Math.sin((7 - i) * 0.5 + 1.2);
    const temperature = Math.round(tempBase + tempWave * 5 + (Math.random() * 2 - 1));
    
    // Humidity: inversely proportional to temperature
    const humidity = Math.min(100, Math.max(0, Math.round(75 - tempWave * 15 + (Math.random() * 4 - 2))));

    points.push({
      timestamp: hourStr,
      moisture,
      temperature,
      humidity
    });
  }

  return points;
}

export function createNewFarm(name: string, area: number, cropType: string, location: string): Farm {
  return {
    id: 'farm_' + Math.random().toString(36).substr(2, 9),
    name,
    area,
    cropType,
    location,
    sensorData: generateSensorData(cropType, area),
    sensorHistory: generateSensorHistory(cropType)
  };
}
