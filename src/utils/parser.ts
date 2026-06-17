import type { CVDataPoint, EISDataPoint, DischargeDataPoint, DataType } from '@/types';

export function parseCSV(content: string): Record<string, number>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseLine(lines[0]);
  const result: Record<string, number>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const row: Record<string, number> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = parseFloat(values[j]);
      if (!isNaN(val)) {
        row[headers[j]] = val;
      }
    }
    result.push(row);
  }
  
  return result;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function detectDataType(headers: string[]): DataType | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  const hasE = lowerHeaders.some(h => h.includes('e/') || h.includes('potential') || h.includes('电位'));
  const hasI = lowerHeaders.some(h => h.includes('i/') || h.includes('current') || h.includes('电流'));
  const hasFreq = lowerHeaders.some(h => h.includes('freq') || h.includes('频率'));
  const hasZreal = lowerHeaders.some(h => h.includes("z'") || h.includes('z_real') || h.includes('实部'));
  const hasZimag = lowerHeaders.some(h => h.includes("z''") || h.includes('z_imag') || h.includes('虚部'));
  const hasTime = lowerHeaders.some(h => h.includes('time') || h.includes('时间') || h.includes('t/'));
  const hasV = lowerHeaders.some(h => h.includes('voltage') || h.includes('v/') || h.includes('电压'));
  
  if (hasFreq && (hasZreal || hasZimag)) {
    return 'eis';
  }
  if (hasE && hasI) {
    return 'cv';
  }
  if (hasTime && hasV && hasI) {
    return 'discharge';
  }
  
  return null;
}

export function parseCVData(rows: Record<string, number>[]): CVDataPoint[] {
  const result: CVDataPoint[] = [];
  const keys = Object.keys(rows[0] || {});
  
  const eKey = keys.find(k => k.toLowerCase().includes('e/') || k.toLowerCase().includes('potential') || k.toLowerCase() === 'e');
  const iKey = keys.find(k => k.toLowerCase().includes('i/') || k.toLowerCase().includes('current') || k.toLowerCase() === 'i');
  const cycleKey = keys.find(k => k.toLowerCase().includes('cycle') || k.toLowerCase().includes('循环'));
  
  if (!eKey || !iKey) return result;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.push({
      E: row[eKey] ?? 0,
      I: row[iKey] ?? 0,
      cycle: cycleKey ? (row[cycleKey] ?? 1) : 1,
    });
  }
  
  return result;
}

export function parseEISData(rows: Record<string, number>[]): EISDataPoint[] {
  const result: EISDataPoint[] = [];
  const keys = Object.keys(rows[0] || {});
  
  const freqKey = keys.find(k => k.toLowerCase().includes('freq'));
  const zrealKey = keys.find(k => k.toLowerCase().includes("z'") || k.toLowerCase().includes('z_real') || k.toLowerCase().includes('real'));
  const zimagKey = keys.find(k => k.toLowerCase().includes("z''") || k.toLowerCase().includes('z_imag') || k.toLowerCase().includes('imag'));
  
  if (!freqKey || !zrealKey || !zimagKey) return result;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.push({
      freq: row[freqKey] ?? 0,
      Zreal: row[zrealKey] ?? 0,
      Zimag: row[zimagKey] ?? 0,
    });
  }
  
  return result;
}

export function parseDischargeData(rows: Record<string, number>[]): DischargeDataPoint[] {
  const result: DischargeDataPoint[] = [];
  const keys = Object.keys(rows[0] || {});
  
  const tKey = keys.find(k => k.toLowerCase().includes('time') || k.toLowerCase().includes('t/') || k.toLowerCase() === 't');
  const vKey = keys.find(k => k.toLowerCase().includes('voltage') || k.toLowerCase().includes('v/') || k.toLowerCase() === 'v');
  const iKey = keys.find(k => k.toLowerCase().includes('current') || k.toLowerCase().includes('i/') || k.toLowerCase() === 'i');
  const cycleKey = keys.find(k => k.toLowerCase().includes('cycle') || k.toLowerCase().includes('循环'));
  const typeKey = keys.find(k => k.toLowerCase().includes('type') || k.toLowerCase().includes('类型'));
  
  if (!tKey || !vKey || !iKey) return result;
  
  let prevV = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const V = row[vKey] ?? 0;
    const I = row[iKey] ?? 0;
    
    let type: 'charge' | 'discharge' = 'discharge';
    if (typeKey) {
      const t = (row[typeKey] as unknown as string)?.toString().toLowerCase();
      type = t === 'charge' || t === '充电' ? 'charge' : 'discharge';
    } else if (i > 0) {
      if (V > prevV) type = 'charge';
      else if (V < prevV) type = 'discharge';
    }
    
    result.push({
      t: row[tKey] ?? 0,
      V,
      I,
      cycle: cycleKey ? (row[cycleKey] ?? 1) : 1,
      type,
    });
    
    prevV = V;
  }
  
  return result;
}
