import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Plus } from 'lucide-react';
import type { DataFile, DataType } from '@/types';

interface FileUploadProps {
  onFilesUploaded: (files: DataFile[]) => void;
  acceptedType?: DataType;
  multiple?: boolean;
  className?: string;
}

export default function FileUpload({
  onFilesUploaded,
  acceptedType,
  multiple = true,
  className = '',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [acceptedType]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      processFiles(files);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [acceptedType]
  );

  const processFiles = async (files: File[]) => {
    const dataFiles: DataFile[] = [];

    for (const file of files) {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) continue;

      try {
        const content = await file.text();
        const dataFile: DataFile = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: acceptedType || detectTypeFromName(file.name),
          rawContent: content,
        };
        dataFiles.push(dataFile);
      } catch (err) {
        console.error('Error reading file:', file.name, err);
      }
    }

    if (dataFiles.length > 0) {
      onFilesUploaded(dataFiles);
    }
  };

  const detectTypeFromName = (name: string): DataType => {
    const lower = name.toLowerCase();
    if (lower.includes('cv') || lower.includes('voltammetry')) return 'cv';
    if (lower.includes('eis') || lower.includes('impedance')) return 'eis';
    if (lower.includes('discharge') || lower.includes('charge') || lower.includes('gcd')) return 'discharge';
    return 'cv';
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8
          flex flex-col items-center justify-center
          cursor-pointer transition-all duration-300
          ${isDragging
            ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]'
            : 'border-slate-300 hover:border-cyan-400 hover:bg-slate-50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center mb-4
          transition-all duration-300
          ${isDragging ? 'bg-cyan-500/20 scale-110' : 'bg-slate-100'}
        `}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-cyan-500' : 'text-slate-400'}`} />
        </div>
        
        <p className="text-slate-700 font-medium mb-1">
          拖拽文件到此处，或点击上传
        </p>
        <p className="text-sm text-slate-400">
          支持 CSV / TXT 格式{multiple ? '，可批量上传' : ''}
        </p>
      </div>
    </div>
  );
}

interface FileListProps {
  files: DataFile[];
  onRemove?: (id: string) => void;
  onSelect?: (id: string) => void;
  selectedId?: string;
}

export function FileList({ files, onRemove, onSelect, selectedId }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无数据文件</p>
      </div>
    );
  }

  const getTypeLabel = (type: DataType) => {
    switch (type) {
      case 'cv': return 'CV';
      case 'eis': return 'EIS';
      case 'discharge': return '充放电';
      default: return type;
    }
  };

  const getTypeColor = (type: DataType) => {
    switch (type) {
      case 'cv': return 'bg-blue-100 text-blue-700';
      case 'eis': return 'bg-purple-100 text-purple-700';
      case 'discharge': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          onClick={() => onSelect?.(file.id)}
          className={`
            flex items-center justify-between p-3 rounded-lg
            border transition-all duration-200 cursor-pointer
            ${selectedId === file.id
              ? 'border-cyan-400 bg-cyan-50 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }
          `}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center
              ${selectedId === file.id ? 'bg-cyan-100' : 'bg-slate-100'}
            `}>
              <FileText className={`w-5 h-5 ${selectedId === file.id ? 'text-cyan-600' : 'text-slate-500'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate max-w-[160px]">
                {file.name}
              </p>
              <span className={`
                inline-block text-xs px-2 py-0.5 rounded-full mt-0.5
                ${getTypeColor(file.type)}
              `}>
                {getTypeLabel(file.type)}
              </span>
            </div>
          </div>
          
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(file.id);
              }}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function FileUploadButton({ onClick, label = '添加文件' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4
        border-2 border-dashed border-slate-300 rounded-lg
        text-slate-500 hover:text-cyan-600 hover:border-cyan-400 hover:bg-cyan-50
        transition-all duration-200"
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
