import React, { useState, useEffect } from 'react';
import { Teacher, Student, Subject, Assignment, Question } from '../types';
import { UserPlus, BarChart2, FileText, LogOut, Save, RefreshCw, ExternalLink, Gamepad2, Calendar, Eye, CheckCircle, X, Clock, PlusCircle, ChevronLeft, ChevronRight, Book, Calculator, FlaskConical, Languages, ArrowLeft, LayoutGrid, Users, GraduationCap } from 'lucide-react';
import { getTeacherDashboard, addStudent, addAssignment, addQuestion } from '../services/api';

interface TeacherDashboardProps {
  teacher: Teacher;
  onLogout: () => void;
  onStartGame: () => void; 
}

const ADD_QUESTION_URL = 'https://script.google.com/macros/s/AKfycbx3EwKuxf1L7_iYqoCLCpfHQlu8FyPL9ty8n4oJlSuInj9sMcsSFjQyw39--V2-gQ8U/exec';

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, onLogout, onStartGame }) => {
  // เปลี่ยน default เป็น 'menu' เพื่อโชว์หน้าปุ่มกดก่อน
  const [activeTab, setActiveTab] = useState<'menu' | 'students' | 'stats' | 'questions' | 'assignments'>('menu');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Student Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentAvatar, setNewStudentAvatar] = useState('👦');
  const [newStudentGrade, setNewStudentGrade] = useState('P6'); 
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Assignment Form
  const [assignSubject, setAssignSubject] = useState<Subject>(Subject.MATH);
  const [assignCount, setAssignCount] = useState(10);
  const [assignDeadline, setAssignDeadline] = useState('');

  // Question Form
  const [qSubject, setQSubject] = useState<Subject>(Subject.MATH);
  const [qGrade, setQGrade] = useState('P6');
  const [qText, setQText] = useState('');
  const [qImage, setQImage] = useState('');
  const [qChoices, setQChoices] = useState({c1:'', c2:'', c3:'', c4:''});
  const [qCorrect, setQCorrect] = useState('1');
  const [qExplain, setQExplain] = useState('');

  // Question Bank State
  const [qBankSubject, setQBankSubject] = useState<Subject | null>(null); 
  const [qBankPage, setQBankPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getTeacherDashboard(teacher.school);
    setStudents(data.students || []);
    setStats(data.results || []);
    setAssignments(data.assignments || []); 
    setQuestions(data.questions || []); 
    setLoading(false);
  };

  const handleAddStudent = async () => {
    if (!newStudentName) return;
    setIsSaving(true);
    const result = await addStudent(newStudentName, teacher.school, newStudentAvatar, newStudentGrade);
    if (result) {
        setCreatedStudent(result);
        setStudents([...students, result]);
        setNewStudentName('');
    } else { alert('เกิดข้อผิดพลาดในการบันทึก'); }
    setIsSaving(false);
  };

  const handleCreateAssignment = async () => {
    if (!assignDeadline) return alert('กรุณาเลือกวันกำหนดส่ง');
    setIsSaving(true);
    const success = await addAssignment(teacher.school, assignSubject, assignCount, assignDeadline, teacher.name);
    if (success) {
      alert('✅ สั่งการบ้านเรียบร้อยแล้ว');
      setAssignDeadline('');
      const data = await getTeacherDashboard(teacher.school);
      setAssignments(data.assignments || []);
    } else { alert('เกิดข้อผิดพลาด'); }
    setIsSaving(false);
  };

  const handleAddQuestion = async () => {
    if (!qText || !qChoices.c1 || !qChoices.c2) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    setIsSaving(true);
    const success = await addQuestion({
        subject: qSubject, grade: qGrade, text: qText, image: qImage,
        c1: qChoices.c1, c2: qChoices.c2, c3: qChoices.c3, c4: qChoices.c4,
        correct: qCorrect, explanation: qExplain, school: teacher.school
    });
    if (success) {
        alert('✅ บันทึกข้อสอบเรียบร้อยแล้ว');
        setQText(''); setQChoices({c1:'', c2:'', c3:'', c4:''}); setQExplain('');
        const data = await getTeacherDashboard(teacher.school);
        setQuestions(data.questions || []);
    } else { alert('บันทึกไม่สำเร็จ'); }
    setIsSaving(false);
  };

  const getStudentScore = (studentId: string) => {
    const studentResults = stats.filter(r => String(r.studentId) === String(studentId));
    if (studentResults.length === 0) return null;
    return studentResults[studentResults.length - 1];
  };

  const countSubmitted = (assignmentId: string) => {
      const submittedStudentIds = new Set(stats.filter(r => r.assignmentId === assignmentId).map(r => r.studentId));
      return submittedStudentIds.size;
  };

  const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  // --- Question Bank Logic ---
  const getFilteredQuestions = () => {
    if (!qBankSubject) return [];
    return questions.filter(q => {
        if (q.subject !== qBankSubject) return false;
        if (!teacher.gradeLevel || teacher.gradeLevel === 'ALL') return true;
        if (q.grade === 'ALL') return true;
        return q.grade === teacher.gradeLevel;
    });
  };
  const filteredQuestions = getFilteredQuestions();
  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
  const currentQuestions = filteredQuestions.slice((qBankPage - 1) * ITEMS_PER_PAGE, qBankPage * ITEMS_PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-b-3xl md:rounded-3xl shadow-lg mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap size={28} /> ห้องพักครู
          </h2>
          <p className="opacity-90 text-sm mt-1">{teacher.school} • คุณครู{teacher.name} {teacher.gradeLevel && `(ชั้น ${teacher.gradeLevel})`}</p>
        </div>
        <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition backdrop-blur-sm">
            <LogOut size={20} />
        </button>
      </div>

      {/* 1. MENU GRID (หน้าหลัก) */}
      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0">
            {/* ปุ่มจัดการนักเรียน */}
            <MenuCard 
                icon={<UserPlus size={40} />}
                title="จัดการนักเรียน"
                desc="ลงทะเบียนนักเรียนใหม่ แก้ไขข้อมูล"
                color="bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-500"
                onClick={() => setActiveTab('students')}
            />
            {/* ปุ่มสั่งการบ้าน */}
            <MenuCard 
                icon={<Calendar size={40} />}
                title="สั่งการบ้าน"
                desc="มอบหมายงานและติดตามการส่งงาน"
                color="bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-500"
                onClick={() => setActiveTab('assignments')}
            />
            {/* ปุ่มดูคะแนน */}
            <MenuCard 
                icon={<BarChart2 size={40} />}
                title="ดูผลคะแนน"
                desc="สถิติการสอบและพัฒนาการนักเรียน"
                color="bg-green-50 text-green-600 border-green-200 hover:border-green-500"
                onClick={() => setActiveTab('stats')}
            />
            {/* ปุ่มคลังข้อสอบ */}
            <MenuCard 
                icon={<FileText size={40} />}
                title="คลังข้อสอบ"
                desc="เพิ่มข้อสอบใหม่ และจัดการคลังข้อสอบ"
                color="bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-500"
                onClick={() => setActiveTab('questions')}
            />
            {/* ปุ่มจัดกิจกรรมเกม */}
            <MenuCard 
                icon={<Gamepad2 size={40} />}
                title="จัดกิจกรรมเกม"
                desc="เปิดห้องแข่งขันเกมตอบคำถาม Real-time"
                color="bg-pink-50 text-pink-600 border-pink-200 hover:border-pink-500"
                onClick={onStartGame} // ลิงก์ไปหน้าเริ่มเกมเลย
            />
        </div>
      )}

      {/* CONTENT SECTIONS (หน้ารายละเอียด) */}
      {activeTab !== 'menu' && (
        <div className="bg-white rounded-3xl shadow-sm p-4 md:p-6 min-h-[400px] relative animate-fade-in">
            
            {/* ปุ่มย้อนกลับ */}
            <button 
                onClick={() => setActiveTab('menu')}
                className="mb-6 flex items-center gap-2 text-gray-500 hover:text-purple-600 font-bold transition-colors"
            >
                <div className="bg-gray-100 p-2 rounded-full"><ArrowLeft size={20} /></div>
                กลับเมนูหลัก
            </button>
            
            {/* --- Tab: Students --- */}
            {activeTab === 'students' && (
            <div className="grid md:grid-cols-2 gap-8">
                <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><UserPlus className="text-purple-600"/> ลงทะเบียนนักเรียนใหม่</h3>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-900 mb-2">ระดับชั้น</label>
                        <select value={newStudentGrade} onChange={(e)=>setNewStudentGrade(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-purple-200">
                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">ชื่อ-นามสกุล</label>
                    <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:ring-2 focus:ring-purple-200 outline-none text-gray-900 bg-white" placeholder="ด.ช. มานะ อดทน" />
                    
                    <label className="block text-sm font-medium text-gray-900 mb-2">รูปแทนตัว</label>
                    <div className="flex gap-2 mb-6 overflow-x-auto py-1">{['👦','👧','🧒','🧑','👓','🦄','🦁','🐼'].map(emoji => (<button key={emoji} onClick={() => setNewStudentAvatar(emoji)} className={`text-2xl p-2 rounded-lg border-2 transition ${newStudentAvatar === emoji ? 'border-purple-500 bg-purple-50' : 'border-transparent hover:bg-gray-200'}`}>{emoji}</button>))}</div>
                    <button onClick={handleAddStudent} disabled={isSaving || !newStudentName} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2">{isSaving ? 'กำลังบันทึก...' : <><Save size={18} /> บันทึกข้อมูล</>}</button>
                </div>
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-2"><h4 className="text-sm font-bold text-gray-500">รายชื่อนักเรียน ({students.length})</h4><button onClick={loadData} className="text-purple-600 hover:bg-purple-50 p-1 rounded"><RefreshCw size={14}/></button></div>
                    <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl bg-white">
                        {students.map(s => (
                            <div key={s.id} className="flex items-center p-3 border-b last:border-0 hover:bg-gray-50 gap-3">
                                <div className="flex-shrink-0 w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-xl border border-purple-100">{s.avatar}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">{s.name || 'ไม่ระบุชื่อ'}</p>
                                    <span className="text-[10px] text-white bg-purple-400 px-2 py-0.5 rounded-full">{s.grade}</span>
                                </div>
                                <div className="flex-shrink-0"><span className="font-mono text-xs font-medium text-purple-600 bg-white px-2 py-1 rounded border border-purple-200 shadow-sm">{s.id}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
                </div>
                <div className="flex flex-col items-center justify-center mt-6 md:mt-0">
                {createdStudent ? (
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1 rounded-3xl shadow-2xl w-full max-w-xs animate-fade-in scale-100 transition-transform">
                    <div className="bg-white rounded-[22px] p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500"></div>
                        <h4 className="text-gray-500 text-xs uppercase tracking-widest font-bold mb-4">บัตรประจำตัวนักเรียน</h4>
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-6xl mx-auto mb-4 shadow-inner">{createdStudent.avatar}</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{createdStudent.name}</h3>
                        <div className="flex justify-center gap-2 mb-6">
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">{createdStudent.grade}</span>
                            <span className="text-gray-500 text-xs">{createdStudent.school}</span>
                        </div>
                        <div className="bg-gray-100 rounded-xl p-3 mb-2"><span className="block text-xs text-gray-400 mb-1">รหัสเข้าใช้งาน (ID)</span><span className="text-3xl font-mono font-black text-purple-600 tracking-widest">{createdStudent.id}</span></div>
                    </div>
                    <div className="text-center mt-4"><button onClick={() => setCreatedStudent(null)} className="text-white/90 text-sm font-bold underline hover:text-white">+ เพิ่มคนต่อไป</button></div>
                    </div>
                ) : (<div className="text-center text-gray-400"><div className="bg-gray-100 w-32 h-48 rounded-xl mx-auto mb-4 border-2 border-dashed border-gray-300 flex items-center justify-center"><UserPlus size={40} className="opacity-20" /></div><p>กรอกชื่อด้านซ้ายเพื่อสร้างรหัส</p></div>)}
                </div>
            </div>
            )}

            {/* Tab: Assignments */}
            {activeTab === 'assignments' && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8">
                    <h4 className="font-bold text-xl text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-orange-500"/> สั่งงานใหม่</h4>
                    <div className="grid md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">วิชา</label>
                            <select value={assignSubject} onChange={(e) => setAssignSubject(e.target.value as Subject)} className="w-full p-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none">
                                {Object.values(Subject).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">จำนวนข้อ</label>
                            <input type="number" value={assignCount} onChange={(e) => setAssignCount(Number(e.target.value))} className="w-full p-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none" min="5" max="50" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">ส่งภายใน</label>
                            <input type="date" value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-orange-200 outline-none" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={handleCreateAssignment} disabled={isSaving} className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold shadow hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 h-[42px]">
                                {isSaving ? 'กำลังบันทึก...' : <><Save size={16}/> สั่งงาน</>}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">รายการการบ้านที่สั่งแล้ว ({assignments.length})</h3>
                    <button onClick={loadData} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600 flex items-center gap-1"><RefreshCw size={14}/> รีเฟรช</button>
                </div>
                
                {assignments.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">ยังไม่มีการบ้าน</div>
                ) : (
                    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-orange-50 text-orange-900">
                                <tr><th className="p-3">วิชา</th><th className="p-3 text-center">จำนวนข้อ</th><th className="p-3">กำหนดส่ง</th><th className="p-3 text-center">คนส่งแล้ว</th><th className="p-3 text-right">จัดการ</th></tr>
                            </thead>
                            <tbody>
                                {assignments.slice().reverse().map((a) => {
                                    const submittedCount = countSubmitted(a.id);
                                    const isExpired = new Date(a.deadline) < new Date();
                                    return (
                                        <tr key={a.id} className="border-b hover:bg-gray-50 last:border-0">
                                            <td className="p-3 font-bold text-gray-900">{a.subject}</td>
                                            <td className="p-3 text-center text-gray-900">{a.questionCount}</td>
                                            <td className={`p-3 font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                                                {a.deadline} {isExpired && '(หมดเขต)'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded-full font-bold text-xs ${submittedCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                    {submittedCount} คน
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => setSelectedAssignment(a)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto border border-blue-200">
                                                    <Eye size={14} /> ดูรายละเอียด
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}

            {/* Tab: Stats */}
            {activeTab === 'stats' && (
            <div>
                <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-green-600"/> ผลการเรียนของนักเรียน ({students.length} คน)</h3>
                <button onClick={loadData} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600 flex items-center gap-1"><RefreshCw size={14}/> รีเฟรช</button>
                </div>
                {loading ? <div className="text-center py-10 text-gray-400">กำลังโหลด...</div> : (
                <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
                    <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-purple-50 text-purple-900 border-b border-purple-100">
                        <tr><th className="p-4 rounded-tl-xl w-20 text-center">รูป</th><th className="p-4">ข้อมูลนักเรียน</th><th className="p-4 text-center">สถานะ</th><th className="p-4 rounded-tr-xl text-right">คะแนนล่าสุด</th></tr>
                    </thead>
                    <tbody>
                        {students.map(s => {
                        const score = getStudentScore(s.id);
                        return (
                            <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-3 text-center"><div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-3xl mx-auto">{s.avatar || '👤'}</div></td>
                            <td className="p-3 align-middle"><div className="font-bold text-gray-900 text-base mb-1">{s.name}</div><span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">ID: {s.id}</span></td>
                            <td className="p-3 text-center align-middle">{score ? <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">สอบแล้ว</span> : <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500 border border-gray-200">ยังไม่สอบ</span>}</td>
                            <td className="p-3 text-right align-middle">{score ? <div><span className="text-xl font-bold text-purple-700">{score.score}</span><span className="text-gray-500 text-sm">/{score.total}</span></div> : <span className="text-gray-300">-</span>}</td>
                            </tr>
                        )
                        })}
                    </tbody>
                    </table>
                </div>
                )}
            </div>
            )}
            
            {/* Tab: Question Bank */}
            {activeTab === 'questions' && (
            <div className="max-w-6xl mx-auto">
                
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> คลังข้อสอบ 
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        แสดงเฉพาะชั้น {teacher.gradeLevel || 'ทั้งหมด'}
                        </span>
                    </h3>
                    <div className="flex gap-2">
                        <a href={ADD_QUESTION_URL} target="_blank" rel="noopener noreferrer" className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition border">
                            <ExternalLink size={16} /> ระบบเก่า (Admin)
                        </a>
                    </div>
                </div>

                {/* Form เพิ่มข้อสอบ */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">➕ เพิ่มข้อสอบใหม่ด่วน</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">วิชา</label>
                            <select value={qSubject} onChange={(e)=>setQSubject(e.target.value as Subject)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-200">
                                {Object.values(Subject).map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ระดับชั้น</label>
                            <select value={qGrade} onChange={(e)=>setQGrade(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-200">
                                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">โจทย์คำถาม</label>
                        <textarea value={qText} onChange={(e)=>setQText(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-200" rows={2} placeholder="พิมพ์โจทย์..."></textarea>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">รูปภาพประกอบ (ถ้ามี Link)</label>
                        <input type="text" value={qImage} onChange={(e)=>setQImage(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-200" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input type="text" value={qChoices.c1} onChange={(e)=>setQChoices({...qChoices, c1:e.target.value})} placeholder="ก." className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900"/>
                        <input type="text" value={qChoices.c2} onChange={(e)=>setQChoices({...qChoices, c2:e.target.value})} placeholder="ข." className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900"/>
                        <input type="text" value={qChoices.c3} onChange={(e)=>setQChoices({...qChoices, c3:e.target.value})} placeholder="ค." className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900"/>
                        <input type="text" value={qChoices.c4} onChange={(e)=>setQChoices({...qChoices, c4:e.target.value})} placeholder="ง." className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900"/>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">เฉลยข้อถูก</label>
                        <select value={qCorrect} onChange={(e)=>setQCorrect(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-200">
                            <option value="1">ก.</option><option value="2">ข.</option><option value="3">ค.</option><option value="4">ง.</option>
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">อธิบายเฉลย</label>
                        <textarea value={qExplain} onChange={(e)=>setQExplain(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-200" rows={1} placeholder="อธิบายเหตุผล..."></textarea>
                    </div>
                    <button onClick={handleAddQuestion} disabled={isSaving} className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold shadow hover:bg-blue-700 flex items-center justify-center gap-2">
                        {isSaving ? 'กำลังบันทึก...' : <><PlusCircle size={20}/> บันทึกข้อสอบ</>}
                    </button>
                </div>

                {/* 1. ปุ่มเลือกวิชา (Filter) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { id: Subject.MATH, icon: <Calculator />, color: 'bg-red-100 text-red-700 border-red-200' },
                        { id: Subject.THAI, icon: <Book />, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                        { id: Subject.SCIENCE, icon: <FlaskConical />, color: 'bg-green-100 text-green-700 border-green-200' },
                        { id: Subject.ENGLISH, icon: <Languages />, color: 'bg-blue-100 text-blue-700 border-blue-200' }
                    ].map(sub => (
                        <button 
                            key={sub.id}
                            onClick={() => { setQBankSubject(sub.id); setQBankPage(1); }}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                                qBankSubject === sub.id 
                                ? `${sub.color} ring-2 ring-offset-2 ring-gray-300 shadow-md scale-105` 
                                : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            <div className="text-3xl">{sub.icon}</div>
                            <span className="font-bold">{sub.id}</span>
                        </button>
                    ))}
                </div>

                {/* 2. รายการข้อสอบ */}
                {qBankSubject ? (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <span className="font-bold text-gray-700">รายการข้อสอบวิชา {qBankSubject}</span>
                            <span className="text-xs text-gray-400">ทั้งหมด {filteredQuestions.length} ข้อ</span>
                        </div>
                        
                        {filteredQuestions.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">ยังไม่มีข้อสอบในหมวดนี้</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {currentQuestions.map((q, idx) => (
                                    <div key={q.id} className="p-5 hover:bg-blue-50 transition">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-2">
                                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">ข้อ {((qBankPage-1)*ITEMS_PER_PAGE) + idx + 1}</span>
                                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">ชั้น {q.grade}</span>
                                                <span className={`text-xs px-2 py-1 rounded font-bold ${q.school === 'CENTER' || q.school === 'Admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                    {q.school === 'CENTER' || q.school === 'Admin' ? 'ส่วนกลาง' : 'โรงเรียนเรา'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-300 font-mono">ID: {q.id}</span>
                                        </div>
                                        <p className="font-bold text-gray-800 mb-3 text-lg">{q.text}</p>
                                        {q.image && <img src={q.image} alt="question" className="h-32 object-contain rounded border mb-3" />}
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                            {q.choices.map((c, cIdx) => (
                                                <div key={c.id} className={`p-2 rounded border flex items-center gap-2 ${c.id === q.correctChoiceId ? 'bg-green-50 border-green-200 text-green-800 font-bold' : 'bg-white border-gray-100 text-gray-500'}`}>
                                                    <span className="font-bold text-gray-400 w-5 text-center">{['ก','ข','ค','ง'][cIdx]}.</span>
                                                    {c.text} {c.id === q.correctChoiceId && '✅'}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 text-xs text-gray-400">
                                            <span className="font-bold text-gray-500">เฉลย:</span> {q.explanation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* 3. Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t bg-gray-50 flex justify-center gap-4 items-center">
                                <button 
                                    onClick={() => setQBankPage(p => Math.max(1, p - 1))}
                                    disabled={qBankPage === 1}
                                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition"
                                >
                                    <ChevronLeft />
                                </button>
                                <span className="font-bold text-gray-600">หน้า {qBankPage} / {totalPages}</span>
                                <button 
                                    onClick={() => setQBankPage(p => Math.min(totalPages, p + 1))}
                                    disabled={qBankPage === totalPages}
                                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition"
                                >
                                    <ChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-2xl">
                        <FileText size={48} className="mx-auto mb-2 opacity-20" />
                        กรุณาเลือกวิชาเพื่อดูข้อสอบ
                    </div>
                )}
            </div>
            )}

        </div>
      )}

      {/* MODAL: View Progress */}
      {selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-fade-in">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Calendar size={20} className="text-blue-600"/> รายละเอียดการส่งงาน</h3>
                      <button onClick={() => setSelectedAssignment(null)} className="text-gray-400 hover:text-red-500 transition"><X size={24}/></button>
                  </div>
                  <div className="p-4 bg-blue-50 border-b">
                      <div className="font-bold text-blue-900 text-lg">{selectedAssignment.subject} ({selectedAssignment.questionCount} ข้อ)</div>
                      <div className="text-sm text-blue-700 mt-1">กำหนดส่ง: <b>{selectedAssignment.deadline}</b></div>
                  </div>
                  <div className="overflow-y-auto p-4 flex-1 bg-gray-50">
                      {students.length === 0 ? <div className="text-center py-10 text-gray-400">ไม่มีนักเรียนในโรงเรียนนี้</div> : (
                      <table className="w-full text-sm text-left bg-white rounded-xl shadow-sm">
                          <thead>
                              <tr className="text-gray-600 border-b bg-gray-100"><th className="p-3 rounded-tl-xl">ชื่อนักเรียน</th><th className="p-3 text-center">สถานะ</th><th className="p-3 text-right">คะแนน</th><th className="p-3 text-right rounded-tr-xl">เวลาที่ส่ง</th></tr>
                          </thead>
                          <tbody>
                              {students.map(s => {
                                  const result = stats.filter(r => r.assignmentId === selectedAssignment.id && String(r.studentId) === String(s.id)).pop();
                                  return (
                                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                          <td className="p-3 font-bold text-gray-800 flex items-center gap-2">
                                              <span className="text-xl">{s.avatar}</span> {s.name}
                                          </td>
                                          <td className="p-3 text-center">
                                              {result ? <span className="text-green-700 bg-green-100 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto border border-green-200"><CheckCircle size={12}/> ส่งแล้ว</span> : <span className="text-gray-500 flex items-center justify-center gap-1 text-xs"><Clock size={12}/> ยังไม่ส่ง</span>}
                                          </td>
                                          <td className="p-3 text-right font-bold text-blue-700">{result ? <span className="text-lg">{result.score}</span> : '-'}</td>
                                          <td className="p-3 text-right text-gray-600 text-xs">
                                              {result ? new Date(result.timestamp).toLocaleString('th-TH') : '-'}
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

// เมนูการ์ด (Helper Component)
const MenuCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void }> = ({ icon, title, desc, color, onClick }) => (
    <button onClick={onClick} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col items-start gap-3 ${color} bg-white`}>
        <div className="p-3 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm">{icon}</div>
        <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-xs opacity-80 font-medium">{desc}</p>
        </div>
    </button>
);

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold whitespace-nowrap transition flex-1 md:flex-none justify-center ${active ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100 bg-white border border-gray-100'}`}>{icon} {label}</button>
);

export default TeacherDashboard;