import type { CVDataPoint, CVPeak, CVAnalysisResult } from '@/types';

export function findPeaks(data: CVDataPoint[], minProminence: number = 0.1): CVPeak[] {
  const peaks: CVPeak[] = [];
  const cycles = [...new Set(data.map(d => d.cycle))];
  
  for (const cycle of cycles) {
    const cycleData = data.filter(d => d.cycle === cycle);
    if (cycleData.length < 10) continue;
    
    const sortedData = [...cycleData].sort((a, b) => a.E - b.E);
    const I = sortedData.map(d => d.I);
    const E = sortedData.map(d => d.E);
    
    const anodicPeak = findPeakInArray(I, E, 'anodic', minProminence);
    if (anodicPeak) {
      peaks.push({ ...anodicPeak, cycle });
    }
    
    const cathodicPeak = findPeakInArray(I, E, 'cathodic', minProminence);
    if (cathodicPeak) {
      peaks.push({ ...cathodicPeak, cycle });
    }
  }
  
  return peaks;
}

function findPeakInArray(
  I: number[],
  E: number[],
  type: 'anodic' | 'cathodic',
  minProminence: number
): Omit<CVPeak, 'cycle'> | null {
  const n = I.length;
  if (n < 5) return null;
  
  const target = type === 'anodic' ? Math.max(...I) : Math.min(...I);
  const targetIdx = type === 'anodic' ? I.indexOf(target) : I.indexOf(target);
  
  if (targetIdx < 2 || targetIdx > n - 3) return null;
  
  let leftBase = targetIdx;
  while (leftBase > 0) {
    if (type === 'anodic' ? I[leftBase - 1] > I[leftBase] : I[leftBase - 1] < I[leftBase]) {
      break;
    }
    leftBase--;
  }
  
  let rightBase = targetIdx;
  while (rightBase < n - 1) {
    if (type === 'anodic' ? I[rightBase + 1] > I[rightBase] : I[rightBase + 1] < I[rightBase]) {
      break;
    }
    rightBase++;
  }
  
  const leftVal = I[leftBase];
  const rightVal = I[rightBase];
  const base = (leftVal + rightVal) / 2;
  const prominence = Math.abs(target - base);
  
  const Imax = Math.max(...I.map(v => Math.abs(v)));
  if (prominence < minProminence * Imax) return null;
  
  let area = 0;
  for (let i = leftBase; i < rightBase; i++) {
    const dE = E[i + 1] - E[i];
    const avgI = ((I[i] - base) + (I[i + 1] - base)) / 2;
    area += avgI * dE;
  }
  
  return {
    type,
    Ep: E[targetIdx],
    Ip: target,
    area: Math.abs(area),
    index: targetIdx,
  };
}

export function getCycles(data: CVDataPoint[]): number[] {
  return [...new Set(data.map(d => d.cycle))].sort((a, b) => a - b);
}

export function getDataByCycle(data: CVDataPoint[], cycle: number): CVDataPoint[] {
  return data.filter(d => d.cycle === cycle);
}

export function analyzeCV(data: CVDataPoint[]): CVAnalysisResult {
  const peaks = findPeaks(data);
  const cycles = getCycles(data);
  
  return {
    peaks,
    cycles,
    data,
  };
}

export function calculatePeakSeparation(peaks: CVPeak[], cycle: number): number | null {
  const cyclePeaks = peaks.filter(p => p.cycle === cycle);
  const anodic = cyclePeaks.find(p => p.type === 'anodic');
  const cathodic = cyclePeaks.find(p => p.type === 'cathodic');
  
  if (anodic && cathodic) {
    return anodic.Ep - cathodic.Ep;
  }
  return null;
}

export function peakRatio(peaks: CVPeak[], cycle: number): number | null {
  const cyclePeaks = peaks.filter(p => p.cycle === cycle);
  const anodic = cyclePeaks.find(p => p.type === 'anodic');
  const cathodic = cyclePeaks.find(p => p.type === 'cathodic');
  
  if (anodic && cathodic) {
    return Math.abs(anodic.Ip / cathodic.Ip);
  }
  return null;
}
