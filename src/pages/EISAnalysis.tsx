import { useState, useEffect, useMemo } from 'react';
import { Scatter, Line } from 'react-chartjs-2';
import { Zap, Settings, RefreshCw, ChevronDown } from 'lucide-react';
import ChartWrapper, { chartColors, defaultChartOptions } from '@/components/ChartWrapper';
import FileUpload, { FileList } from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import ParamCard, { ParamGrid } from '@/components/ParamCard';
import { useDataStore } from '@/store/useDataStore';
import { parseCSV, parseEISData } from '@/utils/parser';
import { fitEIS, generateFitData, circuitLabels } from '@/utils/eisFitting';
import type { CircuitType, DataFile, EISFitParams } from '@/types';

export default function EISAnalysis() {
  const files = useDataStore((s) => s.files.filter((f) => f.type === 'eis'));
  const selectedFileId = useDataStore((s) => s.selectedFileId);
  const addFiles = useDataStore((s) => s.addFiles);
  const removeFile = useDataStore((s) => s.removeFile);
  const setSelectedFile = useDataStore((s) => s.setSelectedFile);
  
  const [circuitType, setCircuitType] = useState<CircuitType>('RQRW');
  const [fitResult, setFitResult] = useState<EISFitParams | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [showCircuitDropdown, setShowCircuitDropdown] = useState(false);
  
  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId) || files[0],
    [files, selectedFileId]
  );
  
  const eisData = useMemo(() => {
    if (!selectedFile) return null;
    
    const rows = parseCSV(selectedFile.rawContent);
    const data = parseEISData(rows);
    return data.length > 0 ? data : null;
  }, [selectedFile]);
  
  useEffect(() => {
    if (eisData) {
      runFitting();
    }
  }, [eisData, circuitType]);
  
  const runFitting = () => {
    if (!eisData) return;
    
    setIsFitting(true);
    setTimeout(() => {
      const result = fitEIS(eisData, circuitType, 100);
      setFitResult(result);
      setIsFitting(false);
    }, 100);
  };
  
  const handleFilesUploaded = (uploadedFiles: DataFile[]) => {
    const eisFiles = uploadedFiles.map((f) => ({ ...f, type: 'eis' as const }));
    addFiles(eisFiles);
  };
  
  const fitData = useMemo(() => {
    if (!fitResult || !eisData) return null;
    
    const freqs = eisData.map((d) => d.freq);
    return generateFitData(fitResult, freqs);
  }, [fitResult, eisData]);
  
  const nyquistChartData = useMemo(() => {
    if (!eisData) return null;
    
    const datasets: any[] = [
      {
        label: '实验数据',
        data: eisData.map((d) => ({ x: d.Zreal, y: d.Zimag })),
        backgroundColor: chartColors[0].border,
        borderColor: chartColors[0].border,
        pointRadius: 5,
        pointHoverRadius: 7,
        showLine: false,
      },
    ];
    
    if (fitData) {
      datasets.push({
        label: '拟合曲线',
        data: fitData.map((d) => ({ x: d.Zreal, y: d.Zimag })),
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        showLine: true,
        tension: 0.1,
      });
    }
    
    return { datasets };
  }, [eisData, fitData]);
  
  const bodeChartData = useMemo(() => {
    if (!eisData) return null;
    
    const magData = eisData.map((d) => {
      const Z = Math.sqrt(d.Zreal ** 2 + d.Zimag ** 2);
      return { x: d.freq, y: Math.log10(Z) };
    });
    
    const phaseData = eisData.map((d) => ({
      x: d.freq,
      y: Math.atan2(d.Zimag, d.Zreal) * 180 / Math.PI,
    }));
    
    const datasets: any[] = [
      {
        label: '|Z| 实验',
        data: magData,
        borderColor: chartColors[0].border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        yAxisID: 'y',
      },
      {
        label: '相位角 实验',
        data: phaseData,
        borderColor: chartColors[1].border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        yAxisID: 'y1',
      },
    ];
    
    if (fitData) {
      const fitMag = fitData.map((d) => {
        const Z = Math.sqrt(d.Zreal ** 2 + d.Zimag ** 2);
        return { x: d.freq, y: Math.log10(Z) };
      });
      const fitPhase = fitData.map((d) => ({
        x: d.freq,
        y: Math.atan2(d.Zimag, d.Zreal) * 180 / Math.PI,
      }));
      
      datasets.push({
        label: '|Z| 拟合',
        data: fitMag,
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        yAxisID: 'y',
      });
      datasets.push({
        label: '相位角 拟合',
        data: fitPhase,
        borderColor: '#f97316',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        yAxisID: 'y1',
      });
    }
    
    return { datasets };
  }, [eisData, fitData]);
  
  const nyquistOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      x: {
        ...defaultChartOptions.scales?.x,
        title: {
          display: true,
          text: "Z' (Ω)",
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
      y: {
        ...defaultChartOptions.scales?.y,
        title: {
          display: true,
          text: "-Z'' (Ω)",
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
    },
  }), []);
  
  const residualChartData = useMemo(() => {
    if (!eisData || !fitData || eisData.length !== fitData.length) return null;
    
    const realResiduals: { x: number; y: number }[] = [];
    const imagResiduals: { x: number; y: number }[] = [];
    
    for (let i = 0; i < eisData.length; i++) {
      const freq = eisData[i].freq;
      realResiduals.push({
        x: freq,
        y: eisData[i].Zreal - fitData[i].Zreal,
      });
      imagResiduals.push({
        x: freq,
        y: eisData[i].Zimag - fitData[i].Zimag,
      });
    }
    
    return {
      datasets: [
        {
          label: "实部残差 ΔZ'",
          data: realResiduals,
          borderColor: chartColors[0].border,
          backgroundColor: chartColors[0].bg,
          borderWidth: 2,
          pointRadius: 4,
          showLine: true,
          tension: 0.2,
        },
        {
          label: "虚部残差 ΔZ''",
          data: imagResiduals,
          borderColor: chartColors[1].border,
          backgroundColor: chartColors[1].bg,
          borderWidth: 2,
          pointRadius: 4,
          showLine: true,
          tension: 0.2,
        },
      ],
    };
  }, [eisData, fitData]);
  
  const residualOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      x: {
        type: 'logarithmic' as const,
        title: {
          display: true,
          text: '频率 (Hz)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.5)',
        },
      },
      y: {
        type: 'linear' as const,
        title: {
          display: true,
          text: '残差 (Ω)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.5)',
        },
      },
    },
    plugins: {
      ...defaultChartOptions.plugins,
      legend: {
        ...defaultChartOptions.plugins?.legend,
        display: true,
      },
    },
  }), []);
  
  const residualTableData = useMemo(() => {
    if (!eisData || !fitData || eisData.length !== fitData.length) return [];
    
    return eisData.map((point, idx) => {
      const fitPoint = fitData[idx];
      const realResidual = point.Zreal - fitPoint.Zreal;
      const imagResidual = point.Zimag - fitPoint.Zimag;
      
      return {
        index: idx + 1,
        freq: point.freq.toExponential(2),
        zrealExp: point.Zreal.toFixed(4),
        zrealFit: fitPoint.Zreal.toFixed(4),
        realResidual: realResidual.toFixed(4),
        realResidualPct: point.Zreal !== 0 ? ((realResidual / point.Zreal) * 100).toFixed(2) : '-',
        zimagExp: point.Zimag.toFixed(4),
        zimagFit: fitPoint.Zimag.toFixed(4),
        imagResidual: imagResidual.toFixed(4),
        imagResidualPct: point.Zimag !== 0 ? ((imagResidual / point.Zimag) * 100).toFixed(2) : '-',
      };
    });
  }, [eisData, fitData]);
  
  const residualColumns = [
    { key: 'index', label: '#', width: '50px', align: 'center' as const },
    { key: 'freq', label: '频率 (Hz)', align: 'right' as const },
    { key: 'zrealExp', label: 'Z\'实验 (Ω)', align: 'right' as const },
    { key: 'zrealFit', label: 'Z\'拟合 (Ω)', align: 'right' as const },
    { key: 'realResidual', label: 'ΔZ\' (Ω)', align: 'right' as const },
    { key: 'realResidualPct', label: 'ΔZ\' (%)', align: 'right' as const },
    { key: 'zimagExp', label: 'Z\'\'实验 (Ω)', align: 'right' as const },
    { key: 'zimagFit', label: 'Z\'\'拟合 (Ω)', align: 'right' as const },
    { key: 'imagResidual', label: 'ΔZ\'\' (Ω)', align: 'right' as const },
    { key: 'imagResidualPct', label: 'ΔZ\'\' (%)', align: 'right' as const },
  ];
  
  const bodeOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      x: {
        type: 'logarithmic' as const,
        title: {
          display: true,
          text: '频率 (Hz)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.5)',
        },
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: 'log |Z| (Ω)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.5)',
        },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: '相位角 (°)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  }), []);
  
  const fitParams = useMemo(() => {
    if (!fitResult) return [];
    
    const params: any[] = [
      {
        label: '溶液电阻 Rs',
        value: fitResult.Rs.toFixed(2),
        unit: 'Ω',
        color: 'cyan' as const,
      },
      {
        label: '电荷转移电阻 Rct',
        value: fitResult.Rct.toFixed(2),
        unit: 'Ω',
        color: 'purple' as const,
      },
      {
        label: '双电层电容 Cdl',
        value: (fitResult.Cdl * 1e6).toFixed(2),
        unit: 'μF',
        color: 'green' as const,
      },
    ];
    
    if (fitResult.n !== undefined) {
      params.push({
        label: 'CPE指数 n',
        value: fitResult.n.toFixed(3),
        color: 'orange' as const,
      });
    }
    
    if (fitResult.W !== undefined) {
      params.push({
        label: 'Warburg系数 W',
        value: fitResult.W.toFixed(2),
        unit: 'Ω·s^-0.5',
        color: 'red' as const,
      });
    }
    
    params.push({
      label: '拟合优度 χ²',
      value: fitResult.chiSq.toExponential(2),
      color: 'blue' as const,
    });
    
    return params;
  }, [fitResult]);
  
  const paramsTableData = useMemo(() => {
    if (!fitResult) return [];
    
    const data: any[] = [
      { name: 'Rs', value: fitResult.Rs.toFixed(4), unit: 'Ω', desc: '溶液电阻' },
      { name: 'Rct', value: fitResult.Rct.toFixed(4), unit: 'Ω', desc: '电荷转移电阻' },
      { name: 'Cdl', value: (fitResult.Cdl * 1e6).toFixed(4), unit: 'μF', desc: '双电层电容' },
    ];
    
    if (fitResult.n !== undefined) {
      data.push({ name: 'n', value: fitResult.n.toFixed(4), unit: '-', desc: 'CPE扩散系数' });
    }
    if (fitResult.W !== undefined) {
      data.push({ name: 'W', value: fitResult.W.toFixed(4), unit: 'Ω·s^-0.5', desc: 'Warburg系数' });
    }
    if (fitResult.R2 !== undefined) {
      data.push({ name: 'R2', value: fitResult.R2.toFixed(4), unit: 'Ω', desc: '第二电阻' });
    }
    if (fitResult.C2 !== undefined) {
      data.push({ name: 'C2', value: (fitResult.C2 * 1e6).toFixed(4), unit: 'μF', desc: '第二电容' });
    }
    if (fitResult.n2 !== undefined) {
      data.push({ name: 'n2', value: fitResult.n2.toFixed(4), unit: '-', desc: '第二CPE指数' });
    }
    
    return data;
  }, [fitResult]);
  
  const paramsColumns = [
    { key: 'name', label: '参数', width: '100px' },
    { key: 'value', label: '数值', align: 'right' as const },
    { key: 'unit', label: '单位', width: '100px' },
    { key: 'desc', label: '说明' },
  ];
  
  const circuitTypes: CircuitType[] = ['RCR', 'RQR', 'RQRW', 'RQRQR'];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">电化学阻抗谱分析</h1>
              <p className="text-sm text-slate-500">Electrochemical Impedance Spectroscopy</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setShowCircuitDropdown(!showCircuitDropdown)}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-purple-400 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-700">{circuitLabels[circuitType]}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              
              {showCircuitDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  {circuitTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setCircuitType(type);
                        setShowCircuitDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 ${
                        circuitType === type ? 'bg-purple-50 text-purple-700' : 'text-slate-700'
                      }`}
                    >
                      {circuitLabels[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={runFitting}
              disabled={!eisData || isFitting}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isFitting ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">开始拟合</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">数据文件</h3>
              <FileUpload
                onFilesUploaded={handleFilesUploaded}
                acceptedType="eis"
                className="mb-3"
              />
              <FileList
                files={files}
                onRemove={removeFile}
                onSelect={setSelectedFile}
                selectedId={selectedFile?.id}
              />
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">等效电路</h3>
              <div className="space-y-2">
                {circuitTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setCircuitType(type)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                      circuitType === type
                        ? 'bg-purple-50 border border-purple-300 text-purple-700'
                        : 'bg-slate-50 border border-transparent text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {circuitLabels[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="col-span-9 space-y-6">
            {eisData ? (
              <>
                <ParamGrid items={fitParams} cols={fitParams.length > 4 ? 3 : 4} />
                
                <div className="grid grid-cols-2 gap-6">
                  <ChartWrapper
                    title="Nyquist图"
                    subtitle="复数阻抗平面图"
                    height="h-80"
                  >
                    {nyquistChartData && <Scatter data={nyquistChartData} options={nyquistOptions} />}
                  </ChartWrapper>
                  
                  <ChartWrapper
                    title="Bode图"
                    subtitle="阻抗幅值与相位角"
                    height="h-80"
                  >
                    {bodeChartData && <Line data={bodeChartData} options={bodeOptions} />}
                  </ChartWrapper>
                </div>
                
                <DataTable
                  columns={paramsColumns}
                  data={paramsTableData}
                  title="等效电路拟合参数"
                />
                
                {residualChartData && (
                  <ChartWrapper
                    title="拟合残差曲线"
                    subtitle="实部与虚部残差 vs 频率"
                    height="h-64"
                  >
                    <Line data={residualChartData} options={residualOptions} />
                  </ChartWrapper>
                )}
                
                {residualTableData.length > 0 && (
                  <div className="overflow-x-auto">
                    <DataTable
                      columns={residualColumns}
                      data={residualTableData}
                      title="各频率点残差详情"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无数据</h3>
                <p className="text-slate-500 mb-6">上传 EIS 数据文件或加载示例数据开始分析</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
