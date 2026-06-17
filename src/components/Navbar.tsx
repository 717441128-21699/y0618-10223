import { NavLink } from 'react-router-dom';
import { Activity, Zap, BarChart3, GitCompare, Home } from 'lucide-react';

export default function Navbar() {
  const navItems = [
    { path: '/', label: '首页', icon: Home },
    { path: '/cv', label: 'CV分析', icon: Activity },
    { path: '/eis', label: 'EIS分析', icon: Zap },
    { path: '/discharge', label: '充放电', icon: BarChart3 },
    { path: '/compare', label: '对比分析', icon: GitCompare },
  ];

  return (
    <nav className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              ElectroLab
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
