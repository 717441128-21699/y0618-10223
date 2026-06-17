import type { DischargeDataPoint, DischargeResult, DischargeAnalysisResult } from '@/types';

export function calculateCapacity(
  data: DischargeDataPoint[],
  cycle: number,
  mass: number = 1
): { chargeCapacity: number; dischargeCapacity: number } {
  const cycleData = data.filter(d => d.cycle === cycle);
  
  const chargeSegments = getContinuousSegments(cycleData, 'charge');
  const dischargeSegments = getContinuousSegments(cycleData, 'discharge');
  
  const chargeCapacity = chargeSegments.reduce((sum, seg) => sum + integrateCapacity(seg), 0) / mass;
  const dischargeCapacity = dischargeSegments.reduce((sum, seg) => sum + integrateCapacity(seg), 0) / mass;
  
  return { chargeCapacity, dischargeCapacity };
}

function getContinuousSegments(
  data: DischargeDataPoint[],
  targetType: 'charge' | 'discharge'
): DischargeDataPoint[][] {
  const segments: DischargeDataPoint[][] = [];
  let currentSegment: DischargeDataPoint[] = [];
  
  for (const point of data) {
    if (point.type === targetType) {
      currentSegment.push(point);
    } else {
      if (currentSegment.length >= 2) {
        segments.push([...currentSegment]);
      }
      currentSegment = [];
    }
  }
  
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }
  
  return segments;
}

function integrateCapacity(data: DischargeDataPoint[]): number {
  if (data.length < 2) return 0;
  
  let capacity = 0;
  for (let i = 1; i < data.length; i++) {
    const dt = data[i].t - data[i - 1].t;
    if (dt <= 0) continue;
    const avgI = (Math.abs(data[i].I) + Math.abs(data[i - 1].I)) / 2;
    capacity += avgI * dt;
  }
  
  return capacity / 3600 * 1000;
}

export function calculateEnergyDensity(
  data: DischargeDataPoint[],
  cycle: number,
  mass: number = 1
): number {
  const cycleData = data.filter(d => d.cycle === cycle);
  const dischargeSegments = getContinuousSegments(cycleData, 'discharge');
  
  if (dischargeSegments.length === 0) return 0;
  
  let energy = 0;
  for (const segment of dischargeSegments) {
    for (let i = 1; i < segment.length; i++) {
      const dt = segment[i].t - segment[i - 1].t;
      if (dt <= 0) continue;
      const avgV = (segment[i].V + segment[i - 1].V) / 2;
      const avgI = (Math.abs(segment[i].I) + Math.abs(segment[i - 1].I)) / 2;
      energy += avgV * avgI * dt;
    }
  }
  
  return energy / 3600 / mass;
}

export function calculateCoulombicEfficiency(
  chargeCapacity: number,
  dischargeCapacity: number
): number {
  if (chargeCapacity === 0) return 0;
  return (dischargeCapacity / chargeCapacity) * 100;
}

export function analyzeDischarge(
  data: DischargeDataPoint[],
  mass: number = 1
): DischargeAnalysisResult {
  const cycles = [...new Set(data.map(d => d.cycle))].sort((a, b) => a - b);
  
  const results: DischargeResult[] = [];
  
  for (const cycle of cycles) {
    const { chargeCapacity, dischargeCapacity } = calculateCapacity(data, cycle, mass);
    const energyDensity = calculateEnergyDensity(data, cycle, mass);
    const coulombicEfficiency = calculateCoulombicEfficiency(chargeCapacity, dischargeCapacity);
    
    results.push({
      capacity: dischargeCapacity,
      energyDensity,
      coulombicEfficiency,
      cycleNumber: cycle,
      chargeCapacity,
      dischargeCapacity,
    });
  }
  
  const capacityRetention: number[] = [];
  if (results.length > 0) {
    const initialCapacity = results[0].capacity;
    for (const r of results) {
      capacityRetention.push(initialCapacity > 0 ? (r.capacity / initialCapacity) * 100 : 0);
    }
  }
  
  return {
    data,
    cycles: results,
    capacityRetention,
  };
}

export function getCycleData(
  data: DischargeDataPoint[],
  cycle: number,
  type: 'charge' | 'discharge' | 'both' = 'both'
): DischargeDataPoint[] {
  if (type === 'both') {
    return data.filter(d => d.cycle === cycle);
  }
  return data.filter(d => d.cycle === cycle && d.type === type);
}

export function getMidVoltage(data: DischargeDataPoint[], cycle: number, type: 'charge' | 'discharge'): number {
  const cycleData = data.filter(d => d.cycle === cycle && d.type === type);
  if (cycleData.length === 0) return 0;
  
  const voltages = cycleData.map(d => d.V);
  return (Math.max(...voltages) + Math.min(...voltages)) / 2;
}

export function calculateCapacityDecayRate(results: DischargeResult[]): number {
  if (results.length < 2) return 0;
  
  const first = results[0].capacity;
  const last = results[results.length - 1].capacity;
  const numCycles = results.length;
  
  if (first === 0) return 0;
  
  return ((first - last) / first) * 100 / numCycles;
}
