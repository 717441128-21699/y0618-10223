import { useState } from 'react';
import { Download, Maximize2, RefreshCw } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LogarithmicScale,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LogarithmicScale
);

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
  height?: string;
  extraContent?: React.ReactNode;
}

export default function ChartWrapper({
  title,
  subtitle,
  children,
  onReset,
  className = '',
  height = 'h-80',
  extraContent,
}: ChartWrapperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `${title}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className={`
      bg-white rounded-xl border border-slate-200 overflow-hidden
      transition-all duration-300
      ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''}
      ${className}
    `}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
          {extraContent && (
            <div className="mt-2">
              {extraContent}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {onReset && (
            <button
              onClick={onReset}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="重置视图"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="导出图片"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="全屏查看"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className={`p-4 ${height}`}>
        {children}
      </div>
    </div>
  );
}

export const chartColors = [
  { bg: 'rgba(6, 182, 212, 0.1)', border: 'rgb(6, 182, 212)' },
  { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgb(249, 115, 22)' },
  { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgb(34, 197, 94)' },
  { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgb(168, 85, 247)' },
  { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgb(239, 68, 68)' },
  { bg: 'rgba(236, 72, 153, 0.1)', border: 'rgb(236, 72, 153)' },
  { bg: 'rgba(20, 184, 166, 0.1)', border: 'rgb(20, 184, 166)' },
  { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgb(59, 130, 246)' },
];

export const defaultChartOptions: ChartOptions<any> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 16,
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: {
        size: 12,
        weight: 'bold',
      },
      bodyFont: {
        size: 11,
      },
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(226, 232, 240, 0.5)',
      },
      ticks: {
        font: {
          size: 11,
        },
        color: '#64748b',
      },
    },
    y: {
      grid: {
        color: 'rgba(226, 232, 240, 0.5)',
      },
      ticks: {
        font: {
          size: 11,
        },
        color: '#64748b',
      },
    },
  },
};
