import { SensorDevice, SensorReading, Farm } from './models';

export async function seedSensorHistory(userId: any, farmId: any, sensorId: any, sensorType: string) {
  try {
    const count = await SensorReading.countDocuments({ sensorId });
    if (count > 0) return;

    console.log(`[Simulator] Seeding initial history for sensor ${sensorId} (${sensorType})`);
    const history = [];
    const now = new Date();
    let baseVal = 50;
    if (sensorType === 'moisture') baseVal = 42;
    else if (sensorType === 'temperature') baseVal = 24;
    else if (sensorType === 'humidity') baseVal = 62;
    else if (sensorType === 'ph') baseVal = 6.4;

    for (let i = 24; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      const variation = Math.sin(i * 0.5) * (sensorType === 'ph' ? 0.2 : 4);
      history.push({
        userId,
        farmId,
        sensorId,
        value: parseFloat((baseVal + variation + (Math.random() * 2 - 1)).toFixed(1)),
        timestamp
      });
    }
    await SensorReading.insertMany(history);
    console.log(`[Simulator] Successfully seeded ${history.length} records for sensor ${sensorId}`);
  } catch (err: any) {
    console.error(`[Simulator Error] Failed to seed history for sensor ${sensorId}:`, err.message);
  }
}

export function startTelemetrySimulator() {
  console.log('📶 Starting live IoT telemetry simulator loop (5m interval)...');
  
  const interval = setInterval(async () => {
    try {
      const sensors = await SensorDevice.find();
      const now = new Date();
      
      for (const sensor of sensors) {
        // 1. Seed history if empty
        const count = await SensorReading.countDocuments({ sensorId: sensor._id });
        if (count === 0) {
          await seedSensorHistory(sensor.userId, sensor.farmId, sensor._id, sensor.type);
        }

        // 2. Add a new reading
        let baseVal = 50;
        if (sensor.type === 'moisture') baseVal = 42;
        else if (sensor.type === 'temperature') baseVal = 24;
        else if (sensor.type === 'humidity') baseVal = 62;
        else if (sensor.type === 'ph') baseVal = 6.4;

        // Get the latest reading to oscillate around it
        const latest = await SensorReading.findOne({ sensorId: sensor._id }).sort({ timestamp: -1 });
        const lastValue = latest ? latest.value : baseVal;
        
        // Minor fluctuation
        const change = (Math.random() * 2 - 1) * (sensor.type === 'ph' ? 0.1 : 1.5);
        const newValue = parseFloat(Math.max(1, Math.min(100, lastValue + change)).toFixed(1));
        
        await SensorReading.create({
          userId: sensor.userId,
          farmId: sensor.farmId,
          sensorId: sensor._id,
          value: newValue,
          timestamp: now
        });

        // 3. Update the farm's embedded sensorData fields
        const farm = await Farm.findById(sensor.farmId);
        if (farm) {
          if (!farm.sensorData) {
            farm.sensorData = {
              moisture: 42,
              pH: 6.4,
              temperature: 24,
              humidity: 62,
              predictedYield: 600,
              waterRecommendation: 'Wait 12 hours'
            };
          }
          if (sensor.type === 'moisture') farm.sensorData.moisture = newValue;
          else if (sensor.type === 'temperature') farm.sensorData.temperature = newValue;
          else if (sensor.type === 'humidity') farm.sensorData.humidity = newValue;
          else if (sensor.type === 'ph') farm.sensorData.pH = newValue;
          
          await farm.save();
        }
      }
    } catch (e: any) {
      console.error('Error in telemetry simulator loop:', e.message);
    }
  }, 300000);

  // Allow server exit clean
  interval.unref();
}
