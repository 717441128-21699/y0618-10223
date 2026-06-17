import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Zap,
  BarChart3,
  GitCompare,
  Upload,
  FileText,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import type { DataFile } from '@/types';
import { useDataStore } from '@/store/useDataStore';
import { parseCSV, detectDataType, parseCVData, parseEISData, parseDischargeData } from '@/utils/parser';
import { sampleCVData, sampleEISData, sampleDischargeData, cvDataToCSV, eisDataToCSV, dischargeDataToCSV } from '@/data/sampleData';

export default function Home() {
  const navigate = useNavigate();
  const addFiles = useDataStore((s) => s.addFiles);
  const files = useDataStore((s) => s.files);
  const [showSampleData, setShowSampleData] = useState(false);

  const handleFilesUploaded = (uploadedFiles: DataFile[]) => {
    const processedFiles = uploadedFiles.map((file) => {
      const rows = parseCSV(file.rawContent);
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const detectedType = detectDataType(headers);
        if (detectedType) {
          return { ...file, type: detectedType };
        }
      }
      return file;
    });
    addFiles(processedFiles);
    
    if (processedFiles.length > 0) {
      const type = processedFiles[0].type;
      navigate(`/${type}`);
    }
  };

  const loadSampleData = (type: 'cv' | 'eis' | 'discharge') => {
    const sampleFiles: DataFile[] = [];
    
    if (type === 'cv') {
      Object.entries(sampleCVData).forEach(([name, data]) => {
        const metadata: any = { label: name };
        
        if (name.includes('25C')) {
          metadata.temperature = 25;
        }
        if (name.includes('45C')) {
          metadata.temperature = 45;
        }
        if (name.includes('low') || name.includes('low_conc')) {
          metadata.concentration = 0.1;
        }
        if (name.includes('high') || name.includes('high_conc')) {
          metadata.concentration = 1.0;
        }
        if (name.includes('50mV')) {
          metadata.scanRate = 0.05;
        }
        if (name.includes('100mV')) {
          metadata.scanRate = 0.1;
        }
        
        const labelParts: string[] = [];
        if (metadata.temperature !== undefined) labelParts.push(`${metadata.temperature}°C`);
        if (metadata.concentration !== undefined) {
          labelParts.push(metadata.concentration <= 0.1 ? '低浓度' : '高浓度');
        }
        if (metadata.scanRate !== undefined) labelParts.push(`${metadata.scanRate * 1000}mV/s`);
        if (labelParts.length > 0) {
          metadata.label = labelParts.join(' · ');
        } else if (name === 'CV_sample') {
          metadata.scanRate = 0.05;
          metadata.label = '标准样品';
        }
        
        sampleFiles.push({
          id: `sample-cv-${name}`,
          name: `${name}.csv`,
          type: 'cv',
          rawContent: cvDataToCSV(data),
          metadata,
        });
      });
    } else if (type === 'eis') {
      Object.entries(sampleEISData).forEach(([name, data]) => {
        const metadata: any = { label: name };
        
        if (name.includes('25C')) {
          metadata.temperature = 25;
        }
        if (name.includes('45C')) {
          metadata.temperature = 45;
        }
        if (name.includes('low') || name.includes('low_conc')) {
          metadata.concentration = 0.1;
        }
        if (name.includes('high') || name.includes('high_conc')) {
          metadata.concentration = 1.0;
        }
        
        const labelParts: string[] = [];
        if (metadata.temperature !== undefined) labelParts.push(`${metadata.temperature}°C`);
        if (metadata.concentration !== undefined) {
          labelParts.push(metadata.concentration <= 0.1 ? '低浓度' : '高浓度');
        }
        if (labelParts.length > 0) {
          metadata.label = labelParts.join(' · ');
        } else if (name === 'EIS_simple') {
          metadata.label = '简单RC电路';
        } else if (name === 'EIS_CPE') {
          metadata.label = 'CPE模型';
        } else if (name === 'EIS_Warburg') {
          metadata.label = 'Warburg扩散';
        } else if (name === 'EIS_full') {
          metadata.label = '完整模型';
        }
        
        sampleFiles.push({
          id: `sample-eis-${name}`,
          name: `${name}.csv`,
          type: 'eis',
          rawContent: eisDataToCSV(data),
          metadata,
        });
      });
    } else if (type === 'discharge') {
      Object.entries(sampleDischargeData).forEach(([name, data]) => {
        const metadata: any = { label: name };
        
        if (name.includes('25C')) {
          metadata.temperature = 25;
        }
        if (name.includes('45C')) {
          metadata.temperature = 45;
        }
        if (name.includes('low') || name.includes('low_conc')) {
          metadata.concentration = 0.1;
        }
        if (name.includes('high') || name.includes('high_conc')) {
          metadata.concentration = 1.0;
        }
        if (name.includes('fast')) {
          metadata.currentDensity = 2;
        }
        if (name.includes('slow')) {
          metadata.currentDensity = 0.5;
        }
        if (name === 'Discharge_sample') {
          metadata.currentDensity = 1;
        }
        
        const labelParts: string[] = [];
        if (metadata.temperature !== undefined) labelParts.push(`${metadata.temperature}°C`);
        if (metadata.concentration !== undefined) {
          labelParts.push(metadata.concentration <= 0.1 ? '低浓度' : '高浓度');
        }
        if (metadata.currentDensity !== undefined) labelParts.push(`${metadata.currentDensity}C 倍率`);
        if (labelParts.length > 0) {
          metadata.label = labelParts.join(' · ');
        } else if (name === 'Discharge_plateau') {
          metadata.label = '含平台和静置';
        }
        
        sampleFiles.push({
          id: `sample-discharge-${name}`,
          name: `${name}.csv`,
          type: 'discharge',
          rawContent: dischargeDataToCSV(data),
          metadata,
        });
      });
    }
    
    addFiles(sampleFiles);
    navigate(`/${type}`);
  };

  const features = [
    {
      icon: Activity,
      title: '循环伏安分析',
      description: '自动识别氧化还原峰，标注峰值电流和电位，多循环叠加对比稳定性',
      color: 'cyan',
      path: '/cv',
    },
    {
      icon: Zap,
      title: '电化学阻抗谱',
      description: 'Nyquist图和Bode图绘制，多种等效电路模型拟合，输出关键参数',
      color: 'purple',
      path: '/eis',
    },
    {
      icon: BarChart3,
      title: '恒流充放电',
      description: '容量积分计算、能量密度分析、循环衰减曲线，评估电池性能',
      color: 'green',
      path: '/discharge',
    },
    {
      icon: GitCompare,
      title: '多条件对比',
      description: '不同温度、浓度下数据横向对比，量化关键影响因素',
      color: 'orange',
      path: '/compare',
    },
  ];

  const colorClasses = {
    cyan: 'from-cyan-400 to-blue-500',
    purple: 'from-purple-400 to-pink-500',
    green: 'from-green-400 to-emerald-500',
    orange: 'from-orange-400 to-red-500',
  };

  const bgColorClasses = {
    cyan: 'bg-cyan-50 text-cyan-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-cyan-100 text-cyan-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>专业电化学数据分析平台</span>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
            电化学测试数据
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              智能分析
            </span>
            工具
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            一站式循环伏安、阻抗谱、充放电数据分析，智能等效电路拟合，助力科研创新
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {features.map((feature) => (
            <div
              key={feature.title}
              onClick={() => navigate(feature.path)}
              className="group cursor-pointer bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-xl ${bgColorClasses[feature.color as keyof typeof bgColorClasses]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">上传数据</h3>
                <p className="text-sm text-slate-500">支持 CSV / TXT 格式</p>
              </div>
            </div>
            <FileUpload
              onFilesUploaded={handleFilesUploaded}
              multiple={true}
            />
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">示例数据</h3>
                <p className="text-sm text-slate-500">快速体验各功能模块</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => loadSampleData('cv')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50 transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-cyan-600" />
                  <span className="font-medium text-slate-700">CV 循环伏安数据</span>
                </div>
                <span className="text-sm text-slate-400 group-hover:text-cyan-600">加载 →</span>
              </button>
              
              <button
                onClick={() => loadSampleData('eis')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-slate-700">EIS 阻抗谱数据</span>
                </div>
                <span className="text-sm text-slate-400 group-hover:text-purple-600">加载 →</span>
              </button>
              
              <button
                onClick={() => loadSampleData('discharge')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-slate-700">充放电循环数据</span>
                </div>
                <span className="text-sm text-slate-400 group-hover:text-green-600">加载 →</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">智能分析</h4>
              <p className="text-sm text-slate-500">自动识别数据类型，智能算法提取关键参数</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">多维对比</h4>
              <p className="text-sm text-slate-500">不同条件数据横向对比，量化影响因素</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">可视化展示</h4>
              <p className="text-sm text-slate-500">精美交互式图表，一键导出高质量图片</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
