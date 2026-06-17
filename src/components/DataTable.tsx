interface Column<T> {
  key: keyof T | string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  emptyText?: string;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  title,
  emptyText = '暂无数据',
  className = '',
}: DataTableProps<T>) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      
      <div className="overflow-x-auto">
        {data.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    style={{ width: col.width }}
                    className={`
                      px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider
                      ${alignClasses[col.align || 'left']}
                    `}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col) => {
                    const value = row[col.key as keyof T];
                    return (
                      <td
                        key={String(col.key)}
                        className={`px-5 py-3 text-sm text-slate-700 ${alignClasses[col.align || 'left']}`}
                      >
                        {col.format ? col.format(value, row) : String(value ?? '-')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
