
import React from 'react';
import { Subject } from '../types';
import { Calculator, Book, FlaskConical, Languages, ArrowLeft } from 'lucide-react';

interface SubjectSelectionProps {
  onSelectSubject: (subject: Subject) => void;
  onBack: () => void;
}

const SubjectSelection: React.FC<SubjectSelectionProps> = ({ onSelectSubject, onBack }) => {
  
  const subjects = [
    { 
      id: Subject.MATH, 
      name: 'คณิตศาสตร์', 
      icon: <Calculator size={48} />, 
      color: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600',
      shadow: 'shadow-red-100'
    },
    { 
      id: Subject.THAI, 
      name: 'ภาษาไทย', 
      icon: <Book size={48} />, 
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-600',
      shadow: 'shadow-yellow-100'
    },
    { 
      id: Subject.SCIENCE, 
      name: 'วิทยาศาสตร์', 
      icon: <FlaskConical size={48} />, 
      color: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-600',
      shadow: 'shadow-green-100'
    },
    { 
      id: Subject.ENGLISH, 
      name: 'ภาษาอังกฤษ', 
      icon: <Languages size={48} />, 
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600',
      shadow: 'shadow-blue-100'
    }
  ];

  return (
    <div className="max-w-3xl mx-auto min-h-[80vh] flex flex-col">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6 w-fit">
        <ArrowLeft size={20} /> กลับหน้าหลัก
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">เลือกวิชาที่ต้องการฝึก</h2>
        <p className="text-gray-500">เลือกวิชาแล้วเริ่มทำแบบทดสอบกันเลย!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subjects.map((sub) => (
          <button
            key={sub.name}
            onClick={() => onSelectSubject(sub.id)}
            className={`group relative p-8 rounded-3xl border-4 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl flex flex-col items-center gap-4 ${sub.color} ${sub.shadow}`}
          >
            <div className="bg-white p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform">
              {sub.icon}
            </div>
            <h3 className="text-2xl font-bold">{sub.name}</h3>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-white/80 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                เริ่มเลย!
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SubjectSelection;
