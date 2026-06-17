import type { EISDataPoint, EISFitParams, CircuitType } from '@/types';

function cpeImpedance(freq: number, Q: number, n: number): { re: number; im: number } {
  const omega = 2 * Math.PI * freq;
  const mag = 1 / (Q * Math.pow(omega, n));
  const angle = -n * Math.PI / 2;
  return {
    re: mag * Math.cos(angle),
    im: mag * Math.sin(angle),
  };
}

function warburgImpedance(freq: number, W: number): { re: number; im: number } {
  const omega = 2 * Math.PI * freq;
  const mag = W / Math.sqrt(omega);
  return {
    re: mag / Math.sqrt(2),
    im: -mag / Math.sqrt(2),
  };
}

export function circuitImpedance(freq: number, params: number[], circuitType: CircuitType): { re: number; im: number } {
  switch (circuitType) {
    case 'RCR': {
      const [Rs, Rct, Cdl] = params;
      const omega = 2 * Math.PI * freq;
      const Zc_re = 0;
      const Zc_im = -1 / (omega * Cdl);
      const Zrw_re = Rct;
      const Zrw_im = 0;
      
      const denom_re = Zc_re + Zrw_re;
      const denom_im = Zc_im + Zrw_im;
      const denom = denom_re * denom_re + denom_im * denom_im;
      
      const par_re = (Zc_re * Zrw_re - Zc_im * Zrw_im) / denom * (Zc_re + Zrw_re) + 
                     (Zc_im * Zrw_re + Zc_re * Zrw_im) / denom * (Zc_im + Zrw_im);
      const par_im = 0;
      
      const Zc = { re: 0, im: -1 / (omega * Cdl) };
      const Zr = { re: Rct, im: 0 };
      const parallel = complexDiv(complexMul(Zc, Zr), complexAdd(Zc, Zr));
      
      return {
        re: Rs + parallel.re,
        im: parallel.im,
      };
    }
    
    case 'RQR': {
      const [Rs, Rct, Q, n] = params;
      const Zq = cpeImpedance(freq, Q, n);
      const Zr = { re: Rct, im: 0 };
      const parallel = complexDiv(complexMul(Zq, Zr), complexAdd(Zq, Zr));
      return {
        re: Rs + parallel.re,
        im: parallel.im,
      };
    }
    
    case 'RQRW': {
      const [Rs, Rct, Q, n, W] = params;
      const Zq = cpeImpedance(freq, Q, n);
      const Zw = warburgImpedance(freq, W);
      const Zrw = complexAdd({ re: Rct, im: 0 }, Zw);
      const parallel = complexDiv(complexMul(Zq, Zrw), complexAdd(Zq, Zrw));
      return {
        re: Rs + parallel.re,
        im: parallel.im,
      };
    }
    
    case 'RQRQR': {
      const [Rs, R1, Q1, n1, R2, Q2, n2] = params;
      const Zq1 = cpeImpedance(freq, Q1, n1);
      const Z1 = complexDiv(complexMul(Zq1, { re: R1, im: 0 }), complexAdd(Zq1, { re: R1, im: 0 }));
      const Zq2 = cpeImpedance(freq, Q2, n2);
      const Z2 = complexDiv(complexMul(Zq2, { re: R2, im: 0 }), complexAdd(Zq2, { re: R2, im: 0 }));
      const series = complexAdd(Z1, Z2);
      return {
        re: Rs + series.re,
        im: series.im,
      };
    }
    
    default:
      return { re: 0, im: 0 };
  }
}

function complexAdd(a: { re: number; im: number }, b: { re: number; im: number }) {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexMul(a: { re: number; im: number }, b: { re: number; im: number }) {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexDiv(a: { re: number; im: number }, b: { re: number; im: number }) {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function getInitialParams(data: EISDataPoint[], circuitType: CircuitType): number[] {
  const Zreals = data.map(d => d.Zreal);
  const Zimags = data.map(d => d.Zimag);
  
  const minReal = Math.min(...Zreals);
  const maxReal = Math.max(...Zreals);
  const maxImag = Math.max(...Zimags);
  
  const Rs = minReal > 0 ? minReal * 0.9 : 1;
  const Rct = maxReal - minReal > 0 ? maxReal - minReal : 50;
  
  const midIdx = Math.floor(data.length / 2);
  const midFreq = data[midIdx]?.freq ?? 1000;
  const omega = 2 * Math.PI * midFreq;
  const Cdl = 1 / (omega * (Rct / 2)) * 0.5;
  
  switch (circuitType) {
    case 'RCR':
      return [Rs, Rct, Cdl];
    case 'RQR':
      return [Rs, Rct, Cdl, 0.9];
    case 'RQRW':
      return [Rs, Rct, Cdl, 0.85, Rct * 0.1];
    case 'RQRQR':
      return [Rs, Rct * 0.6, Cdl, 0.9, Rct * 0.4, Cdl * 0.1, 0.85];
    default:
      return [Rs, Rct, Cdl];
  }
}

export function fitEIS(
  data: EISDataPoint[],
  circuitType: CircuitType,
  maxIterations: number = 100
): EISFitParams {
  const params = getInitialParams(data, circuitType);
  const nParams = params.length;
  const nData = data.length;
  
  let lambda = 0.01;
  let chiSq = Infinity;
  const residuals: number[] = new Array(2 * nData);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const J: number[][] = [];
    const y: number[] = [];
    
    for (let i = 0; i < nData; i++) {
      const freq = data[i].freq;
      const Z = circuitImpedance(freq, params, circuitType);
      
      const weight = 1;
      residuals[2 * i] = (data[i].Zreal - Z.re) * weight;
      residuals[2 * i + 1] = (data[i].Zimag - Z.im) * weight;
      
      const delta = 1e-6;
      const jrowRe: number[] = [];
      const jrowIm: number[] = [];
      
      for (let j = 0; j < nParams; j++) {
        const paramsPerturb = [...params];
        paramsPerturb[j] += delta;
        const ZPerturb = circuitImpedance(freq, paramsPerturb, circuitType);
        
        jrowRe.push((ZPerturb.re - Z.re) / delta * weight);
        jrowIm.push((ZPerturb.im - Z.im) / delta * weight);
      }
      
      J.push(jrowRe);
      J.push(jrowIm);
      y.push((data[i].Zreal - Z.re) * weight);
      y.push((data[i].Zimag - Z.im) * weight);
    }
    
    const JTJ: number[][] = [];
    const JTy: number[] = [];
    
    for (let i = 0; i < nParams; i++) {
      JTJ[i] = [];
      JTy[i] = 0;
      for (let j = 0; j < nParams; j++) {
        JTJ[i][j] = 0;
        for (let k = 0; k < 2 * nData; k++) {
          JTJ[i][j] += J[k][i] * J[k][j];
        }
      }
      for (let k = 0; k < 2 * nData; k++) {
        JTy[i] += J[k][i] * y[k];
      }
    }
    
    const newChiSq = residuals.reduce((sum, r) => sum + r * r, 0) / (2 * nData - nParams);
    
    if (newChiSq < chiSq) {
      chiSq = newChiSq;
      lambda *= 0.1;
    } else {
      lambda *= 10;
      continue;
    }
    
    const A: number[][] = [];
    for (let i = 0; i < nParams; i++) {
      A[i] = [...JTJ[i]];
      A[i][i] += lambda * JTJ[i][i];
    }
    
    const delta = solveLinearSystem(A, JTy);
    if (!delta) break;
    
    const newParams = params.map((p, i) => p + delta[i]);
    
    if (newParams.some(p => p < 0)) {
      lambda *= 10;
      continue;
    }
    
    for (let i = 0; i < nParams; i++) {
      params[i] = newParams[i];
    }
    
    if (Math.abs(delta.reduce((s, d) => s + Math.abs(d), 0)) < 1e-10) {
      break;
    }
  }
  
  const result: EISFitParams = {
    Rs: params[0],
    Rct: params[1],
    Cdl: params[2],
    chiSq,
    residuals: [...residuals],
    circuitType,
  };
  
  if (circuitType === 'RQR' || circuitType === 'RQRW') {
    result.n = params[3];
  }
  if (circuitType === 'RQRW') {
    result.W = params[4];
  }
  if (circuitType === 'RQRQR') {
    result.n = params[3];
    result.R2 = params[4];
    result.C2 = params[5];
    result.n2 = params[6];
  }
  
  return result;
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);
  
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    
    if (Math.abs(aug[i][i]) < 1e-15) return null;
    
    for (let k = i + 1; k < n; k++) {
      const factor = aug[k][i] / aug[i][i];
      for (let j = i; j <= n; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }
  
  const x: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  
  return x;
}

export function generateFitData(
  params: EISFitParams,
  freqs: number[]
): EISDataPoint[] {
  return freqs.map(freq => {
    let paramArray: number[];
    
    switch (params.circuitType) {
      case 'RCR':
        paramArray = [params.Rs, params.Rct, params.Cdl];
        break;
      case 'RQR':
        paramArray = [params.Rs, params.Rct, params.Cdl, params.n ?? 0.9];
        break;
      case 'RQRW':
        paramArray = [params.Rs, params.Rct, params.Cdl, params.n ?? 0.85, params.W ?? 0];
        break;
      case 'RQRQR':
        paramArray = [params.Rs, params.Rct, params.Cdl, params.n ?? 0.9, params.R2 ?? 0, params.C2 ?? 0, params.n2 ?? 0.85];
        break;
      default:
        paramArray = [params.Rs, params.Rct, params.Cdl];
    }
    
    const Z = circuitImpedance(freq, paramArray, params.circuitType);
    return {
      freq,
      Zreal: Z.re,
      Zimag: Z.im,
    };
  });
}

export const circuitLabels: Record<CircuitType, string> = {
  'RCR': 'R(CR) - 简单RC电路',
  'RQR': 'R(QR) - 常相位元件模型',
  'RQRW': 'R(Q(RW)) - Warburg扩散模型',
  'RQRQR': 'R(Q(R(QR))) - 双时间常数模型',
};
