import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

export interface ISensorData {
  moisture: number;
  pH: number;
  temperature: number;
  humidity: number;
  predictedYield: number;
  waterRecommendation: string;
}

export interface ISensorHistoryPoint {
  timestamp: string;
  moisture: number;
  temperature: number;
  humidity: number;
}

export interface IActuator {
  id: string;
  name: string;
  type: string;
  state: string;
  lastAction: string;
}

export interface IFarm extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  area: number;
  cropType: string;
  location: string;
  sensorData?: ISensorData;
  sensorHistory?: ISensorHistoryPoint[];
  actuators?: IActuator[];
}

const SensorDataSchema = new Schema({
  moisture: { type: Number, required: true },
  pH: { type: Number, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  predictedYield: { type: Number, required: true },
  waterRecommendation: { type: String, required: true }
}, { _id: false });

const SensorHistorySchema = new Schema({
  timestamp: { type: String, required: true },
  moisture: { type: Number, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true }
}, { _id: false });

const ActuatorSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  state: { type: String, required: true },
  lastAction: { type: String, required: true }
}, { _id: false });

const FarmSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  area: { type: Number, required: true },
  cropType: { type: String, required: true },
  location: { type: String, required: true },
  sensorData: { type: SensorDataSchema },
  sensorHistory: { type: [SensorHistorySchema], default: [] },
  actuators: { type: [ActuatorSchema], default: [] }
}, { timestamps: true });

export interface IDiseaseDiagnosis extends Document {
  userId: mongoose.Types.ObjectId;
  farmId?: mongoose.Types.ObjectId;
  cropType: string;
  diseaseName: string;
  confidence: number;
  treatment: string;
  imageUrl?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  // Rich Gemini analysis fields
  severity?: string;
  symptoms?: string;
  causes?: string;
  prevention?: string;
  estimatedRecovery?: string;
  irrigation?: string;
  fertilizer?: string;
  createdAt: Date;
}

const DiseaseDiagnosisSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm' },
  cropType: { type: String, required: true },
  diseaseName: { type: String, required: true },
  confidence: { type: Number, required: true },
  treatment: { type: String, required: true },
  imageUrl: { type: String },
  isArchived: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  severity: { type: String, default: 'Low' },
  symptoms: { type: String, default: '' },
  causes: { type: String, default: '' },
  prevention: { type: String, default: '' },
  estimatedRecovery: { type: String, default: 'N/A' },
  irrigation: { type: String, default: '' },
  fertilizer: { type: String, default: '' }
}, { timestamps: true });

export interface ISoilAnalysis extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  moisture: number;
  pH: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  organicCarbon?: number;
  temperature?: number;
  humidity?: number;
  recommendations: string[];
  // Rich Gemini-powered analysis fields
  soilHealth?: number;
  deficiencies?: string[];
  fertilizerRecommendation?: string;
  irrigationRecommendation?: string;
  suitableCrops?: string[];
  riskLevel?: 'Low' | 'Moderate' | 'High';
  isArchived?: boolean;
  isFavorite?: boolean;
  createdAt: Date;
}

const SoilAnalysisSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  moisture: { type: Number, required: true },
  pH: { type: Number, required: true },
  nitrogen: { type: Number, default: 0 },
  phosphorus: { type: Number, default: 0 },
  potassium: { type: Number, default: 0 },
  organicCarbon: { type: Number, default: 0 },
  temperature: { type: Number, default: 0 },
  humidity: { type: Number, default: 0 },
  recommendations: { type: [String], required: true },
  soilHealth: { type: Number, default: null },
  deficiencies: { type: [String], default: [] },
  fertilizerRecommendation: { type: String, default: '' },
  irrigationRecommendation: { type: String, default: '' },
  suitableCrops: { type: [String], default: [] },
  riskLevel: { type: String, enum: ['Low', 'Moderate', 'High'], default: 'Low' },
  isArchived: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
}, { timestamps: true });

export interface IYieldPrediction extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  cropType: string;
  area: number;
  predictedYield: number;
  errorMargin: number;
  isArchived?: boolean;
  isFavorite?: boolean;
  createdAt: Date;
}

const YieldPredictionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  cropType: { type: String, required: true },
  area: { type: Number, required: true },
  predictedYield: { type: Number, required: true },
  errorMargin: { type: Number, required: true },
  isArchived: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
}, { timestamps: true });

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  category: string;
  priority: string;
  isRead: boolean;
  isArchived: boolean;
  isFavorite?: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, default: 'ai_recommendation' },
  priority: { type: String, default: 'medium' },
  isRead: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
}, { timestamps: true });

// Define Schema Indexes
FarmSchema.index({ userId: 1 });
DiseaseDiagnosisSchema.index({ userId: 1 });
DiseaseDiagnosisSchema.index({ farmId: 1 });
SoilAnalysisSchema.index({ userId: 1 });
SoilAnalysisSchema.index({ farmId: 1 });
YieldPredictionSchema.index({ userId: 1 });
YieldPredictionSchema.index({ farmId: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
export const Farm = mongoose.model<IFarm>('Farm', FarmSchema);
export const DiseaseDiagnosis = mongoose.model<IDiseaseDiagnosis>('DiseaseDiagnosis', DiseaseDiagnosisSchema);
export const SoilAnalysis = mongoose.model<ISoilAnalysis>('SoilAnalysis', SoilAnalysisSchema);
export const YieldPrediction = mongoose.model<IYieldPrediction>('YieldPrediction', YieldPredictionSchema);
export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

export interface IChatSession extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  isPinned: boolean;
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    image?: string;
    feedback?: 'like' | 'dislike' | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema({
  id: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  image: { type: String },
  feedback: { type: String, enum: ['like', 'dislike', null], default: null }
}, { _id: false });

const ChatSessionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, default: 'New Conversation' },
  isPinned: { type: Boolean, default: false },
  messages: { type: [MessageSchema], default: [] }
}, { timestamps: true });

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);

export interface IField extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  name: string;
  area: number;
  cropType: string;
}

const FieldSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  name: { type: String, required: true },
  area: { type: Number, required: true },
  cropType: { type: String, required: true }
}, { timestamps: true });

export interface ICrop extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  fieldId?: mongoose.Types.ObjectId;
  name: string;
  variety: string;
  plantedDate: Date;
  harvestedDate?: Date;
  status: string;
}

const CropSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  fieldId: { type: Schema.Types.ObjectId, ref: 'Field' },
  name: { type: String, required: true },
  variety: { type: String, required: true },
  plantedDate: { type: Date, required: true },
  harvestedDate: { type: Date },
  status: { type: String, enum: ['Growing', 'Harvested'], default: 'Growing' }
}, { timestamps: true });

export interface ISensorDevice extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  fieldId?: mongoose.Types.ObjectId;
  name: string;
  type: string;
  status: string;
  battery: number;
}

const SensorDeviceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  fieldId: { type: Schema.Types.ObjectId, ref: 'Field' },
  name: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline', 'warning'], default: 'online' },
  battery: { type: Number, default: 100 }
}, { timestamps: true });

export interface ISensorReading extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  sensorId: mongoose.Types.ObjectId;
  value: number;
  timestamp: Date;
}

const SensorReadingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  sensorId: { type: Schema.Types.ObjectId, ref: 'SensorDevice', required: true },
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export interface IIrrigationRecord extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  date: Date;
  duration: number;
  waterAmount: number;
  status: string;
}

const IrrigationRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  date: { type: Date, required: true },
  duration: { type: Number, required: true },
  waterAmount: { type: Number, required: true },
  status: { type: String, enum: ['Completed', 'Scheduled'], default: 'Completed' }
}, { timestamps: true });

export interface IFertilizerRecord extends Document {
  userId: mongoose.Types.ObjectId;
  farmId: mongoose.Types.ObjectId;
  date: Date;
  type: string;
  quantity: number;
}

const FertilizerRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  date: { type: Date, required: true },
  type: { type: String, required: true },
  quantity: { type: Number, required: true }
}, { timestamps: true });

export interface IWeatherRecord extends Document {
  userId: mongoose.Types.ObjectId;
  farmId?: mongoose.Types.ObjectId;
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainfall: number;
  condition: string;
  timestamp: Date;
}

const WeatherRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm' },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  windSpeed: { type: Number, required: true },
  rainfall: { type: Number, required: true },
  condition: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Define remaining Schema Indexes
FieldSchema.index({ userId: 1 });
FieldSchema.index({ farmId: 1 });
CropSchema.index({ userId: 1 });
CropSchema.index({ farmId: 1 });
SensorDeviceSchema.index({ userId: 1 });
SensorDeviceSchema.index({ farmId: 1 });
SensorReadingSchema.index({ userId: 1 });
SensorReadingSchema.index({ farmId: 1 });
SensorReadingSchema.index({ sensorId: 1, timestamp: -1 });
IrrigationRecordSchema.index({ userId: 1 });
IrrigationRecordSchema.index({ farmId: 1 });
FertilizerRecordSchema.index({ userId: 1 });
FertilizerRecordSchema.index({ farmId: 1 });
WeatherRecordSchema.index({ userId: 1 });
WeatherRecordSchema.index({ farmId: 1 });

export const Field = mongoose.model<IField>('Field', FieldSchema);
export const Crop = mongoose.model<ICrop>('Crop', CropSchema);
export const SensorDevice = mongoose.model<ISensorDevice>('SensorDevice', SensorDeviceSchema);
export const SensorReading = mongoose.model<ISensorReading>('SensorReading', SensorReadingSchema);
export const IrrigationRecord = mongoose.model<IIrrigationRecord>('IrrigationRecord', IrrigationRecordSchema);
export const FertilizerRecord = mongoose.model<IFertilizerRecord>('FertilizerRecord', FertilizerRecordSchema);
export const WeatherRecord = mongoose.model<IWeatherRecord>('WeatherRecord', WeatherRecordSchema);

