import type { CVDataPoint, EISDataPoint, DischargeDataPoint } from '@/types';

function generateCVData(scanRate: number, cycles: number, shift: number = 0): CVDataPoint[] {
  const data: CVDataPoint[] = [];
  const E_start = -0.5 + shift;
  const E_end = 1.0 + shift;
  const pointsPerCycle = 200;
  
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const decay = 1 - (cycle - 1) * 0.05;
    
    for (let i = 0; i < pointsPerCycle; i++) {
      const frac = i / (pointsPerCycle - 1);
      const E = E_start + (E_end - E_start) * frac;
      const I = calculateCVI(E, scanRate, decay, shift);
      data.push({ E, I, cycle });
    }
    
    for (let i = 0; i < pointsPerCycle; i++) {
      const frac = i / (pointsPerCycle - 1);
      const E = E_end - (E_end - E_start) * frac;
      const I = calculateCVI(E, scanRate, decay, shift);
      data.push({ E, I, cycle });
    }
  }
  
  return data;
}

function calculateCVI(E: number, scanRate: number, decay: number, shift: number): number {
  const baseCurrent = 0;
  const E0 = 0.4 + shift;
  const peakHeight = 50e-6 * Math.sqrt(scanRate / 0.05) * decay;
  const peakWidth = 0.08;
  
  const anodicPeak = peakHeight * Math.exp(-Math.pow((E - E0 - 0.03), 2) / (2 * peakWidth * peakWidth));
  const cathodicPeak = -peakHeight * 0.95 * Math.exp(-Math.pow((E - E0 + 0.03), 2) / (2 * peakWidth * peakWidth));
  const doubleLayer = (E - 0.2) * 2e-6;
  
  return baseCurrent + anodicPeak + cathodicPeak + doubleLayer;
}

function generateEISData(Rs: number, Rct: number, Cdl: number, W: number = 0, n: number = 1): EISDataPoint[] {
  const data: EISDataPoint[] = [];
  const freqStart = 1e5;
  const freqEnd = 0.01;
  const points = 50;
  
  for (let i = 0; i < points; i++) {
    const freq = freqStart * Math.pow(freqEnd / freqStart, i / (points - 1));
    const omega = 2 * Math.PI * freq;
    
    let Zc_re: number, Zc_im: number;
    if (n === 1) {
      const Zc_mag = 1 / (omega * Cdl);
      Zc_re = 0;
      Zc_im = -Zc_mag;
    } else {
      const Zc_mag = 1 / (Cdl * Math.pow(omega, n));
      const Zc_angle = -n * Math.PI / 2;
      Zc_re = Zc_mag * Math.cos(Zc_angle);
      Zc_im = Zc_mag * Math.sin(Zc_angle);
    }
    
    let Zrw_re = Rct;
    let Zrw_im = 0;
    if (W > 0) {
      const W_mag = W / Math.sqrt(omega);
      Zrw_re += W_mag / Math.sqrt(2);
      Zrw_im += -W_mag / Math.sqrt(2);
    }
    
    const denom_re = Zc_re + Zrw_re;
    const denom_im = Zc_im + Zrw_im;
    const denom = denom_re * denom_re + denom_im * denom_im;
    
    const num_re = Zc_re * Zrw_re - Zc_im * Zrw_im;
    const num_im = Zc_im * Zrw_re + Zc_re * Zrw_im;
    
    const Zpar_re = (num_re * denom_re + num_im * denom_im) / denom;
    const Zpar_im = (num_im * denom_re - num_re * denom_im) / denom;
    
    data.push({
      freq,
      Zreal: Rs + Zpar_re,
      Zimag: -Zpar_im,
    });
  }
  
  return data;
}

function generateDischargeData(cycles: number, capacityDecay: number = 0.005): DischargeDataPoint[] {
  const data: DischargeDataPoint[] = [];
  const current = 0.1;
  const voltageHigh = 4.2;
  const voltageLow = 3.0;
  const baseCapacity = 150;
  
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const capacityFactor = 1 - (cycle - 1) * capacityDecay;
    const dischargeCapacity = baseCapacity * capacityFactor;
    const chargeCapacity = dischargeCapacity / (0.99 - cycle * 0.001);
    
    const chargeTime = chargeCapacity * 3.6 / current;
    const dischargeTime = dischargeCapacity * 3.6 / current;
    
    const chargePoints = 50;
    for (let i = 0; i <= chargePoints; i++) {
      const t = (i / chargePoints) * chargeTime;
      const soc = i / chargePoints;
      const V = voltageLow + (voltageHigh - voltageLow) * (1 - Math.exp(-soc * 3)) + 0.1 * (1 - soc);
      data.push({ t, V, I: current, cycle, type: 'charge' });
    }
    
    const dischargePoints = 50;
    for (let i = 0; i <= dischargePoints; i++) {
      const t = chargeTime + (i / dischargePoints) * dischargeTime;
      const dod = i / dischargePoints;
      const V = voltageHigh - (voltageHigh - voltageLow) * (1 - Math.exp(-dod * 3)) - 0.1 * dod;
      data.push({ t, V, I: -current, cycle, type: 'discharge' });
    }
  }
  
  return data;
}

export function generateDischargeWithPlateaus(cycles: number = 2): DischargeDataPoint[] {
  const data: DischargeDataPoint[] = [];
  const current = 0.1;
  const voltageHigh = 4.2;
  const voltagePlateau = 3.7;
  const voltageLow = 3.0;
  const baseCapacity = 150;
  let t = 0;
  
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const capacityFactor = 1 - (cycle - 1) * 0.005;
    const dischargeCapacity = baseCapacity * capacityFactor;
    const chargeCapacity = dischargeCapacity / 0.98;
    
    const chargeTime = chargeCapacity * 3.6 / current;
    const dischargeTime = dischargeCapacity * 3.6 / current;
    
    for (let i = 0; i <= 20; i++) {
      const soc = i / 20;
      const V = voltageLow + (4.1 - voltageLow) * (1 - Math.exp(-soc * 5));
      data.push({ t, V, I: current, cycle, type: 'charge' });
      t += (chargeTime * 0.3) / 20;
    }
    
    for (let i = 0; i <= 30; i++) {
      const soc = 0.3 + i / 30 * 0.7;
      const V = 4.1 + (voltageHigh - 4.1) * (1 - Math.exp(-(soc - 0.3) * 4));
      data.push({ t, V, I: current, cycle, type: 'charge' });
      t += (chargeTime * 0.7) / 30;
    }
    
    for (let i = 0; i <= 20; i++) {
      data.push({ t, V: voltageHigh - 0.02 + Math.random() * 0.002, I: 0, cycle, type: 'rest' });
      t += 600 / 20;
    }
    
    for (let i = 0; i <= 15; i++) {
      const dod = i / 15;
      const V = voltageHigh - (voltageHigh - voltagePlateau) * (1 - Math.exp(-dod * 4));
      data.push({ t, V, I: -current, cycle, type: 'discharge' });
      t += (dischargeTime * 0.15) / 15;
    }
    
    for (let i = 0; i <= 60; i++) {
      const dod = 0.15 + i / 60 * 0.75;
      const V = voltagePlateau + Math.sin(i * 0.1) * 0.003 - 0.0001 * i;
      data.push({ t, V, I: -current, cycle, type: 'discharge' });
      t += (dischargeTime * 0.75) / 60;
    }
    
    for (let i = 0; i <= 15; i++) {
      const dod = 0.9 + i / 15 * 0.1;
      const V = voltagePlateau - 0.05 - (voltagePlateau - 0.05 - voltageLow) * (1 - Math.exp(-(dod - 0.9) * 4));
      data.push({ t, V, I: -current, cycle, type: 'discharge' });
      t += (dischargeTime * 0.1) / 15;
    }
    
    for (let i = 0; i <= 15; i++) {
      data.push({ t, V: voltageLow + 0.08 + Math.random() * 0.002, I: 0, cycle, type: 'rest' });
      t += 300 / 15;
    }
  }
  
  return data;
}

export const sampleCVData = {
  'CV_50mV_slow': generateCVData(0.05, 3),
  'CV_100mV_fast': generateCVData(0.1, 3),
  'CV_sample': generateCVData(0.05, 5),
  'CV_low_conc': generateCVData(0.05, 3, -0.1),
  'CV_high_conc': generateCVData(0.05, 3, 0.1),
  'CV_25C': generateCVData(0.05, 3, 0),
  'CV_45C': generateCVData(0.05, 3, 0.05),
  'CV_25C_low': generateCVData(0.05, 3, -0.1),
  'CV_25C_high': generateCVData(0.05, 3, 0.05),
  'CV_45C_low': generateCVData(0.05, 3, -0.05),
  'CV_45C_high': generateCVData(0.05, 3, 0.1),
};

export const sampleEISData = {
  'EIS_simple': generateEISData(10, 100, 1e-5),
  'EIS_CPE': generateEISData(10, 100, 1e-5, 0, 0.85),
  'EIS_Warburg': generateEISData(10, 100, 1e-5, 20, 1),
  'EIS_full': generateEISData(10, 100, 1e-5, 20, 0.85),
  'EIS_low_conc': generateEISData(15, 150, 8e-6, 25, 0.8),
  'EIS_high_conc': generateEISData(8, 60, 1.2e-5, 15, 0.9),
  'EIS_25C': generateEISData(10, 100, 1e-5, 20, 0.85),
  'EIS_45C': generateEISData(8, 60, 1.2e-5, 15, 0.9),
};

export const sampleDischargeData = {
  'Discharge_sample': generateDischargeData(50),
  'Discharge_fast': generateDischargeData(30, 0.01),
  'Discharge_slow': generateDischargeData(100, 0.002),
  'Discharge_25C': generateDischargeData(50, 0.005),
  'Discharge_45C': generateDischargeData(50, 0.008),
  'Discharge_low_conc': generateDischargeData(50, 0.007),
  'Discharge_high_conc': generateDischargeData(50, 0.003),
  'Discharge_plateau': generateDischargeWithPlateaus(2),
};

export function cvDataToCSV(data: CVDataPoint[]): string {
  let csv = 'E/V,I/A,Cycle\n';
  for (const point of data) {
    csv += `${point.E},${point.I},${point.cycle}\n`;
  }
  return csv;
}

export function eisDataToCSV(data: EISDataPoint[]): string {
  let csv = 'Frequency/Hz,Z_real/Ohm,Z_imag/Ohm\n';
  for (const point of data) {
    csv += `${point.freq},${point.Zreal},${point.Zimag}\n`;
  }
  return csv;
}

export function dischargeDataToCSV(data: DischargeDataPoint[]): string {
  let csv = 'Time/s,Voltage/V,Current/A,Cycle,Type\n';
  for (const point of data) {
    csv += `${point.t},${point.V},${point.I},${point.cycle},${point.type}\n`;
  }
  return csv;
}
