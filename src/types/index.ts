export interface CVDataPoint {
  E: number;
  I: number;
  cycle: number;
}

export interface CVPeak {
  type: 'anodic' | 'cathodic';
  Ep: number;
  Ip: number;
  area: number;
  cycle: number;
  index: number;
}

export interface CVAnalysisResult {
  peaks: CVPeak[];
  cycles: number[];
  data: CVDataPoint[];
}

export interface EISDataPoint {
  freq: number;
  Zreal: number;
  Zimag: number;
}

export type CircuitType = 'RCR' | 'RQR' | 'RQRW' | 'RQRQR';

export interface EISFitParams {
  Rs: number;
  Rct: number;
  Cdl: number;
  W?: number;
  n?: number;
  R2?: number;
  C2?: number;
  n2?: number;
  chiSq: number;
  residuals: number[];
  circuitType: CircuitType;
}

export interface EISAnalysisResult {
  data: EISDataPoint[];
  fitResult?: EISFitParams;
  fitData?: EISDataPoint[];
}

export interface DischargeDataPoint {
  t: number;
  V: number;
  I: number;
  cycle: number;
  type: 'charge' | 'discharge' | 'rest';
}

export interface DischargeResult {
  capacity: number;
  energyDensity: number;
  coulombicEfficiency: number;
  cycleNumber: number;
  chargeCapacity?: number;
  dischargeCapacity?: number;
}

export interface DischargeAnalysisResult {
  data: DischargeDataPoint[];
  cycles: DischargeResult[];
  capacityRetention: number[];
}

export type DataType = 'cv' | 'eis' | 'discharge';

export interface DataFile {
  id: string;
  name: string;
  type: DataType;
  rawContent: string;
  metadata?: {
    temperature?: number;
    concentration?: number;
    scanRate?: number;
    currentDensity?: number;
    mass?: number;
    label?: string;
  };
}

export interface CompareGroup {
  id: string;
  name: string;
  files: string[];
  variable: 'temperature' | 'concentration' | 'scanRate' | 'currentDensity' | 'custom';
  variableName: string;
}
