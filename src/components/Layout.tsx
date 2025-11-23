
import React from 'react';
import { BookOpen, Trophy, BarChart, LogOut, Music, Volume2, VolumeX } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  studentName?: string;
  onLogout: () => void;
  isMusicOn: boolean;
  toggleMusic: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  studentName, 
  onLogout, 
  isMusicOn, 
  toggleMusic,
  currentPage,
  onNavigate
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-blue-50 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-bold text-blue-800 hidden md:block">Smart O-NET Prep</h1>
            <h1 className="text-xl font-bold text-blue-800 md:hidden">Smart O-NET</h1>
          </div>

          {studentName && (
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleMusic}
                className={`p-2 rounded-full ${isMusicOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
              >
                {isMusicOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                <span className="text-sm font-semibold text-blue-900 truncate max-w-[100px] md:max-w-none">
                  {studentName}
                </span>
              </div>
              
              <button onClick={onLogout} className="text-red-500 hover:bg-red-50 p-2 rounded-lg md:hidden">
                <LogOut size={20} />
              </button>
              <button onClick={onLogout} className="hidden md:flex items-center gap-1 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                <LogOut size={16} /> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {studentName && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-around py-3">
            <NavItem 
              icon={<BookOpen size={24} />} 
              label="ฝึกฝน" 
              isActive={currentPage === 'practice' || currentPage === 'dashboard'} 
              onClick={() => onNavigate('dashboard')} 
            />
            <NavItem 
              icon={<Trophy size={24} />} 
              label="เกม" 
              isActive={currentPage === 'game'} 
              onClick={() => onNavigate('game')} 
            />
            <NavItem 
              icon={<BarChart size={24} />} 
              label="สถิติ" 
              isActive={currentPage === 'stats'} 
              onClick={() => onNavigate('stats')} 
            />
          </div>
        </nav>
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
  >
    {icon}
    <span className="text-xs font-medium">{label}</span>
  </button>
);

export default Layout;
