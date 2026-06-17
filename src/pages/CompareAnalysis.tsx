import { useState, useMemo } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { GitCompare, Plus, Trash2, Settings, Edit2, X, Download, FileText } from 'lucide-react';
import ChartWrapper, { chartColors, defaultChartOptions } from '@/components/ChartWrapper';
import { FileList } from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import ParamCard, { ParamGrid } from '@/components/ParamCard';
import { useDataStore } from '@/store/useDataStore';
import { parseCSV, parseCVData, parseEISData, parseDischargeData } from '@/utils/parser';
import { analyzeCV } from '@/utils/cvAnalysis';
import { fitEIS } from '@/utils/eisFitting';
import { analyzeDischarge } from '@/utils/dischargeAnalysis';
import type { DataType, CompareGroup, DataFile } from '@/types';

export default function CompareAnalysis() {
  const files = useDataStore((s) => s.files);
  const compareGroups = useDataStore((s) => s.compareGroups);
  const activeCompareGroupId = useDataStore((s) => s.activeCompareGroupId);
  const addCompareGroup = useDataStore((s) => s.addCompareGroup);
  const removeCompareGroup = useDataStore((s) => s.removeCompareGroup);
  const setActiveCompareGroup = useDataStore((s) => s.setActiveCompareGroup);
  const updateCompareGroup = useDataStore((s) => s.updateCompareGroup);
  const updateFileMetadata = useDataStore((s) => s.updateFileMetadata);
  
  const [dataType, setDataType] = useState<DataType>('cv');
  const [variableName, setVariableName] = useState('温度');
  const [variableType, setVariableType] = useState<'temperature' | 'concentration' | 'scanRate' | 'currentDensity' | 'custom'>('temperature');
  const [variableUnit, setVariableUnit] = useState('°C');
  
  const [editingFile, setEditingFile] = useState<DataFile | null>(null);
  const [editForm, setEditForm] = useState({
    label: '',
    temperature: '',
    concentration: '',
    scanRate: '',
    currentDensity: '',
  });
  const [selectedCVRange, setSelectedCVRange] = useState<'first' | 'last' | 'all' | 'custom'>('first');
  const [selectedCVCycles, setSelectedCVCycles] = useState<number[]>([1]);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const activeGroup = useMemo(
    () => compareGroups.find((g) => g.id === activeCompareGroupId),
    [compareGroups, activeCompareGroupId]
  );
  
  const filteredFiles = useMemo(
    () => files.filter((f) => f.type === dataType),
    [files, dataType]
  );
  
  const analysisResults = useMemo(() => {
    if (!activeGroup) return [];
    
    return activeGroup.files
      .map((fileId) => {
        const file = files.find((f) => f.id === fileId);
        if (!file) return null;
        
        const rows = parseCSV(file.rawContent);
        const label = file.metadata?.label || file.name.replace(/\.(csv|txt)$/i, '');
        
        if (dataType === 'cv') {
          const data = parseCVData(rows);
          if (data.length === 0) return null;
          const result = analyzeCV(data);
          const firstCyclePeaks = result.peaks.filter((p) => p.cycle === 1);
          const anodicPeak = firstCyclePeaks.find((p) => p.type === 'anodic');
          const cathodicPeak = firstCyclePeaks.find((p) => p.type === 'cathodic');
          
          return {
            fileId,
            label,
            metadata: file.metadata,
            data: result,
            params: {
              anodicIp: anodicPeak ? anodicPeak.Ip : 0,
              cathodicIp: cathodicPeak ? cathodicPeak.Ip : 0,
              deltaEp: anodicPeak && cathodicPeak ? anodicPeak.Ep - cathodicPeak.Ep : 0,
            },
          };
        }
        
        if (dataType === 'eis') {
          const data = parseEISData(rows);
          if (data.length === 0) return null;
          const fit = fitEIS(data, 'RQRW');
          
          return {
            fileId,
            label,
            metadata: file.metadata,
            data: { eisData: data, fit },
            params: {
              Rs: fit.Rs,
              Rct: fit.Rct,
              Cdl: fit.Cdl,
              chiSq: fit.chiSq,
            },
          };
        }
        
        if (dataType === 'discharge') {
          const data = parseDischargeData(rows);
          if (data.length === 0) return null;
          const result = analyzeDischarge(data, 1);
          const firstCycle = result.cycles[0];
          const lastCycle = result.cycles[result.cycles.length - 1];
          
          return {
            fileId,
            label,
            metadata: file.metadata,
            data: result,
            params: {
              initialCapacity: firstCycle?.capacity || 0,
              finalCapacity: lastCycle?.capacity || 0,
              capacityRetention: result.capacityRetention[result.capacityRetention.length - 1] || 0,
              avgEfficiency: result.cycles.reduce((s, c) => s + c.coulombicEfficiency, 0) / result.cycles.length,
            },
          };
        }
        
        return null;
      })
      .filter(Boolean);
  }, [activeGroup, files, dataType]);
  
  const createGroup = () => {
    const newGroup: CompareGroup = {
      id: `group-${Date.now()}`,
      name: `对比组 ${compareGroups.length + 1}`,
      files: [],
      variable: variableType,
      variableName,
    };
    addCompareGroup(newGroup);
  };
  
  const addFileToGroup = (fileId: string) => {
    if (!activeGroup) return;
    if (activeGroup.files.includes(fileId)) return;
    
    updateCompareGroup(activeGroup.id, {
      files: [...activeGroup.files, fileId],
    });
  };
  
  const removeFileFromGroup = (fileId: string) => {
    if (!activeGroup) return;
    
    updateCompareGroup(activeGroup.id, {
      files: activeGroup.files.filter((f) => f !== fileId),
    });
  };
  
  const openEditModal = (file: DataFile) => {
    setEditingFile(file);
    setEditForm({
      label: file.metadata?.label || file.name.replace(/\.(csv|txt)$/i, ''),
      temperature: file.metadata?.temperature !== undefined ? String(file.metadata.temperature) : '',
      concentration: file.metadata?.concentration !== undefined ? String(file.metadata.concentration) : '',
      scanRate: file.metadata?.scanRate !== undefined ? String(file.metadata.scanRate) : '',
      currentDensity: file.metadata?.currentDensity !== undefined ? String(file.metadata.currentDensity) : '',
    });
  };
  
  const closeEditModal = () => {
    setEditingFile(null);
  };
  
  const saveEdit = () => {
    if (!editingFile) return;
    
    const metadata: Record<string, any> = {
      label: editForm.label || editingFile.name,
    };
    
    if (editForm.temperature !== '') {
      metadata.temperature = parseFloat(editForm.temperature);
    }
    if (editForm.concentration !== '') {
      metadata.concentration = parseFloat(editForm.concentration);
    }
    if (editForm.scanRate !== '') {
      metadata.scanRate = parseFloat(editForm.scanRate);
    }
    if (editForm.currentDensity !== '') {
      metadata.currentDensity = parseFloat(editForm.currentDensity);
    }
    
    updateFileMetadata(editingFile.id, metadata);
    setEditingFile(null);
  };
  
  const exportCSVReport = () => {
    if (!activeGroup || analysisResults.length === 0) return;
    
    let csv = '';
    csv += `对比分析报告 - ${dataType === 'cv' ? 'CV循环伏安' : dataType === 'eis' ? 'EIS阻抗谱' : '充放电'}\n`;
    csv += `生成时间,${new Date().toLocaleString('zh-CN')}\n\n`;
    
    if (dataType === 'cv') {
      csv += '样品名称,条件,温度,浓度,氧化峰电流(μA),还原峰电流(μA),峰电位差(mV)\n';
      compareTableData.forEach((row: any) => {
        csv += `${row.name},${row.condition},${row.temperature},${row.concentration},${row.param1},${row.param2},${row.param3}\n`;
      });
    } else if (dataType === 'eis') {
      csv += '样品名称,条件,温度,浓度,溶液电阻Rs(Ω),电荷转移电阻Rct(Ω),双电层电容Cdl(μF)\n';
      compareTableData.forEach((row: any) => {
        csv += `${row.name},${row.condition},${row.temperature},${row.concentration},${row.param1},${row.param2},${row.param3}\n`;
      });
    } else if (dataType === 'discharge') {
      csv += '样品名称,条件,温度,浓度,初始容量(mAh/g),容量保持率(%),平均库仑效率(%)\n';
      compareTableData.forEach((row: any) => {
        csv += `${row.name},${row.condition},${row.temperature},${row.concentration},${row.param1},${row.param2},${row.param3}\n`;
      });
    }
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `对比分析报告_${dataType}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };
  
  const exportHTMLReport = () => {
    if (!activeGroup || analysisResults.length === 0) return;
    
    const typeLabel = dataType === 'cv' ? 'CV循环伏安' : dataType === 'eis' ? 'EIS阻抗谱' : '充放电';
    const dateStr = new Date().toLocaleString('zh-CN');
    
    const canvases = document.querySelectorAll('canvas');
    const images: { title: string; src: string }[] = [];
    canvases.forEach((canvas) => {
      try {
        const src = canvas.toDataURL('image/png');
        const wrapper = canvas.closest('.bg-white');
        const titleEl = wrapper?.querySelector('h3');
        const title = titleEl?.textContent || '图表';
        images.push({ title, src });
      } catch (e) {
        // skip
      }
    });
    
    let tableRows = '';
    compareTableData.forEach((row: any) => {
      tableRows += `
        <tr>
          <td>${row.name}</td>
          <td>${row.condition}</td>
          <td>${row.temperature}</td>
          <td>${row.concentration}</td>
          <td style="text-align:right">${row.param1}</td>
          <td style="text-align:right">${row.param2}</td>
          <td style="text-align:right">${row.param3}</td>
        </tr>`;
    });
    
    let param1Label = '参数1';
    let param2Label = '参数2';
    let param3Label = '参数3';
    
    if (dataType === 'cv') {
      param1Label = '氧化峰电流';
      param2Label = '还原峰电流';
      param3Label = '峰电位差';
    } else if (dataType === 'eis') {
      param1Label = '溶液电阻 Rs';
      param2Label = '电荷转移电阻 Rct';
      param3Label = '双电层电容 Cdl';
    } else if (dataType === 'discharge') {
      param1Label = '初始容量';
      param2Label = '容量保持率';
      param3Label = '平均库仑效率';
    }
    
    const imagesHtml = images.length > 0
      ? images.map(img => `
        <div class="chart-card">
          <h2 class="chart-title">${img.title}</h2>
          <img src="${img.src}" alt="${img.title}" class="chart-img" />
        </div>`).join('')
      : '<p style="color:#94a3b8;text-align:center;padding:40px;">暂无图表数据</p>';
    
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>对比分析报告 - ${typeLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .container { max-width: 960px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 32px 40px; }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 40px; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; font-size: 14px; color: #475569; }
    td { font-size: 14px; color: #334155; }
    tr:hover td { background: #f8fafc; }
    .chart-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .chart-title { font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
    .chart-img { width: 100%; max-width: 100%; height: auto; display: block; }
    .footer { text-align: center; padding: 20px 40px; background: #f8fafc; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔬 对比分析报告</h1>
      <p>${typeLabel} · 共 ${analysisResults.filter((r: any) => r).length} 个样品 · ${dateStr}</p>
    </div>
    <div class="content">
      <div class="section">
        <h2>📊 参数对比表</h2>
        <table>
          <thead>
            <tr>
              <th>样品名称</th>
              <th>条件</th>
              <th>温度</th>
              <th>浓度</th>
              <th style="text-align:right">${param1Label}</th>
              <th style="text-align:right">${param2Label}</th>
              <th style="text-align:right">${param3Label}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <div class="section">
        <h2>📈 关键图表</h2>
        ${imagesHtml}
      </div>
    </div>
    <div class="footer">
      电化学数据分析系统 · 自动生成报告
    </div>
  </div>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `对比分析报告_${dataType}_${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
  };
  
  const cvChartData = useMemo(() => {
    if (!activeGroup || dataType !== 'cv') return null;
    
    const datasets: any[] = [];
    
    analysisResults.forEach((result: any, idx: number) => {
      if (!result) return;
      const color = chartColors[idx % chartColors.length];
      
      let cyclesToShow: number[];
      const rawCycles = result.data.data.map((d: any) => d.cycle) as number[];
      const allCycles = [...new Set(rawCycles)].sort((a, b) => a - b);
      
      if (selectedCVRange === 'first') {
        cyclesToShow = [allCycles[0]];
      } else if (selectedCVRange === 'last') {
        cyclesToShow = [allCycles[allCycles.length - 1]];
      } else if (selectedCVRange === 'all') {
        cyclesToShow = allCycles;
      } else {
        cyclesToShow = selectedCVCycles.filter((c) => allCycles.includes(c));
        if (cyclesToShow.length === 0) cyclesToShow = [allCycles[0]];
      }
      
      cyclesToShow.forEach((cycleNum, cycleIdx) => {
        const cycleData = result.data.data.filter((d: any) => d.cycle === cycleNum);
        const label = cyclesToShow.length > 1
          ? `${result.label} 第${cycleNum}圈`
          : result.label;
        
        const borderColor = cyclesToShow.length > 1
          ? chartColors[(idx * 3 + cycleIdx) % chartColors.length].border
          : color.border;
        
        datasets.push({
          label,
          data: cycleData.map((d: any) => ({ x: d.E, y: d.I })),
          borderColor,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          showLine: true,
        });
      });
    });
    
    return { datasets };
  }, [activeGroup, analysisResults, dataType, selectedCVRange, selectedCVCycles]);
  
  const capacityCompareData = useMemo(() => {
    if (!activeGroup || dataType !== 'discharge') return null;
    
    const datasets: any[] = [];
    
    analysisResults.forEach((result: any, idx: number) => {
      if (!result) return;
      const color = chartColors[idx % chartColors.length];
      
      datasets.push({
        label: result.label,
        data: result.data.capacityRetention,
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        fill: false,
      });
    });
    
    return {
      labels: (analysisResults[0]?.data as any)?.cycles?.map((c: any) => c.cycleNumber) || [],
      datasets,
    };
  }, [activeGroup, analysisResults, dataType]);
  
  const getConcentrationLabel = (concentration: number): string => {
    if (concentration <= 0.1) return '低浓度';
    if (concentration >= 1.0) return '高浓度';
    if (concentration >= 0.5) return '中高浓度';
    if (concentration >= 0.2) return '中浓度';
    return '中低浓度';
  };
  
  const getConditionLabel = (metadata: any): string => {
    if (!metadata) return '';
    
    if (metadata.temperature !== undefined && metadata.concentration !== undefined) {
      return `${metadata.temperature}°C\n${getConcentrationLabel(metadata.concentration)}`;
    }
    
    if (metadata.temperature !== undefined) {
      return `${metadata.temperature}°C`;
    }
    
    if (metadata.concentration !== undefined) {
      return getConcentrationLabel(metadata.concentration);
    }
    
    if (metadata.scanRate !== undefined) {
      return `${metadata.scanRate * 1000}mV/s`;
    }
    
    if (metadata.currentDensity !== undefined) {
      return `${metadata.currentDensity}C`;
    }
    
    return '';
  };
  
  const getTableConditionLabel = (metadata: any): string => {
    if (!metadata) return '';
    const parts: string[] = [];
    if (metadata.temperature !== undefined) {
      parts.push(`${metadata.temperature}°C`);
    }
    if (metadata.concentration !== undefined) {
      parts.push(getConcentrationLabel(metadata.concentration));
    }
    if (metadata.scanRate !== undefined) {
      parts.push(`${metadata.scanRate * 1000}mV/s`);
    }
    if (metadata.currentDensity !== undefined) {
      parts.push(`${metadata.currentDensity}C`);
    }
    return parts.join(' · ');
  };
  
  const getDisplayCycle = (result: any): number => {
    if (!result?.data?.data) return 1;
    const rawCycles = result.data.data.map((d: any) => d.cycle) as number[];
    const allCycles = [...new Set(rawCycles)].sort((a, b) => a - b);
    if (allCycles.length === 0) return 1;
    
    if (selectedCVRange === 'first') return allCycles[0];
    if (selectedCVRange === 'last') return allCycles[allCycles.length - 1];
    if (selectedCVRange === 'all') return allCycles[0];
    return selectedCVCycles.find((c) => allCycles.includes(c)) || allCycles[0];
  };
  
  const getCyclePeaks = (result: any, cycle: number) => {
    if (!result?.data?.peaks) return { anodicIp: 0, cathodicIp: 0, deltaEp: 0 };
    const cyclePeaks = result.data.peaks.filter((p: any) => p.cycle === cycle);
    const anodicPeak = cyclePeaks.find((p: any) => p.type === 'anodic');
    const cathodicPeak = cyclePeaks.find((p: any) => p.type === 'cathodic');
    return {
      anodicIp: anodicPeak ? anodicPeak.Ip : 0,
      cathodicIp: cathodicPeak ? cathodicPeak.Ip : 0,
      deltaEp: anodicPeak && cathodicPeak ? anodicPeak.Ep - cathodicPeak.Ep : 0,
    };
  };
  
  const paramBarData = useMemo(() => {
    if (!activeGroup) return null;
    
    const labels = analysisResults.map((r: any) => {
      if (!r) return '';
      const condition = getConditionLabel(r.metadata);
      return condition || r.label;
    });
    
    if (dataType === 'cv') {
      const anodicData = analysisResults.map((r: any) => {
        if (!r) return 0;
        const cycle = getDisplayCycle(r);
        const peaks = getCyclePeaks(r, cycle);
        return peaks.anodicIp * 1e6;
      });
      
      return {
        labels,
        datasets: [
          {
            label: '氧化峰电流 Ip (μA)',
            data: anodicData,
            backgroundColor: chartColors[0].border,
            borderRadius: 6,
          },
        ],
      };
    }
    
    if (dataType === 'eis') {
      return {
        labels,
        datasets: [
          {
            label: '溶液电阻 Rs (Ω)',
            data: analysisResults.map((r: any) => r?.params.Rs || 0),
            backgroundColor: chartColors[0].border,
            borderRadius: 6,
          },
          {
            label: '电荷转移电阻 Rct (Ω)',
            data: analysisResults.map((r: any) => r?.params.Rct || 0),
            backgroundColor: chartColors[1].border,
            borderRadius: 6,
          },
        ],
      };
    }
    
    if (dataType === 'discharge') {
      return {
        labels,
        datasets: [
          {
            label: '初始容量 (mAh/g)',
            data: analysisResults.map((r: any) => r?.params.initialCapacity || 0),
            backgroundColor: chartColors[0].border,
            borderRadius: 6,
          },
          {
            label: '容量保持率 (%)',
            data: analysisResults.map((r: any) => r?.params.capacityRetention || 0),
            backgroundColor: chartColors[2].border,
            borderRadius: 6,
          },
        ],
      };
    }
    
    return null;
  }, [activeGroup, analysisResults, dataType, selectedCVRange, selectedCVCycles]);
  
  const compareTableData = useMemo(() => {
    if (!activeGroup) return [];
    
    return analysisResults.map((result: any) => {
      if (!result) return null;
      
      const condition = getTableConditionLabel(result.metadata);
      const temp = result.metadata?.temperature !== undefined ? `${result.metadata.temperature}°C` : '-';
      const conc = result.metadata?.concentration !== undefined 
        ? getConcentrationLabel(result.metadata.concentration) 
        : '-';
      
      if (dataType === 'cv') {
        const cycle = getDisplayCycle(result);
        const peaks = getCyclePeaks(result, cycle);
        return {
          name: result.label,
          condition,
          temperature: temp,
          concentration: conc,
          param1: (peaks.anodicIp * 1e6).toFixed(2) + ' μA',
          param2: (peaks.cathodicIp * 1e6).toFixed(2) + ' μA',
          param3: (peaks.deltaEp * 1000).toFixed(1) + ' mV',
        };
      }
      
      if (dataType === 'eis') {
        return {
          name: result.label,
          condition,
          temperature: temp,
          concentration: conc,
          param1: result.params.Rs.toFixed(2) + ' Ω',
          param2: result.params.Rct.toFixed(2) + ' Ω',
          param3: (result.params.Cdl * 1e6).toFixed(2) + ' μF',
        };
      }
      
      if (dataType === 'discharge') {
        return {
          name: result.label,
          condition,
          temperature: temp,
          concentration: conc,
          param1: result.params.initialCapacity.toFixed(1) + ' mAh/g',
          param2: result.params.capacityRetention.toFixed(1) + ' %',
          param3: result.params.avgEfficiency.toFixed(1) + ' %',
        };
      }
      
      return null;
    }).filter(Boolean);
  }, [activeGroup, analysisResults, dataType, selectedCVRange, selectedCVCycles]);
  
  const tableColumns = [
    { key: 'condition', label: '条件', width: '140px' },
    { key: 'temperature', label: '温度', width: '90px', align: 'center' as const },
    { key: 'concentration', label: '浓度', width: '90px', align: 'center' as const },
    { key: 'name', label: '样品名称' },
    { key: 'param1', label: dataType === 'cv' ? '氧化峰电流' : dataType === 'eis' ? '溶液电阻 Rs' : '初始容量', align: 'right' as const },
    { key: 'param2', label: dataType === 'cv' ? '还原峰电流' : dataType === 'eis' ? '电荷转移电阻 Rct' : '容量保持率', align: 'right' as const },
    { key: 'param3', label: dataType === 'cv' ? '峰电位差' : dataType === 'eis' ? '双电层电容 Cdl' : '平均库仑效率', align: 'right' as const },
  ];
  
  const dataTypes: { type: DataType; label: string; color: string }[] = [
    { type: 'cv', label: 'CV 循环伏安', color: 'cyan' },
    { type: 'eis', label: 'EIS 阻抗谱', color: 'purple' },
    { type: 'discharge', label: '充放电', color: 'green' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <GitCompare className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">对比分析</h1>
              <p className="text-sm text-slate-500">多条件数据横向对比</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">数据类型</h3>
              <div className="space-y-2">
                {dataTypes.map((dt) => (
                  <button
                    key={dt.type}
                    onClick={() => setDataType(dt.type)}
                    className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-all ${
                      dataType === dt.type
                        ? dt.color === 'cyan'
                          ? 'bg-cyan-50 border border-cyan-300 text-cyan-700'
                          : dt.color === 'purple'
                          ? 'bg-purple-50 border border-purple-300 text-purple-700'
                          : 'bg-green-50 border border-green-300 text-green-700'
                        : 'bg-slate-50 border border-transparent text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">对比组</h3>
                <button
                  onClick={createGroup}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-orange-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {compareGroups.length > 0 ? (
                <div className="space-y-2">
                  {compareGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => setActiveCompareGroup(group.id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        activeCompareGroupId === group.id
                          ? 'bg-orange-50 border border-orange-300'
                          : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">{group.name}</p>
                        <p className="text-xs text-slate-400">{group.files.length} 个文件</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCompareGroup(group.id);
                        }}
                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  点击 + 创建对比组
                </p>
              )}
            </div>
            
            {activeGroup && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">可用文件</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredFiles
                    .filter((f) => !activeGroup.files.includes(f.id))
                    .map((file) => (
                      <div
                        key={file.id}
                        onClick={() => addFileToGroup(file.id)}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-orange-50 cursor-pointer transition-colors group"
                      >
                        <span className="text-sm text-slate-600 truncate flex-1 mr-2">
                          {file.metadata?.label || file.name}
                        </span>
                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-orange-500" />
                      </div>
                    ))}
                </div>
                
                {filteredFiles.filter((f) => !activeGroup.files.includes(f.id)).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">无可用文件</p>
                )}
              </div>
            )}
          </div>
          
          <div className="col-span-9 space-y-6">
            {activeGroup ? (
              <>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800">
                      已选文件 ({activeGroup.files.length})
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowReportModal(true)}
                        disabled={activeGroup.files.length === 0}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        <span>导出报告</span>
                      </button>
                    </div>
                  </div>
                  
                  {activeGroup.files.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {activeGroup.files.map((fileId, idx) => {
                        const file = files.find((f) => f.id === fileId);
                        if (!file) return null;
                        const color = chartColors[idx % chartColors.length];
                        
                        return (
                          <div
                            key={fileId}
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color.border }}
                              />
                              <span className="text-sm text-slate-700 truncate">
                                {file.metadata?.label || file.name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => openEditModal(file)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                title="编辑条件信息"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removeFileFromGroup(fileId)}
                                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                                title="移除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-8">从左侧添加文件到对比组</p>
                  )}
                </div>
                
                {analysisResults.length > 0 && (
                  <>
                    {dataType === 'cv' && cvChartData && (
                      <ChartWrapper title="CV曲线对比" height="h-80" extraContent={
                        <div className="flex items-center space-x-3 text-sm">
                          <span className="text-slate-500">循环选择:</span>
                          <select
                            value={selectedCVRange}
                            onChange={(e) => {
                              const val = e.target.value as 'first' | 'last' | 'all' | 'custom';
                              setSelectedCVRange(val);
                              if (val !== 'custom') {
                                setSelectedCVCycles([1]);
                              }
                            }}
                            className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          >
                            <option value="first">第一圈</option>
                            <option value="last">最后一圈</option>
                            <option value="all">全部叠加</option>
                            <option value="custom">自定义</option>
                          </select>
                          {selectedCVRange === 'custom' && (
                            <div className="flex items-center space-x-1">
                              {(() => {
                                const firstResult = analysisResults.find((r: any) => r);
                                if (!firstResult) return null;
                                const cvData = (firstResult as any).data?.data;
                                if (!cvData) return null;
                                const rawCycles = cvData.map((d: any) => d.cycle) as number[];
                                const allCycles = [...new Set(rawCycles)].sort((a, b) => a - b);
                                return allCycles.slice(0, 10).map((cycle: number) => (
                                  <label key={cycle} className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedCVCycles.includes(cycle)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedCVCycles([...selectedCVCycles, cycle].sort((a, b) => a - b));
                                        } else {
                                          setSelectedCVCycles(selectedCVCycles.filter((c) => c !== cycle));
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs text-slate-600">第{cycle}圈</span>
                                  </label>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      }>
                        <Scatter data={cvChartData} options={{
                          ...defaultChartOptions,
                          scales: {
                            x: { ...defaultChartOptions.scales?.x, title: { display: true, text: '电位 E (V)' } },
                            y: { ...defaultChartOptions.scales?.y, title: { display: true, text: '电流 I (A)' } },
                          },
                        }} />
                      </ChartWrapper>
                    )}
                    
                    {dataType === 'discharge' && capacityCompareData && (
                      <ChartWrapper title="容量保持率对比" height="h-80">
                        <Line data={capacityCompareData} options={{
                          ...defaultChartOptions,
                          scales: {
                            x: { ...defaultChartOptions.scales?.x, title: { display: true, text: '循环次数' } },
                            y: { ...defaultChartOptions.scales?.y, title: { display: true, text: '容量保持率 (%)' }, min: 0, max: 100 },
                          },
                        }} />
                      </ChartWrapper>
                    )}
                    
                    {paramBarData && (
                      <ChartWrapper title="关键参数对比" height="h-72">
                        <Bar data={paramBarData} options={{
                          ...defaultChartOptions,
                          scales: {
                            x: { ...defaultChartOptions.scales?.x },
                            y: { ...defaultChartOptions.scales?.y, beginAtZero: true },
                          },
                        }} />
                      </ChartWrapper>
                    )}
                    
                    <DataTable
                      columns={tableColumns}
                      data={compareTableData}
                      title="参数对比表"
                    />
                  </>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <GitCompare className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">创建对比组</h3>
                <p className="text-slate-500 mb-6">在左侧创建对比组并添加数据文件，开始横向对比分析</p>
                <button
                  onClick={createGroup}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">创建对比组</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {editingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">编辑条件信息</h3>
              <button
                onClick={closeEditModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">样品名称</label>
                <input
                  type="text"
                  value={editForm.label}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="输入样品名称"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">温度 (°C)</label>
                  <input
                    type="number"
                    value={editForm.temperature}
                    onChange={(e) => setEditForm({ ...editForm, temperature: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">浓度 (M)</label>
                  <input
                    type="number"
                    value={editForm.concentration}
                    onChange={(e) => setEditForm({ ...editForm, concentration: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="1.0"
                    step="0.1"
                  />
                </div>
              </div>
              
              {dataType === 'cv' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">扫描速率 (V/s)</label>
                  <input
                    type="number"
                    value={editForm.scanRate}
                    onChange={(e) => setEditForm({ ...editForm, scanRate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0.05"
                    step="0.01"
                  />
                </div>
              )}
              
              {dataType === 'discharge' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">电流倍率 (C)</label>
                  <input
                    type="number"
                    value={editForm.currentDensity}
                    onChange={(e) => setEditForm({ ...editForm, currentDensity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="1"
                    step="0.1"
                  />
                </div>
              )}
              
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">
                  <span className="font-medium">提示：</span>
                  修改后，对比图横轴、参数表和文件卡片会同步更新。
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">导出分析报告</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">选择导出格式：</p>
                
                <button
                  onClick={() => { exportCSVReport(); setShowReportModal(false); }}
                  className="w-full flex items-center space-x-3 p-4 border border-slate-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">CSV 格式</p>
                    <p className="text-xs text-slate-500">参数表格数据，可用 Excel 打开</p>
                  </div>
                </button>
                
                <button
                  onClick={() => { exportHTMLReport(); setShowReportModal(false); }}
                  className="w-full flex items-center space-x-3 p-4 border border-slate-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">HTML 报告</p>
                    <p className="text-xs text-slate-500">包含图表和参数的完整报告，浏览器直接查看</p>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
