
import React, { useState } from 'react';
import { Student, Teacher } from '../../types';
import { UserPlus, Save, RefreshCw, ArrowLeft, GraduationCap, Edit, Trash2 } from 'lucide-react';
import { manageStudent } from '../../services/api';

interface StudentManagerProps {
  students: Student[];
  teacher: Teacher;
  canManageAll: boolean;
  myGrades: string[];
  isDirector: boolean;
  onRefresh: () => void;
  onAdminLoginAsStudent: (student: Student) => void;
}

const GRADE_LABELS: Record<string, string> = { 
    'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
    'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' 
};
const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];

const StudentManager: React.FC<StudentManagerProps> = ({ 
  students, teacher, canManageAll, myGrades, isDirector, onRefresh, onAdminLoginAsStudent 
}) => {
  const [viewLevel, setViewLevel] = useState<'GRADES' | 'LIST'>('GRADES');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);
  
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentAvatar, setNewStudentAvatar] = useState('👦');
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-drill down if single grade
  React.useEffect(() => {
    if (!canManageAll && myGrades.length === 1) {
        setViewLevel('LIST');
        setSelectedGradeFilter(myGrades[0]);
    }
  }, [canManageAll, myGrades]);

  const normalizeId = (id: any) => String(id || '').trim();

  const handleSaveStudent = async () => {
      if (!newStudentName) return;
      setIsSaving(true);
      const studentGrade = selectedGradeFilter || (canManageAll ? 'P6' : (myGrades[0] || 'P6'));
      
      if (editingStudentId) {
          const result = await manageStudent({ 
              action: 'edit', 
              id: editingStudentId, 
              name: newStudentName, 
              avatar: newStudentAvatar, 
              school: teacher.school, 
              grade: studentGrade, 
              teacherId: normalizeId(teacher.id) 
          });
          if (result.success) {
              onRefresh();
              setNewStudentName('');
              setEditingStudentId(null);
              alert('✅ แก้ไขข้อมูลเรียบร้อย');
          } else {
              alert('เกิดข้อผิดพลาดในการแก้ไข');
          }
      } else {
          const result = await manageStudent({ 
              action: 'add', 
              name: newStudentName, 
              school: teacher.school, 
              avatar: newStudentAvatar, 
              grade: studentGrade, 
              teacherId: normalizeId(teacher.id) 
          });
          if (result.success && result.student) {
              setCreatedStudent(result.student);
              onRefresh(); // Refresh list
              setNewStudentName('');
          } else {
              alert('เกิดข้อผิดพลาดในการบันทึก');
          }
      }
      setIsSaving(false);
  };

  const handleEditStudent = (s: Student) => {
      setEditingStudentId(s.id);
      setNewStudentName(s.name);
      setNewStudentAvatar(s.avatar);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteStudent = async (id: string) => {
      if (isDirector) return alert("ผู้อำนวยการไม่สามารถลบนักเรียนได้");
      if (!confirm('ยืนยันการลบนักเรียนคนนี้? ข้อมูลคะแนนจะหายไปทั้งหมด')) return;
      
      const result = await manageStudent({ action: 'delete', id });
      if (result.success) {
          onRefresh();
      } else {
          alert('ลบไม่สำเร็จ');
      }
  };

  const handleCancelEdit = () => {
      setEditingStudentId(null);
      setNewStudentName('');
      setNewStudentAvatar('👦');
  };

  const filteredStudents = students.filter(s => 
    selectedGradeFilter ? s.grade === selectedGradeFilter : true
  );

  if (viewLevel === 'GRADES' && (!(!canManageAll && myGrades.length === 1))) {
      return (
        <div className="animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><UserPlus className="text-purple-600"/> เลือกชั้นเรียน (จัดการนักเรียน)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(canManageAll ? GRADES : myGrades).map(grade => {
                    const studentCount = students.filter(s => s.grade === grade).length;
                    return (
                        <button 
                            key={grade} 
                            onClick={() => { setSelectedGradeFilter(grade); setViewLevel('LIST'); }}
                            className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600 shadow-sm group-hover:scale-110 transition">
                                <GraduationCap size={28}/>
                            </div>
                            <h4 className="text-lg font-bold text-gray-800">{GRADE_LABELS[grade]}</h4>
                            <p className="text-sm text-gray-500">{studentCount} คน</p>
                        </button>
                    );
                })}
            </div>
        </div>
      );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
        <div className="md:col-span-2">
            {(!(!canManageAll && myGrades.length === 1)) && (
                <button onClick={() => { setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="flex items-center gap-1 text-sm text-purple-600 hover:underline">
                <ArrowLeft size={16}/> เลือกชั้นเรียนอื่น
                </button>
            )}
            <h3 className="text-xl font-bold text-gray-800 mt-2">จัดการนักเรียนชั้น {GRADE_LABELS[selectedGradeFilter || '']}</h3>
        </div>
        
        {/* Form */}
        <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                {editingStudentId ? <Edit size={20} className="text-orange-500"/> : <UserPlus size={20} className="text-purple-600"/>}
                {editingStudentId ? 'แก้ไขข้อมูลนักเรียน' : 'ลงทะเบียนนักเรียนใหม่'}
            </h3>
            <div className={`p-6 rounded-2xl border transition-colors ${editingStudentId ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <label className="block text-sm font-medium text-gray-600 mb-2">ชื่อ-นามสกุล</label>
                <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full p-3 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-200 outline-none text-gray-800 bg-white" placeholder="ด.ช. มานะ อดทน" />
                
                <label className="block text-sm font-medium text-gray-600 mb-2">รูปแทนตัว</label>
                <div className="flex gap-2 mb-6 overflow-x-auto py-2 px-1">
                    {['👦','👧','🧒','🧑','👓','🦄','🦁','🐼','🐰','🦊','🐯','🐸'].map(emoji => (
                        <button key={emoji} onClick={() => setNewStudentAvatar(emoji)} className={`text-2xl p-2 rounded-lg border-2 transition flex-shrink-0 ${newStudentAvatar === emoji ? 'border-purple-500 bg-white shadow-md transform scale-110' : 'border-transparent hover:bg-white/50'}`}>{emoji}</button>
                    ))}
                </div>
                
                <div className="flex gap-2">
                    {editingStudentId && <button onClick={handleCancelEdit} className="bg-gray-200 text-gray-600 py-3 px-6 rounded-xl font-bold hover:bg-gray-300">ยกเลิก</button>}
                    <button onClick={handleSaveStudent} disabled={isSaving || !newStudentName} className={`flex-1 text-white py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2 ${editingStudentId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        {isSaving ? 'กำลังบันทึก...' : <><Save size={18} /> {editingStudentId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</>}
                    </button>
                </div>
            </div>
            
            {createdStudent && !editingStudentId && (
                <div className="mt-6 bg-gradient-to-br from-blue-500 to-purple-600 p-1 rounded-3xl shadow-2xl animate-scale-in max-w-sm mx-auto">
                    <div className="bg-white rounded-[22px] p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500"></div>
                        <h4 className="text-gray-500 text-xs uppercase tracking-widest font-bold mb-4">บัตรประจำตัวนักเรียน</h4>
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-6xl mx-auto mb-4 shadow-inner">{createdStudent.avatar}</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{createdStudent.name}</h3>
                        <p className="text-gray-500 text-xs mb-6">{createdStudent.school}</p>
                        <div className="bg-gray-100 rounded-xl p-3 mb-2"><span className="block text-xs text-gray-400 mb-1">รหัสเข้าใช้งาน (ID)</span><span className="text-4xl font-mono font-black text-purple-600 tracking-widest">{createdStudent.id}</span></div>
                        <p className="text-xs text-red-500 mt-2">* กรุณาจดรหัสนี้ไว้เพื่อเข้าใช้งาน</p>
                    </div>
                    <button onClick={() => setCreatedStudent(null)} className="w-full text-center text-white font-bold text-sm mt-3 hover:underline">ปิด</button>
                </div>
            )}
        </div>

        {/* List */}
        <div>
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold text-gray-500">รายชื่อนักเรียน ({filteredStudents.length})</h4>
                <button onClick={onRefresh} className="text-purple-600 hover:bg-purple-50 p-1 rounded"><RefreshCw size={14}/></button>
            </div>
            <div className="max-h-[500px] overflow-y-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                {filteredStudents.length === 0 ? <div className="p-8 text-center text-gray-400">ยังไม่มีข้อมูลนักเรียนในชั้นนี้</div> : filteredStudents.map(s => (
                    <div key={s.id} className="flex items-center p-3 border-b last:border-0 hover:bg-gray-50 gap-3 group">
                        <div className="flex-shrink-0 w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-xl border border-purple-100">{s.avatar}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
                                {s.grade && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded">{GRADE_LABELS[s.grade] || s.grade}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="font-mono bg-white border px-1 rounded">ID: {s.id}</span>
                                {s.quizCount && <span>🎮 {s.quizCount}</span>}
                                {s.level && <span>⭐ Lv.{s.level}</span>}
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditStudent(s)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                            {!isDirector && <button onClick={() => handleDeleteStudent(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default StudentManager;
