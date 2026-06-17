import { useState, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { GitCompare, Plus, Trash2, Settings } from 'lucide-react';
import ChartWrapper, { chartColors, defaultChartOptions } from '@/components/ChartWrapper';
import { FileList } from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import ParamCard, { ParamGrid } from '@/components/ParamCard';
import { useDataStore } from '@/store/useDataStore';
import { parseCSV, parseCVData, parseEISData, parseDischargeData } from '@/utils/parser';
import { analyzeCV } from '@/utils/cvAnalysis';
import { fitEIS } from '@/utils/eisFitting';
import { analyzeDischarge } from '@/utils/dischargeAnalysis';
import type { DataType, CompareGroup } from '@/types';

export default function CompareAnalysis() {
  const files = useDataStore((s) => s.files);
  const compareGroups = useDataStore((s) => s.compareGroups);
  const activeCompareGroupId = useDataStore((s) => s.activeCompareGroupId);
  const addCompareGroup = useDataStore((s) => s.addCompareGroup);
  const removeCompareGroup = useDataStore((s) => s.removeCompareGroup);
  const setActiveCompareGroup = useDataStore((s) => s.setActiveCompareGroup);
  const updateCompareGroup = useDataStore((s) => s.updateCompareGroup);
  
  const [dataType, setDataType] = useState<DataType>('cv');
  const [variableName, setVariableName] = useState('温度');
  const [variableType, setVariableType] = useState<'temperature' | 'concentration' | 'scanRate' | 'currentDensity' | 'custom'>('temperature');
  const [variableUnit, setVariableUnit] = useState('°C');
  
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
  
  const cvChartData = useMemo(() => {
    if (!activeGroup || dataType !== 'cv') return null;
    
    const datasets: any[] = [];
    
    analysisResults.forEach((result: any, idx: number) => {
      if (!result) return;
      const color = chartColors[idx % chartColors.length];
      const firstCycleData = result.data.data.filter((d: any) => d.cycle === 1);
      const sorted = [...firstCycleData].sort((a: any, b: any) => a.E - b.E);
      
      datasets.push({
        label: result.label,
        data: sorted.map((d: any) => ({ x: d.E, y: d.I })),
        borderColor: color.border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      });
    });
    
    return { datasets };
  }, [activeGroup, analysisResults, dataType]);
  
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
  
  const getConditionLabel = (metadata: any): string => {
    if (!metadata) return '';
    const parts: string[] = [];
    if (metadata.temperature !== undefined) {
      parts.push(`${metadata.temperature}°C`);
    }
    if (metadata.concentration !== undefined) {
      parts.push(`${metadata.concentration}M`);
    }
    if (metadata.scanRate !== undefined) {
      parts.push(`${metadata.scanRate * 1000}mV/s`);
    }
    if (metadata.currentDensity !== undefined) {
      parts.push(`${metadata.currentDensity}C`);
    }
    return parts.join(' · ');
  };
  
  const paramBarData = useMemo(() => {
    if (!activeGroup) return null;
    
    const labels = analysisResults.map((r: any) => {
      if (!r) return '';
      const condition = getConditionLabel(r.metadata);
      return condition || r.label;
    });
    
    if (dataType === 'cv') {
      return {
        labels,
        datasets: [
          {
            label: '氧化峰电流 Ip (μA)',
            data: analysisResults.map((r: any) => r?.params.anodicIp * 1e6 || 0),
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
  }, [activeGroup, analysisResults, dataType]);
  
  const compareTableData = useMemo(() => {
    if (!activeGroup) return [];
    
    return analysisResults.map((result: any) => {
      if (!result) return null;
      
      const condition = getConditionLabel(result.metadata);
      const temp = result.metadata?.temperature !== undefined ? `${result.metadata.temperature}°C` : '-';
      const conc = result.metadata?.concentration !== undefined ? `${result.metadata.concentration}M` : '-';
      
      if (dataType === 'cv') {
        return {
          name: result.label,
          condition,
          temperature: temp,
          concentration: conc,
          param1: (result.params.anodicIp * 1e6).toFixed(2) + ' μA',
          param2: (result.params.cathodicIp * 1e6).toFixed(2) + ' μA',
          param3: (result.params.deltaEp * 1000).toFixed(1) + ' mV',
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
  }, [activeGroup, analysisResults, dataType]);
  
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
                            <button
                              onClick={() => removeFileFromGroup(fileId)}
                              className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
                      <ChartWrapper title="CV曲线对比" height="h-80">
                        <Line data={cvChartData} options={{
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
    </div>
  );
}
