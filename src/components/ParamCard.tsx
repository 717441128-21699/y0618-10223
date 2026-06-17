interface ParamCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red';
  subtitle?: string;
}

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  cyan: 'from-cyan-500 to-cyan-600',
  purple: 'from-purple-500 to-purple-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
};

const bgColorClasses = {
  blue: 'bg-blue-50',
  cyan: 'bg-cyan-50',
  purple: 'bg-purple-50',
  green: 'bg-green-50',
  orange: 'bg-orange-50',
  red: 'bg-red-50',
};

const iconColorClasses = {
  blue: 'text-blue-600',
  cyan: 'text-cyan-600',
  purple: 'text-purple-600',
  green: 'text-green-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
};

export default function ParamCard({
  label,
  value,
  unit,
  icon,
  color = 'cyan',
  subtitle,
}: ParamCardProps) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl p-5
      bg-white border border-slate-200
      hover:shadow-lg hover:-translate-y-0.5
      transition-all duration-300
    `}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]}`} />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <div className="flex items-baseline mt-2">
            <span className="text-2xl font-bold text-slate-800">{value}</span>
            {unit && <span className="ml-1.5 text-sm text-slate-500">{unit}</span>}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        
        {icon && (
          <div className={`
            w-12 h-12 rounded-xl ${bgColorClasses[color]} flex items-center justify-center
          `}>
            <div className={iconColorClasses[color]}>
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ParamGridProps {
  items: ParamCardProps[];
  cols?: number;
}

export function ParamGrid({ items, cols = 4 }: ParamGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[cols as keyof typeof gridCols] || 'grid-cols-4'} gap-4`}>
      {items.map((item, index) => (
        <ParamCard key={index} {...item} />
      ))}
    </div>
  );
}
