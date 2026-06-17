import { useState, useEffect, useMemo } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { Activity, Upload, Trash2, Eye, EyeOff } from 'lucide-react';
import ChartWrapper, { chartColors, defaultChartOptions } from '@/components/ChartWrapper';
import FileUpload, { FileList } from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import ParamCard, { ParamGrid } from '@/components/ParamCard';
import { useDataStore } from '@/store/useDataStore';
import { parseCSV, parseCVData } from '@/utils/parser';
import { analyzeCV, calculatePeakSeparation, peakRatio, getDataByCycle } from '@/utils/cvAnalysis';
import type { CVDataPoint, CVPeak, DataFile } from '@/types';

export default function CVAnalysis() {
  const files = useDataStore((s) => s.files.filter((f) => f.type === 'cv'));
  const selectedFileId = useDataStore((s) => s.selectedFileId);
  const addFiles = useDataStore((s) => s.addFiles);
  const removeFile = useDataStore((s) => s.removeFile);
  const setSelectedFile = useDataStore((s) => s.setSelectedFile);
  
  const [selectedCycles, setSelectedCycles] = useState<number[]>([]);
  const [showPeaks, setShowPeaks] = useState(true);
  
  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId) || files[0],
    [files, selectedFileId]
  );
  
  const analysisResult = useMemo(() => {
    if (!selectedFile) return null;
    
    const rows = parseCSV(selectedFile.rawContent);
    const data = parseCVData(rows);
    if (data.length === 0) return null;
    
    return analyzeCV(data);
  }, [selectedFile]);
  
  useEffect(() => {
    if (analysisResult && analysisResult.cycles.length > 0) {
      setSelectedCycles(analysisResult.cycles);
    }
  }, [analysisResult]);
  
  const handleFilesUploaded = (uploadedFiles: DataFile[]) => {
    const cvFiles = uploadedFiles.map((f) => ({ ...f, type: 'cv' as const }));
    addFiles(cvFiles);
  };
  
  const toggleCycle = (cycle: number) => {
    setSelectedCycles((prev) =>
      prev.includes(cycle)
        ? prev.filter((c) => c !== cycle)
        : [...prev, cycle]
    );
  };
  
  const chartData = useMemo(() => {
    if (!analysisResult) return null;
    
    const datasets: any[] = [];
    
    selectedCycles.forEach((cycle, idx) => {
      const cycleData = getDataByCycle(analysisResult.data, cycle);
      
      const color = chartColors[idx % chartColors.length];
      
      datasets.push({
        label: `循环 ${cycle}`,
        data: cycleData.map((d) => ({ x: d.E, y: d.I })),
        borderColor: color.border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        showLine: true,
      });
      
      if (showPeaks) {
        const cyclePeaks = analysisResult.peaks.filter((p) => p.cycle === cycle);
        
        cyclePeaks.forEach((peak) => {
          datasets.push({
            label: `${peak.type === 'anodic' ? '氧化' : '还原'}峰 (循环${cycle})`,
            data: [{ x: peak.Ep, y: peak.Ip }],
            borderColor: peak.type === 'anodic' ? '#ef4444' : '#22c55e',
            backgroundColor: peak.type === 'anodic' ? '#ef4444' : '#22c55e',
            pointRadius: 6,
            pointHoverRadius: 8,
            pointStyle: 'circle',
            showLine: false,
          });
        });
      }
    });
    
    return {
      datasets,
    };
  }, [analysisResult, selectedCycles, showPeaks]);
  
  const chartOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      ...defaultChartOptions.scales,
      x: {
        ...defaultChartOptions.scales?.x,
        title: {
          display: true,
          text: '电位 E (V)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
      y: {
        ...defaultChartOptions.scales?.y,
        title: {
          display: true,
          text: '电流 I (A)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
    },
  }), []);
  
  const peaksTableData = useMemo(() => {
    if (!analysisResult) return [];
    
    return analysisResult.peaks.map((peak) => ({
      cycle: peak.cycle,
      type: peak.type === 'anodic' ? '氧化峰' : '还原峰',
      Ep: peak.Ep.toFixed(4),
      Ip: (peak.Ip * 1e6).toFixed(2),
      area: (peak.area * 1e6).toFixed(2),
    }));
  }, [analysisResult]);
  
  const summaryParams = useMemo(() => {
    if (!analysisResult || analysisResult.peaks.length === 0) return [];
    
    const firstCycle = analysisResult.cycles[0];
    const deltaEp = calculatePeakSeparation(analysisResult.peaks, firstCycle);
    const ipRatio = peakRatio(analysisResult.peaks, firstCycle);
    const anodicPeak = analysisResult.peaks.find((p) => p.cycle === firstCycle && p.type === 'anodic');
    const cathodicPeak = analysisResult.peaks.find((p) => p.cycle === firstCycle && p.type === 'cathodic');
    
    return [
      {
        label: '循环数',
        value: analysisResult.cycles.length,
        unit: '次',
        color: 'cyan' as const,
        icon: <Activity className="w-5 h-5" />,
      },
      {
        label: '峰电位差 ΔEp',
        value: deltaEp ? (deltaEp * 1000).toFixed(1) : '-',
        unit: 'mV',
        color: 'purple' as const,
        subtitle: '第1循环',
      },
      {
        label: '峰电流比 Ipa/Ipc',
        value: ipRatio ? ipRatio.toFixed(3) : '-',
        color: 'green' as const,
        subtitle: '第1循环',
      },
      {
        label: '氧化峰电流',
        value: anodicPeak ? (anodicPeak.Ip * 1e6).toFixed(2) : '-',
        unit: 'μA',
        color: 'orange' as const,
        subtitle: '第1循环',
      },
    ];
  }, [analysisResult]);
  
  const peaksColumns = [
    { key: 'cycle', label: '循环号', width: '80px', align: 'center' as const },
    { key: 'type', label: '峰类型', width: '100px', align: 'center' as const },
    { key: 'Ep', label: '峰电位 Ep (V)', align: 'right' as const },
    { key: 'Ip', label: '峰电流 Ip (μA)', align: 'right' as const },
    { key: 'area', label: '峰面积 (μV·A)', align: 'right' as const },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">循环伏安分析</h1>
              <p className="text-sm text-slate-500">Cyclic Voltammetry</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowPeaks(!showPeaks)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              showPeaks
                ? 'bg-cyan-100 text-cyan-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {showPeaks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm font-medium">{showPeaks ? '显示峰' : '隐藏峰'}</span>
          </button>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">数据文件</h3>
              <FileUpload
                onFilesUploaded={handleFilesUploaded}
                acceptedType="cv"
                className="mb-3"
              />
              <FileList
                files={files}
                onRemove={removeFile}
                onSelect={setSelectedFile}
                selectedId={selectedFile?.id}
              />
            </div>
            
            {analysisResult && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">循环选择</h3>
                <div className="space-y-2">
                  {analysisResult.cycles.map((cycle, idx) => (
                    <label
                      key={cycle}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCycles.includes(cycle)}
                        onChange={() => toggleCycle(cycle)}
                        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors[idx % chartColors.length].border }} />
                      <span className="text-sm text-slate-700">循环 {cycle}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="col-span-9 space-y-6">
            {analysisResult ? (
              <>
                <ParamGrid items={summaryParams} cols={4} />
                
                <ChartWrapper
                  title="循环伏安曲线"
                  subtitle={selectedFile?.name || ''}
                  height="h-96"
                >
                  {chartData && <Scatter data={chartData} options={chartOptions} />}
                </ChartWrapper>
                
                <DataTable
                  columns={peaksColumns}
                  data={peaksTableData}
                  title="峰参数列表"
                  emptyText="未识别到峰"
                />
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无数据</h3>
                <p className="text-slate-500 mb-6">上传 CV 数据文件或加载示例数据开始分析</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
