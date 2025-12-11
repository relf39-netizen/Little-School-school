
import React, { useState } from 'react';
import { SubjectConfig, Teacher } from '../../types';
import { List, PlusCircle, Book, Calculator, FlaskConical, Languages, Users, Gamepad2, Sparkles, Trash2 } from 'lucide-react';
import { addSubject, deleteSubject } from '../../services/api';

interface SubjectManagerProps {
  subjects: SubjectConfig[];
  teacher: Teacher;
  canManageAll: boolean;
  myGrades: string[];
  onRefresh: () => void;
}

const SubjectManager: React.FC<SubjectManagerProps> = ({ subjects, teacher, canManageAll, myGrades, onRefresh }) => {
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState('Book');
  const [newSubjectColor, setNewSubjectColor] = useState('bg-blue-100 text-blue-600');
  const [isProcessing, setIsProcessing] = useState(false);

  const normalizeId = (id: any) => String(id || '').trim();

  const handleAddSubject = async () => {
      if (!newSubjectName) return alert('กรุณากรอกชื่อวิชา');
      setIsProcessing(true);
      const newSub: SubjectConfig = { 
          id: Date.now().toString(), 
          name: newSubjectName, 
          school: teacher.school, 
          teacherId: normalizeId(teacher.id), 
          grade: canManageAll ? 'ALL' : (myGrades[0] || 'ALL'), 
          icon: newSubjectIcon, 
          color: newSubjectColor 
      };
      const success = await addSubject(teacher.school, newSub);
      setIsProcessing(false);
      if (success.success) {
          alert('✅ เพิ่มวิชาเรียบร้อย');
          setNewSubjectName('');
          onRefresh();
      } else {
          alert('เกิดข้อผิดพลาด: ' + success.message);
      }
  };

  const handleDeleteSubject = async (subId: string) => {
      if (!confirm('ยืนยันการลบวิชานี้?')) return;
      setIsProcessing(true);
      await deleteSubject(teacher.school, subId);
      setIsProcessing(false);
      onRefresh();
  };

  const SUBJECT_ICONS = [
      { name: 'Book', component: <Book /> },
      { name: 'Calculator', component: <Calculator /> },
      { name: 'FlaskConical', component: <FlaskConical /> },
      { name: 'Languages', component: <Languages /> },
      { name: 'Globe', component: <Users /> },
      { name: 'Computer', component: <Gamepad2 /> },
      { name: 'Art', component: <Sparkles /> },
  ];

  const CARD_COLORS = [
      { name: 'ฟ้า', class: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600' },
      { name: 'เขียว', class: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-600' },
      { name: 'ม่วง', class: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-600' },
      { name: 'ส้ม', class: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-600' },
      { name: 'ชมพู', class: 'bg-pink-50 hover:bg-pink-100 border-pink-200 text-pink-600' },
      { name: 'แดง', class: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600' },
      { name: 'เหลือง', class: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700' },
      { name: 'คราม', class: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-600' },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><List className="text-pink-600"/> จัดการรายวิชา</h3>
        
        <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100 mb-8">
            <h4 className="font-bold text-pink-800 mb-4 flex items-center gap-2"><PlusCircle size={18}/> เพิ่มวิชาใหม่</h4>
            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 mb-1">ชื่อวิชา</label>
                    <input type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white" placeholder="เช่น สังคมศึกษา, ศิลปะ" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">ไอคอน</label>
                    <select value={newSubjectIcon} onChange={e => setNewSubjectIcon(e.target.value)} className="p-2.5 border rounded-lg bg-white w-full md:w-32">
                        {SUBJECT_ICONS.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">สีการ์ด</label>
                    <select value={newSubjectColor} onChange={e => setNewSubjectColor(e.target.value)} className="p-2.5 border rounded-lg bg-white w-full md:w-32">
                        {CARD_COLORS.map(c => <option key={c.name} value={c.class}>{c.name}</option>)}
                    </select>
                </div>
                <button onClick={handleAddSubject} disabled={isProcessing} className="bg-pink-600 text-white px-6 py-2.5 rounded-lg font-bold shadow hover:bg-pink-700 disabled:opacity-50 w-full md:w-auto">
                    {isProcessing ? 'บันทึก...' : 'เพิ่มวิชา'}
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {subjects.map(sub => (
                <div key={sub.id} className={`p-4 rounded-xl border flex justify-between items-center shadow-sm ${sub.color || 'bg-white'}`}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/50 p-2 rounded-lg">
                            {SUBJECT_ICONS.find(i => i.name === sub.icon)?.component || <Book/>}
                        </div>
                        <span className="font-bold text-lg">{sub.name}</span>
                    </div>
                    <button onClick={() => handleDeleteSubject(sub.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-white/50 rounded-lg transition">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
        </div>
        {subjects.length === 0 && <div className="text-center text-gray-400 py-10">ยังไม่มีรายวิชา</div>}
    </div>
  );
};

export default SubjectManager;
