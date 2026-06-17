import { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { BarChart3, Battery, Zap, TrendingDown, Settings } from 'lucide-react';
import ChartWrapper, { chartColors, defaultChartOptions } from '@/components/ChartWrapper';
import FileUpload, { FileList } from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import ParamCard, { ParamGrid } from '@/components/ParamCard';
import { useDataStore } from '@/store/useDataStore';
import { parseCSV, parseDischargeData } from '@/utils/parser';
import { analyzeDischarge, calculateCapacityDecayRate, getCycleData } from '@/utils/dischargeAnalysis';
import type { DataFile } from '@/types';

export default function DischargeAnalysis() {
  const files = useDataStore((s) => s.files.filter((f) => f.type === 'discharge'));
  const selectedFileId = useDataStore((s) => s.selectedFileId);
  const addFiles = useDataStore((s) => s.addFiles);
  const removeFile = useDataStore((s) => s.removeFile);
  const setSelectedFile = useDataStore((s) => s.setSelectedFile);
  
  const [mass, setMass] = useState(1);
  const [selectedCycles, setSelectedCycles] = useState<number[]>([]);
  const [showCharge, setShowCharge] = useState(true);
  
  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId) || files[0],
    [files, selectedFileId]
  );
  
  const analysisResult = useMemo(() => {
    if (!selectedFile) return null;
    
    const rows = parseCSV(selectedFile.rawContent);
    const data = parseDischargeData(rows);
    if (data.length === 0) return null;
    
    return analyzeDischarge(data, mass);
  }, [selectedFile, mass]);
  
  useEffect(() => {
    if (analysisResult && analysisResult.cycles.length > 0) {
      const cycles = analysisResult.cycles.map((c) => c.cycleNumber);
      setSelectedCycles([cycles[0], Math.floor(cycles.length / 2), cycles[cycles.length - 1]].filter(
        (v, i, a) => a.indexOf(v) === i
      ));
    }
  }, [analysisResult]);
  
  const handleFilesUploaded = (uploadedFiles: DataFile[]) => {
    const dischargeFiles = uploadedFiles.map((f) => ({ ...f, type: 'discharge' as const }));
    addFiles(dischargeFiles);
  };
  
  const toggleCycle = (cycle: number) => {
    setSelectedCycles((prev) =>
      prev.includes(cycle)
        ? prev.filter((c) => c !== cycle)
        : [...prev, cycle]
    );
  };
  
  const dischargeChartData = useMemo(() => {
    if (!analysisResult) return null;
    
    const datasets: any[] = [];
    
    selectedCycles.forEach((cycleNum, idx) => {
      const color = chartColors[idx % chartColors.length];
      
      if (showCharge) {
        const chargeData = getCycleData(analysisResult.data, cycleNum, 'charge');
        datasets.push({
          label: `充电 循环${cycleNum}`,
          data: chargeData.map((d) => ({ x: d.t, y: d.V })),
          borderColor: color.border,
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        });
      }
      
      const dischargeData = getCycleData(analysisResult.data, cycleNum, 'discharge');
      datasets.push({
        label: `放电 循环${cycleNum}`,
        data: dischargeData.map((d) => ({ x: d.t, y: d.V })),
        borderColor: color.border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      });
    });
    
    return { datasets };
  }, [analysisResult, selectedCycles, showCharge]);
  
  const capacityChartData = useMemo(() => {
    if (!analysisResult) return null;
    
    return {
      labels: analysisResult.cycles.map((c) => c.cycleNumber),
      datasets: [
        {
          label: '放电容量',
          data: analysisResult.cycles.map((c) => c.capacity),
          borderColor: chartColors[0].border,
          backgroundColor: chartColors[0].bg,
          fill: true,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
        },
      ],
    };
  }, [analysisResult]);
  
  const retentionChartData = useMemo(() => {
    if (!analysisResult) return null;
    
    return {
      labels: analysisResult.cycles.map((c) => c.cycleNumber),
      datasets: [
        {
          label: '容量保持率',
          data: analysisResult.capacityRetention,
          borderColor: chartColors[2].border,
          backgroundColor: chartColors[2].bg,
          fill: true,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
        },
      ],
    };
  }, [analysisResult]);
  
  const voltageChartOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      x: {
        ...defaultChartOptions.scales?.x,
        title: {
          display: true,
          text: '时间 t (s)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
      y: {
        ...defaultChartOptions.scales?.y,
        title: {
          display: true,
          text: '电压 V (V)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
    },
  }), []);
  
  const capacityChartOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      x: {
        ...defaultChartOptions.scales?.x,
        title: {
          display: true,
          text: '循环次数',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
      y: {
        ...defaultChartOptions.scales?.y,
        title: {
          display: true,
          text: '比容量 (mAh/g)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        beginAtZero: false,
      },
    },
  }), []);
  
  const retentionChartOptions = useMemo(() => ({
    ...defaultChartOptions,
    scales: {
      x: {
        ...defaultChartOptions.scales?.x,
        title: {
          display: true,
          text: '循环次数',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
      },
      y: {
        ...defaultChartOptions.scales?.y,
        title: {
          display: true,
          text: '容量保持率 (%)',
          font: { size: 12, weight: 'bold' as const },
          color: '#475569',
        },
        min: 0,
        max: 100,
      },
    },
  }), []);
  
  const summaryParams = useMemo(() => {
    if (!analysisResult || analysisResult.cycles.length === 0) return [];
    
    const firstCycle = analysisResult.cycles[0];
    const lastCycle = analysisResult.cycles[analysisResult.cycles.length - 1];
    const decayRate = calculateCapacityDecayRate(analysisResult.cycles);
    const avgEfficiency = analysisResult.cycles.reduce((sum, c) => sum + c.coulombicEfficiency, 0) / analysisResult.cycles.length;
    
    return [
      {
        label: '初始容量',
        value: firstCycle.capacity.toFixed(1),
        unit: 'mAh/g',
        color: 'cyan' as const,
        icon: <Battery className="w-5 h-5" />,
        subtitle: '第1循环',
      },
      {
        label: '末次容量',
        value: lastCycle.capacity.toFixed(1),
        unit: 'mAh/g',
        color: 'purple' as const,
        subtitle: `第${lastCycle.cycleNumber}循环`,
      },
      {
        label: '容量保持率',
        value: lastCycle.capacity > 0 ? (lastCycle.capacity / firstCycle.capacity * 100).toFixed(1) : '0',
        unit: '%',
        color: 'green' as const,
        subtitle: `${analysisResult.cycles.length}次循环后`,
      },
      {
        label: '平均库仑效率',
        value: avgEfficiency.toFixed(1),
        unit: '%',
        color: 'orange' as const,
        icon: <Zap className="w-5 h-5" />,
      },
    ];
  }, [analysisResult]);
  
  const cyclesTableData = useMemo(() => {
    if (!analysisResult) return [];
    
    return analysisResult.cycles.map((cycle) => ({
      cycle: cycle.cycleNumber,
      chargeCap: cycle.chargeCapacity?.toFixed(2) || '-',
      dischargeCap: cycle.dischargeCapacity?.toFixed(2) || '-',
      efficiency: cycle.coulombicEfficiency.toFixed(2),
      energyDensity: cycle.energyDensity.toFixed(2),
    }));
  }, [analysisResult]);
  
  const cyclesColumns = [
    { key: 'cycle', label: '循环号', width: '80px', align: 'center' as const },
    { key: 'chargeCap', label: '充电容量 (mAh/g)', align: 'right' as const },
    { key: 'dischargeCap', label: '放电容量 (mAh/g)', align: 'right' as const },
    { key: 'efficiency', label: '库仑效率 (%)', align: 'right' as const },
    { key: 'energyDensity', label: '能量密度 (Wh/kg)', align: 'right' as const },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">恒流充放电分析</h1>
              <p className="text-sm text-slate-500">Galvanostatic Charge-Discharge</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <label className="text-sm text-slate-600">活性物质质量:</label>
              <input
                type="number"
                value={mass}
                onChange={(e) => setMass(parseFloat(e.target.value) || 1)}
                className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                step="0.1"
                min="0.01"
              />
              <span className="text-sm text-slate-500">mg</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">数据文件</h3>
              <FileUpload
                onFilesUploaded={handleFilesUploaded}
                acceptedType="discharge"
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
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center space-x-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showCharge}
                      onChange={(e) => setShowCharge(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span>显示充电曲线</span>
                  </label>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {analysisResult.cycles.map((cycle, idx) => (
                    <label
                      key={cycle.cycleNumber}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCycles.includes(cycle.cycleNumber)}
                        onChange={() => toggleCycle(cycle.cycleNumber)}
                        className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: chartColors[idx % chartColors.length].border }}
                      />
                      <span className="text-sm text-slate-700 flex-1">循环 {cycle.cycleNumber}</span>
                      <span className="text-xs text-slate-400">{cycle.capacity.toFixed(0)} mAh/g</span>
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
                  title="充放电曲线"
                  subtitle={selectedFile?.name || ''}
                  height="h-80"
                >
                  {dischargeChartData && <Line data={dischargeChartData} options={voltageChartOptions} />}
                </ChartWrapper>
                
                <div className="grid grid-cols-2 gap-6">
                  <ChartWrapper
                    title="容量衰减曲线"
                    subtitle="放电比容量 vs 循环次数"
                    height="h-64"
                  >
                    {capacityChartData && <Line data={capacityChartData} options={capacityChartOptions} />}
                  </ChartWrapper>
                  
                  <ChartWrapper
                    title="容量保持率"
                    subtitle="相对于首次循环的容量保持率"
                    height="h-64"
                  >
                    {retentionChartData && <Line data={retentionChartData} options={retentionChartOptions} />}
                  </ChartWrapper>
                </div>
                
                <DataTable
                  columns={cyclesColumns}
                  data={cyclesTableData}
                  title="循环性能参数"
                />
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Battery className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无数据</h3>
                <p className="text-slate-500 mb-6">上传充放电数据文件或加载示例数据开始分析</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
