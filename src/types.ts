export interface SensorData {
  moisture: number; // %
  pH: number;
  temperature: number; // °C
  humidity: number; // %
  predictedYield: number; // tons
  waterRecommendation: 'Irrigate now' | 'Wait 12 hours' | 'Wait 24 hours';
}

export interface SensorHistoryPoint {
  timestamp: string;
  moisture: number;
  temperature: number;
  humidity: number;
}

export interface Actuator {
  id: string;
  name: string;
  type: 'valve' | 'pump';
  state: 'on' | 'off' | 'error';
  lastAction: string;
}

export interface Farm {
  id: string;
  name: string;
  area: number; // acres
  cropType: string;
  location: string;
  sensorData: SensorData;
  sensorHistory: SensorHistoryPoint[];
  actuators?: Actuator[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  farmCount: number;
}

export interface DiseasePredictionResult {
  diseaseName: string;
  confidence: number;
  treatment: string;
  imageUrl?: string;
  cropType?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}
