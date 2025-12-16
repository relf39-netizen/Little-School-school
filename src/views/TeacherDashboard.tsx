
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Teacher, Student, Assignment, Question, SubjectConfig, School, RegistrationRequest, SchoolStats } from '../types';
import { UserPlus, BarChart2, FileText, LogOut, Gamepad2, Calendar, User, Building, UserCog, MonitorSmartphone, Database, ArrowLeft, Trophy, UploadCloud, RefreshCw, AlertTriangle, ToggleLeft, ToggleRight, Trash2, Edit, PlusCircle, CreditCard, X, GraduationCap, KeyRound, Sparkles, List, CheckCircle, Clock, Wand2, BrainCircuit, Loader2, Save, Copy, Search, Eye } from 'lucide-react';
import { getTeacherDashboard, manageStudent, addAssignment, addQuestion, editQuestion, manageTeacher, getAllTeachers, deleteQuestion, deleteAssignment, getSubjects, addSubject, deleteSubject, getSchools, manageSchool, getRegistrationStatus, toggleRegistrationStatus, getPendingRegistrations, approveRegistration, rejectRegistration, verifyStudentLogin, getQuestionsBySubject, getAllSchoolStats } from '../services/api';
import { generateQuestionWithAI, GeneratedQuestion } from '../services/aiService';
import { supabase } from '../services/firebaseConfig';

import StudentManager from './teacher/StudentManager';
import SubjectManager from './teacher/SubjectManager';
import QuestionBank from './teacher/QuestionBank';
import AssignmentManager from './teacher/AssignmentManager';
import StatsViewer from './teacher/StatsViewer';

interface TeacherDashboardProps {
  teacher: Teacher;
  onLogout: () => void;
  onStartGame: () => void; 
  onAdminLoginAsStudent: (student: Student) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, onLogout, onStartGame, onAdminLoginAsStudent }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'students' | 'subjects' | 'stats' | 'questions' | 'assignments' | 'teachers' | 'registrations' | 'profile' | 'onet' | 'admin_stats' | 'monitor' | 'migration'>('menu');
  
  // ✅ Navigation State for Multi-Grade Views (Used by Admin Stats)
  const [viewLevel, setViewLevel] = useState<'GRADES' | 'LIST'>('GRADES');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subject Management
  const [availableSubjects, setAvailableSubjects] = useState<SubjectConfig[]>([]);
  
  // Teacher Management State
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolForView, setSelectedSchoolForView] = useState<string | null>(null); // To drill down
  const [newSchoolName, setNewSchoolName] = useState('');

  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherUser, setNewTeacherUser] = useState('');
  const [newTeacherPass, setNewTeacherPass] = useState('');
  const [newTeacherSchool, setNewTeacherSchool] = useState('');
  const [newTeacherGrades, setNewTeacherGrades] = useState<string[]>(['ALL']); 
  const [newTeacherRole, setNewTeacherRole] = useState<string>('TEACHER'); // Default role
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null); 
  
  // Registration Management
  const [regEnabled, setRegEnabled] = useState(false);
  const [pendingRegs, setPendingRegs] = useState<RegistrationRequest[]>([]);
  const [showApproveModal, setShowApproveModal] = useState<RegistrationRequest | null>(null);
  const [approveToSchool, setApproveToSchool] = useState('');

  // ✅ System Monitor Stats (Admin)
  const [schoolStats, setSchoolStats] = useState<SchoolStats[]>([]);

  // Migration State
  const [migrationFile, setMigrationFile] = useState<File | null>(null);
  const [migrationTarget, setMigrationTarget] = useState<string>('auto');
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);

  // Profile Management State
  const [profileName, setProfileName] = useState(teacher.name || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPass, setProfileConfirmPass] = useState('');

  // Admin Stats State
  const [impersonateId, setImpersonateId] = useState('');
  
  const [selectedStudentForStats, setSelectedStudentForStats] = useState<Student | null>(null);
  
  // ✅ New: State for viewing O-NET assignment scores
  const [viewingOnetAssignment, setViewingOnetAssignment] = useState<Assignment | null>(null);

  // ✅ Permissions Logic
  const getTeacherGrades = (t: Teacher): string[] => {
      if (!t.gradeLevel) return ['ALL'];
      return t.gradeLevel.split(',').map(g => g.trim());
  };

  const myGrades = getTeacherGrades(teacher);
  
  // Check for specific roles
  const isAdmin = (teacher.role && teacher.role.toUpperCase() === 'ADMIN') || (teacher.username && teacher.username.toLowerCase() === 'admin');
  const isDirector = teacher.role === 'DIRECTOR';
  
  // Director can manage all, just like someone with 'ALL' grade
  const canManageAll = myGrades.includes('ALL') || isDirector || isAdmin;

  // ✅ New Logic: O-NET Access (If teaches P6, M3, or is Admin/Director)
  const canAccessOnet = canManageAll || myGrades.includes('P6') || myGrades.includes('M3');

  // Processing UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // O-NET View State (O-NET features are partially inline here)
  const [onetSubjectFilter, setOnetSubjectFilter] = useState<string>('ALL');
  
  const hasP6 = myGrades.includes('P6');
  const hasM3 = myGrades.includes('M3');
  
  let defaultOnet = null;
  if (hasP6 && !hasM3) defaultOnet = 'P6';
  else if (!hasP6 && hasM3) defaultOnet = 'M3';
  
  const [onetLevel, setOnetLevel] = useState<string | null>(defaultOnet); 
  
  // O-NET Specific Assignment State
  const [assignTitle, setAssignTitle] = useState('');
  const [assignSubject, setAssignSubject] = useState<string>(''); 
  const [assignGrade, setAssignGrade] = useState<string>(canManageAll ? 'ALL' : (myGrades[0] || 'P6')); 
  const [assignCount, setAssignCount] = useState(10);
  const [assignDeadline, setAssignDeadline] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [assignAiTopic, setAssignAiTopic] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [newlyGeneratedQuestions, setNewlyGeneratedQuestions] = useState<GeneratedQuestion[]>([]);

  const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
  const GRADE_LABELS: Record<string, string> = { 
      'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
      'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' 
  };
  
  const ONET_SUBJECTS = ['คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์', 'ภาษาอังกฤษ'];

  const normalizeId = (id: any) => {
      if (id === undefined || id === null) return '';
      return String(id).trim();
  };

  useEffect(() => {
    loadData();
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setGeminiApiKey(savedKey);
  }, []);

  useEffect(() => {
      if (!canManageAll && myGrades.length > 0) {
          
          if (hasP6 && !hasM3) setOnetLevel('P6');
          else if (!hasP6 && hasM3) setOnetLevel('M3');
      }
  }, [teacher]);

  useEffect(() => {
      setProfileName(teacher.name || '');
  }, [teacher]);

  // ✅ Auto-select view mode based on permissions (For Admin Stats)
  useEffect(() => {
    // Reset view state on tab change
    setViewLevel('GRADES');
    setSelectedGradeFilter(null);
    setViewingOnetAssignment(null); // Reset O-NET viewer
    
    // Auto-drill down if single grade
    if (!canManageAll && myGrades.length === 1) {
        setViewLevel('LIST');
        setSelectedGradeFilter(myGrades[0]);
    }
  }, [activeTab]);
  
  // ✅ Fetch School Stats when Admin Monitor tab is active
  const fetchMonitorStats = async () => {
      if (isAdmin) {
          const data = await getAllSchoolStats();
          setSchoolStats(data);
      }
  };

  useEffect(() => {
      if (activeTab === 'monitor') {
          fetchMonitorStats();
      }
  }, [activeTab, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    const data = await getTeacherDashboard(teacher.school);
    const subs = await getSubjects(teacher.school);
    
    // Ensure Admin Data Loads Correctly
    if (isAdmin) {
        try {
            const tList = await getAllTeachers();
            setAllTeachers(tList);
            const sList = await getSchools();
            setSchools(sList);
            const regStatus = await getRegistrationStatus();
            setRegEnabled(regStatus);
            const pending = await getPendingRegistrations();
            setPendingRegs(pending);
        } catch (e) {
            console.error("Admin data load error", e);
        }
    }
    
    const filteredSubjects = subs.filter(s => {
        if (canManageAll) return true;
        return myGrades.includes(s.grade) || s.teacherId === normalizeId(teacher.id) || s.grade === 'ALL';
    });

    setAvailableSubjects(filteredSubjects);
    
    const myStudents = (data.students || []).filter((s: Student) => {
        const sSchool = String(s.school || '').trim();
        const tSchool = String(teacher.school || '').trim();
        if (sSchool !== tSchool) return false;
        if (!canManageAll) {
            return myGrades.includes(s.grade || '');
        }
        return true; 
    });
    
    setStudents(myStudents);
    setStats(data.results || []);
    setAssignments(data.assignments || []); 
    
    setLoading(false);
  };

  // ✅ Helper for Admin Stats Modal
  const getStudentSubjectStats = (studentId: string) => {
    const studentResults = stats.filter(r => String(r.studentId) === String(studentId));
    const subjectsMap: any = {};
    studentResults.forEach(r => {
        if (!subjectsMap[r.subject]) subjectsMap[r.subject] = { name: r.subject, attempts: 0, totalScore: 0 };
        const totalQ = Number(r.totalQuestions);
        const score = Number(r.score) || 0;
        if (totalQ > 0) subjectsMap[r.subject].totalScore += (score / totalQ) * 100;
        subjectsMap[r.subject].attempts++;
    });
    return Object.values(subjectsMap).map((s:any) => {
        let avg = s.attempts > 0 ? Math.round(s.totalScore / s.attempts) : 0;
        if (isNaN(avg) || !isFinite(avg)) avg = 0;
        return { ...s, average: avg };
    });
  };
  
  // ✅ UPDATED: Calculate O-NET Stats from REAL DATA
  const getOnetStats = () => {
      // 1. Filter Assignments that are O-NET related
      const onetAssignments = assignments.filter(a => a.title && a.title.startsWith('[O-NET]'));
      const onetAssignIds = new Set(onetAssignments.map(a => a.id));
      
      // 2. Filter Results that match these assignments
      const onetResults = stats.filter(r => onetAssignIds.has(r.assignmentId));
      
      const data: Record<string, Record<string, {sum: number, count: number}>> = {
          'P6': {}, 'M3': {}
      };
      
      // Initialize
      ONET_SUBJECTS.forEach(s => {
          data['P6'][s] = {sum:0, count:0};
          data['M3'][s] = {sum:0, count:0};
      });

      onetResults.forEach(r => {
          const student = students.find(s => String(s.id) === String(r.studentId));
          // If student grade matches P6 or M3
          if (student && (student.grade === 'P6' || student.grade === 'M3')) {
              const g = student.grade;
              let s = r.subject; 
              
              // Normalize Subject Names (Database might return English enum)
              if (s === 'MATH' || s === 'Mathematics') s = 'คณิตศาสตร์';
              if (s === 'THAI') s = 'ภาษาไทย';
              if (s === 'SCIENCE') s = 'วิทยาศาสตร์';
              if (s === 'ENGLISH') s = 'ภาษาอังกฤษ';

              if (data[g] && data[g][s]) {
                  const totalQ = Number(r.totalQuestions);
                  if (totalQ > 0) {
                      data[g][s].sum += (r.score / totalQ) * 100;
                      data[g][s].count++;
                  }
              }
          }
      });
      return data;
  };

  const getStudentOverallStats = (studentId: string) => {
    const studentResults = stats.filter(r => String(r.studentId) === String(studentId));
    const attempts = studentResults.length;
    let average = 0;
    if (attempts > 0) {
        const sum = studentResults.reduce((acc, curr) => {
            const totalQ = Number(curr.totalQuestions);
            const score = Number(curr.score) || 0;
            if (totalQ > 0) return acc + ((score / totalQ) * 100);
            return acc;
        }, 0);
        average = Math.round(sum / attempts);
    }
    return { attempts, average: (isNaN(average) || !isFinite(average)) ? 0 : average };
  };

  const handleImpersonate = async () => {
    if (!impersonateId) return alert('กรุณากรอกรหัสนักเรียน');
    if (impersonateId.length !== 5) return alert('รหัสนักเรียนต้องมี 5 หลัก');
    setIsProcessing(true);
    // Try to find in loaded list first
    let target = students.find(s => s.id === impersonateId);
    if (!target) { 
        // If not found locally, try fetch
        const res = await verifyStudentLogin(impersonateId); 
        if (res.student) target = res.student; 
        else if (res.error) alert(res.error);
    }
    setIsProcessing(false);
    if (target) { if (confirm(`เข้าสู่หน้าจอของนักเรียน: ${target.name} (${target.id})?`)) onAdminLoginAsStudent(target); } 
    // Alert handled above
  };

  const handleUpdateProfile = async () => {
      if (!profileName) return alert('กรุณากรอกชื่อ');
      if (profilePassword && profilePassword !== profileConfirmPass) return alert('รหัสผ่านไม่ตรงกัน');
      setIsProcessing(true);
      const res = await manageTeacher({ action: 'edit', id: String(teacher.id), name: profileName, password: profilePassword || undefined });
      setIsProcessing(false);
      if (res.success) { alert('✅ บันทึกข้อมูลเรียบร้อย (กรุณาเข้าสู่ระบบใหม่เพื่อเห็นการเปลี่ยนแปลง)'); setProfilePassword(''); setProfileConfirmPass(''); } 
      else alert('เกิดข้อผิดพลาด: ' + (res.message || 'Unknown error'));
  };

  const handleAddSchool = async () => { if (!newSchoolName) return; setIsProcessing(true); await manageSchool({ action: 'add', name: newSchoolName }); setIsProcessing(false); setNewSchoolName(''); loadData(); };
  const handleDeleteSchool = async (id: string) => { if (!confirm('ลบโรงเรียนนี้?')) return; await manageSchool({ action: 'delete', id }); loadData(); }
  const handleToggleSchoolStatus = async (school: School) => {
       const newStatus = school.status === 'inactive' ? 'active' : 'inactive';
       if (!confirm(newStatus === 'inactive' ? `ระงับการใช้งาน ${school.name}?` : `เปิดใช้งาน ${school.name}?`)) return;
       setIsProcessing(true);
       await manageSchool({ action: 'edit', id: school.id, status: newStatus });
       setIsProcessing(false);
       loadData();
  };

  const handleToggleReg = async () => { const newState = !regEnabled; setRegEnabled(newState); await toggleRegistrationStatus(newState); };
  const handleApproveReg = async () => { if (!showApproveModal || !approveToSchool) return alert('เลือกโรงเรียนก่อนอนุมัติ'); setIsProcessing(true); const success = await approveRegistration(showApproveModal, approveToSchool); setIsProcessing(false); if (success) { alert('✅ อนุมัติเรียบร้อย รหัสผ่านคือ 123456'); setShowApproveModal(null); setApproveToSchool(''); loadData(); } else { alert('เกิดข้อผิดพลาด'); } };
  const handleRejectReg = async (id: string) => { if (!confirm('ปฏิเสธคำขอนี้?')) return; await rejectRegistration(id); loadData(); };
  const toggleTeacherGrade = (grade: string) => { setNewTeacherGrades(prev => { if (grade === 'ALL') return ['ALL']; let newGrades = prev.filter(g => g !== 'ALL'); if (newGrades.includes(grade)) { newGrades = newGrades.filter(g => g !== grade); } else { newGrades.push(grade); } if (newGrades.length === 0) return ['ALL']; return newGrades; }); };
  const handleSaveTeacher = async () => { if (!newTeacherName || !newTeacherUser) return alert('กรุณากรอกชื่อและ Username'); if (!editingTeacherId && !newTeacherPass) return alert('กรุณากำหนดรหัสผ่านสำหรับบัญชีใหม่'); setIsProcessing(true); const gradeLevelString = newTeacherGrades.join(','); const teacherData: any = { action: editingTeacherId ? 'edit' : 'add', id: editingTeacherId || undefined, name: newTeacherName, username: newTeacherUser, school: newTeacherSchool || teacher.school, role: newTeacherRole, gradeLevel: gradeLevelString }; if (newTeacherPass) teacherData.password = newTeacherPass; const res = await manageTeacher(teacherData); setIsProcessing(false); if (res.success) { alert(editingTeacherId ? '✅ แก้ไขข้อมูลบุคลากรเรียบร้อย' : '✅ เพิ่มบัญชีบุคลากรเรียบร้อย'); setNewTeacherName(''); setNewTeacherUser(''); setNewTeacherPass(''); if(!selectedSchoolForView) setNewTeacherSchool(''); setNewTeacherGrades(['ALL']); setNewTeacherRole('TEACHER'); setEditingTeacherId(null); loadData(); } else { alert('เกิดข้อผิดพลาด: ' + (res.message || 'Unknown error')); } };
  const handleEditTeacher = (t: Teacher) => { setEditingTeacherId(String(t.id)); setNewTeacherName(t.name); setNewTeacherUser(t.username || ''); setNewTeacherPass(''); setNewTeacherSchool(t.school); setNewTeacherRole(t.role || 'TEACHER'); if (t.gradeLevel) { setNewTeacherGrades(t.gradeLevel.split(',').map(g => g.trim())); } else { setNewTeacherGrades(['ALL']); } document.getElementById('teacher-form')?.scrollIntoView({ behavior: 'smooth' }); };
  const handleDeleteTeacher = async (id: string) => { if (!confirm('ยืนยันลบข้อมูลครูท่านนี้?')) return; setIsProcessing(true); await manageTeacher({ action: 'delete', id }); setIsProcessing(false); loadData(); };
  
  const handleAiError = (e: any) => { console.error("AI Error:", e); alert("เกิดข้อผิดพลาด: " + (e?.message || JSON.stringify(e))); };
  
  const handleOnetGenerateQuestions = async () => { if (!geminiApiKey) return alert("กรุณาใส่ API Key"); if (!assignAiTopic) return alert("กรุณาระบุสาระ"); const gradeToGen = onetLevel || 'P6'; setIsGeneratingAi(true); try { const generated = await generateQuestionWithAI(assignSubject, gradeToGen, assignAiTopic, geminiApiKey, 5, 'onet'); if (generated) setNewlyGeneratedQuestions(prev => [...prev, ...generated]); } catch (e) { handleAiError(e); } finally { setIsGeneratingAi(false); } };
  const handleFinalizeAssignment = async () => { if (newlyGeneratedQuestions.length > 0) { setIsProcessing(true); const tid = normalizeId(teacher.id); for (const q of newlyGeneratedQuestions) { await addQuestion({ subject: assignSubject, grade: assignGrade, text: q.text, image: q.image || '', c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4, correct: q.correct, explanation: q.explanation, school: teacher.school, teacherId: tid }); } } setIsProcessing(true); let finalTitle = assignTitle; if (activeTab === 'onet') { if (!finalTitle) finalTitle = `[O-NET] ฝึกฝน${assignSubject} เรื่อง ${assignAiTopic || 'ทั่วไป'}`; else if (!finalTitle.startsWith('[O-NET]')) finalTitle = `[O-NET] ${finalTitle}`; } else { if (!finalTitle) finalTitle = `การบ้าน ${assignSubject}`; } const success = await addAssignment(teacher.school, assignSubject, assignGrade, assignCount, assignDeadline, teacher.name, finalTitle); setIsProcessing(false); if (success) { alert('✅ สั่งการบ้านเรียบร้อยแล้ว'); setAssignDeadline(''); setAssignTitle(''); setNewlyGeneratedQuestions([]); setAssignAiTopic(''); if (activeTab === 'onet') await loadData(); else { setActiveTab('assignments'); await loadData(); } } else { alert('เกิดข้อผิดพลาดในการสร้างการบ้าน'); } };
  const handleDeleteAssignment = async (id: string) => { if (!confirm('ยืนยันลบการบ้านนี้?')) return; setIsProcessing(true); const success = await deleteAssignment(id); setIsProcessing(false); if (success) { setAssignments(prev => prev.filter(a => a.id !== id)); loadData(); } };
  
  const handleRedoAssignment = async (original: Assignment) => {
        if(!confirm(`ต้องการมอบหมายงาน "${original.title || original.subject}" ให้นักเรียนทำอีกครั้งใช่ไหม?`)) return;
        
        setIsProcessing(true);
        const date = new Date();
        date.setDate(date.getDate() + 3);
        const newDeadline = date.toISOString().split('T')[0];
        
        const success = await addAssignment(original.school, original.subject, original.grade || 'ALL', original.questionCount, newDeadline, original.createdBy, original.title ? `${original.title} (รอบเพิ่มเติม)` : `${original.subject} (รอบเพิ่มเติม)`);
        
        if(success) { alert('✅ มอบหมายงานซ้ำเรียบร้อยแล้ว'); await loadData(); } else { alert('เกิดข้อผิดพลาดในการมอบหมายซ้ำ'); }
        setIsProcessing(false);
  };

  const handleMigration = async () => {
      if (!migrationFile) return alert("กรุณาเลือกไฟล์ JSON");
      setIsMigrating(true);
      const logs: string[] = [];
      const log = (msg: string) => { logs.push(msg); setMigrationLog([...logs]); };
      try {
          const text = await migrationFile.text();
          const json = JSON.parse(text);
          log(`Loaded file: ${migrationFile.name}`);
          const toArray = (obj: any) => { if (Array.isArray(obj)) return obj.filter(x => x); return Object.keys(obj).map(key => ({ id: key, ...obj[key] })); };
          if (migrationTarget === 'auto') {
              if (json.students) { log("Detected 'students' node..."); const rows = toArray(json.students); const { error } = await supabase.from('students').upsert(rows); if(error) log(`Error: ${error.message}`); else log(`✅ Imported ${rows.length} students.`); }
              if (json.teachers) { log("Detected 'teachers' node..."); const rows = toArray(json.teachers); const { error } = await supabase.from('teachers').upsert(rows); if(error) log(`Error: ${error.message}`); else log(`✅ Imported ${rows.length} teachers.`); }
              if (json.questions) { log("Detected 'questions' node..."); let rows = toArray(json.questions); rows = rows.map((q: any) => ({ id: q.id, subject: q.subject, text: q.text, grade: q.grade || 'P6', choices: JSON.stringify(q.choices), correct_choice_id: q.correctChoiceId, explanation: q.explanation, school: q.school, teacher_id: q.teacherId })); const { error } = await supabase.from('questions').upsert(rows); if(error) log(`Error: ${error.message}`); else log(`✅ Imported ${rows.length} questions.`); }
          } else {
               log(`Importing into '${migrationTarget}'...`);
               let rows = toArray(json);
               if (migrationTarget === 'questions') {
                    rows = rows.map((q: any) => ({ id: q.id, subject: q.subject, text: q.text, grade: q.grade || 'P6', choices: typeof q.choices === 'object' ? JSON.stringify(q.choices) : q.choices, correct_choice_id: q.correctChoiceId || q.correct_choice_id, explanation: q.explanation, school: q.school, teacher_id: q.teacherId || q.teacher_id }));
               }
               const { error } = await supabase.from(migrationTarget).upsert(rows);
               if(error) throw error;
               log(`✅ Imported ${rows.length} rows into ${migrationTarget}.`);
          }
          log("Migration Completed.");
      } catch (e: any) { log(`❌ Error: ${e.message}`); console.error(e); } finally { setIsMigrating(false); }
  };

  const formatDate = (dateString: string) => { if (!dateString) return '-'; const date = new Date(dateString); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); };
  
  // ✅ FIX: Deduplicate & Filter O-NET Assignments (Memoized)
  const filteredOnetAssignments = useMemo(() => {
      // 1. Filter O-NET
      let list = assignments.filter(a => a.title && a.title.startsWith('[O-NET]'));

      // 2. Filter by Grade (Important for P6 requirement)
      if (onetLevel) {
          list = list.filter(a => a.grade === onetLevel);
      }

      // 3. Filter by Subject
      if (onetSubjectFilter !== 'ALL') {
          list = list.filter(a => a.subject === onetSubjectFilter);
      }

      // 4. Deduplicate: Remove items with exact same Title, Subject, Grade, Deadline
      const seen = new Set();
      return list.filter(a => {
          const key = `${a.title?.trim()}|${a.subject}|${a.grade}|${a.deadline}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  }, [assignments, onetLevel, onetSubjectFilter]);

  // Filter students by selected Grade (For Admin Stats)
  const filteredStudents = students.filter(s => 
    selectedGradeFilter ? s.grade === selectedGradeFilter : true
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 relative">
       {isProcessing && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
             <div className="bg-white p-6 rounded-xl animate-bounce shadow-xl font-bold text-gray-700">{processingMessage || 'กำลังประมวลผล...'}</div>
        </div>
       )}
       
      {/* APPROVE REGISTRATION MODAL */}
      {showApproveModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="bg-green-600 p-4 text-white font-bold flex justify-between items-center">
                      <span>อนุมัติสมาชิกใหม่</span>
                      <button onClick={() => {setShowApproveModal(null); setApproveToSchool('');}}><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <div className="mb-4">
                          <div className="text-gray-500 text-xs">ชื่อ-นามสกุล</div>
                          <div className="font-bold text-lg">{showApproveModal.name} {showApproveModal.surname}</div>
                          <div className="text-gray-500 text-xs mt-2">เลขบัตรประชาชน</div>
                          <div className="font-mono bg-gray-100 p-2 rounded">{showApproveModal.citizenId}</div>
                      </div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">เลือกโรงเรียนสังกัด</label>
                      <select value={approveToSchool} onChange={e => setApproveToSchool(e.target.value)} className="w-full p-2 border rounded-lg bg-white mb-4">
                          <option value="">-- เลือกโรงเรียน --</option>
                          {schools.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      <button onClick={handleApproveReg} className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700">ยืนยันอนุมัติ</button>
                  </div>
              </div>
          </div>
      )}

      {/* ✅ Student Stats Modal (Added for Admin Stats View) */}
      {selectedStudentForStats && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-fade-in">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{selectedStudentForStats.avatar}</span>
                        <div>
                            <h3 className="font-bold text-lg">{selectedStudentForStats.name}</h3>
                            <p className="text-xs opacity-80">รหัส: {selectedStudentForStats.id} | ระดับ: {GRADE_LABELS[selectedStudentForStats.grade || ''] || selectedStudentForStats.grade}</p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedStudentForStats(null)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
                </div>
                <div className="p-4 overflow-y-auto bg-gray-50 flex-1">
                    <h4 className="font-bold text-gray-700 mb-2">คะแนนรายวิชา</h4>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {getStudentSubjectStats(selectedStudentForStats.id).map((s: any) => (
                            <div key={s.name} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                <div>
                                    <div className="text-sm font-bold text-gray-800">{s.name}</div>
                                    <div className="text-xs text-gray-500">สอบ {s.attempts} ครั้ง</div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-black ${s.average >= 80 ? 'text-green-600' : s.average >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{s.average}%</div>
                                    <div className="text-[10px] text-gray-400">เฉลี่ย</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <h4 className="font-bold text-gray-700 mb-2">ประวัติการสอบล่าสุด</h4>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2">วิชา</th><th className="p-2 text-center">คะแนน</th><th className="p-2 text-right">วันที่</th></tr></thead>
                            <tbody>
                                {stats
                                  .filter(r => String(r.studentId) === String(selectedStudentForStats.id))
                                  .sort((a, b) => b.timestamp - a.timestamp)
                                  .slice(0, 10)
                                  .map((r, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="p-2">{r.subject}</td>
                                        <td className="p-2 text-center"><span className="font-bold">{r.score}</span><span className="text-gray-400">/{r.totalQuestions}</span></td>
                                        <td className="p-2 text-right text-xs text-gray-500">
                                          {new Date(r.timestamp).toLocaleDateString('th-TH', { 
                                              day: 'numeric', 
                                              month: 'short', 
                                              year: '2-digit' 
                                          })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* ✅ O-NET View Scores Modal */}
      {viewingOnetAssignment && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
                <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
                    <div>
                        <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2">
                            <Trophy size={20} className="text-yellow-500"/> 
                            {viewingOnetAssignment.title || viewingOnetAssignment.subject}
                        </h3>
                        <p className="text-xs text-indigo-600">
                            {GRADE_LABELS[viewingOnetAssignment.grade || 'ALL'] || viewingOnetAssignment.grade} | 
                            ส่งภายใน: {formatDate(viewingOnetAssignment.deadline)}
                        </p>
                    </div>
                    <button onClick={() => setViewingOnetAssignment(null)} className="text-gray-400 hover:text-red-500 p-2"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-0 bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold sticky top-0 border-b">
                            <tr><th className="p-4">รายชื่อนักเรียน</th><th className="p-4 text-center">สถานะ</th><th className="p-4 text-right">คะแนน</th><th className="p-4 text-right">ส่งเมื่อ</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {students
                                .filter(s => !viewingOnetAssignment.grade || viewingOnetAssignment.grade === 'ALL' || s.grade === viewingOnetAssignment.grade)
                                .map(s => {
                                    const results = stats.filter(r => String(r.studentId) === String(s.id) && r.assignmentId === viewingOnetAssignment.id);
                                    const result = results.length > 0 ? results[results.length - 1] : undefined;
                                    return (
                                        <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-4 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg shadow-sm border">{s.avatar}</div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{s.name}</div>
                                                    <div className="text-xs text-gray-400">ID: {s.id}</div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {result ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto border border-green-200"><CheckCircle size={12}/> ส่งแล้ว</span> 
                                                : <span className="bg-gray-100 text-gray-400 px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto"><Clock size={12}/> รอส่ง</span>}
                                            </td>
                                            <td className="p-4 text-right">
                                                {result ? <span className="font-black text-indigo-600 text-lg">{result.score}/{result.totalQuestions}</span> : '-'}
                                            </td>
                                            <td className="p-4 text-right text-gray-500 text-xs">
                                                {result ? new Date(result.timestamp).toLocaleString('th-TH') : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>,
        document.body
      )}

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-b-3xl md:rounded-3xl shadow-lg mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><GraduationCap size={28} /> ห้องพักครู</h2>
          <div className="opacity-90 text-sm mt-1 flex gap-2 items-center">
             <span>{teacher.school} • คุณครู{teacher.name}</span>
             <span className={`px-2 py-0.5 rounded text-xs font-bold ${canManageAll ? 'bg-yellow-400 text-yellow-900' : 'bg-green-400 text-green-900'}`}>
                 {isDirector ? 'ผู้อำนวยการ' : (canManageAll ? 'ดูแลทุกชั้น' : `ดูแล ${myGrades.join(', ')}`)}
             </span>
          </div>
        </div>
        <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition backdrop-blur-sm"><LogOut size={20} /></button>
      </div>

      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0">
            {/* Conditional Rendering for Subject/Director Card */}
            {isDirector ? (
                <MenuCard 
                    icon={<BarChart2 size={40} />} 
                    title="สถิติและการพัฒนาผู้เรียน (สำหรับผู้บริหาร)" 
                    desc="ดูค่าเฉลี่ยและพัฒนาการผู้เรียนในแต่ละระดับชั้น" 
                    color="bg-orange-50 text-orange-600 border-orange-200" 
                    onClick={() => { setActiveTab('admin_stats'); setViewLevel('GRADES'); }} 
                />
            ) : (
                <MenuCard 
                    icon={<List size={40} />} 
                    title="จัดการรายวิชา" 
                    desc="เพิ่ม/ลบ รายวิชาที่สอน" 
                    color="bg-pink-50 text-pink-600 border-pink-200" 
                    onClick={() => setActiveTab('subjects')} 
                />
            )}

            <MenuCard 
                icon={<UserPlus size={40} />} 
                title="จัดการนักเรียน" 
                desc="ลงทะเบียนและแก้ไขข้อมูล" 
                color="bg-purple-50 text-purple-600 border-purple-200" 
                onClick={() => { setActiveTab('students'); }} 
            />
            <MenuCard icon={<Calendar size={40} />} title="สั่งการบ้าน" desc="มอบหมายงานและติดตาม" color="bg-orange-50 text-orange-600 border-orange-200" onClick={() => { setActiveTab('assignments'); setAssignTitle(''); setNewlyGeneratedQuestions([]); }} />
            <MenuCard icon={<BarChart2 size={40} />} title="ดูผลคะแนน" desc="สถิติการสอบ" color="bg-green-50 text-green-600 border-green-200" onClick={() => setActiveTab('stats')} />
            <MenuCard icon={<FileText size={40} />} title="คลังข้อสอบ" desc="เพิ่มและจัดการข้อสอบ" color="bg-blue-50 text-blue-600 border-blue-200" onClick={() => setActiveTab('questions')} />
            <MenuCard icon={<Gamepad2 size={40} />} title="จัดกิจกรรมเกม" desc="เปิดห้องแข่งขัน Real-time" color="bg-yellow-50 text-yellow-600 border-yellow-200" onClick={onStartGame} />
            
            <MenuCard 
                icon={<User size={40} />} 
                title="ข้อมูลส่วนตัว" 
                desc="แก้ไขชื่อ / รหัสผ่าน" 
                color="bg-teal-50 text-teal-600 border-teal-200" 
                onClick={() => { setActiveTab('profile'); setProfileName(teacher.name || ''); setProfilePassword(''); setProfileConfirmPass(''); }} 
            />

            {/* ✅ P-Chat (O-NET) Button: Visible only if permission allows */}
            {canAccessOnet && (
            <MenuCard 
                icon={<Trophy size={40} />} 
                title={onetLevel ? `พิชิต O-NET ${GRADE_LABELS[onetLevel]}` : "พิชิต O-NET"} 
                desc="สร้างข้อสอบติวเข้ม O-NET ด้วย AI" 
                color="bg-indigo-50 text-indigo-600 border-indigo-200 shadow-indigo-100" 
                onClick={() => { setActiveTab('onet'); setNewlyGeneratedQuestions([]); }} 
            />
            )}

            {/* ✅ Admin Stats Card - Only for System Admin (Role Admin) - Director has their own card now */}
            {isAdmin && !isDirector && (
                <MenuCard 
                  icon={<BarChart2 size={40} />} 
                  title="สถิติโรงเรียน (Admin)" 
                  desc="ดูภาพรวมและเข้าถึงมุมมองนักเรียน" 
                  color="bg-orange-50 text-orange-600 border-orange-200 shadow-orange-100" 
                  onClick={() => { setActiveTab('admin_stats'); setViewLevel('GRADES'); }} 
                />
            )}

            {/* Admin Only Card */}
            {isAdmin && (
                <>
                <MenuCard 
                  icon={<Building size={40} />} 
                  title="จัดการข้อมูลครู" 
                  desc="จัดการโรงเรียนและครู" 
                  color="bg-gray-100 text-gray-700 border-gray-300" 
                  onClick={() => {setActiveTab('teachers'); setSelectedSchoolForView(null);}} 
                />
                <MenuCard 
                  icon={<UserCog size={40} />} 
                  title="ระบบรับสมัครสมาชิก" 
                  desc={`รออนุมัติ ${pendingRegs.length} คน`}
                  color="bg-red-50 text-red-600 border-red-200" 
                  onClick={() => setActiveTab('registrations')} 
                />
                <MenuCard 
                  icon={<MonitorSmartphone size={40} />} 
                  title="System Monitor" 
                  desc="ติดตามการใช้งานระบบ (Admin Only)"
                  color="bg-slate-700 text-white border-slate-600" 
                  onClick={() => setActiveTab('monitor')} 
                />
                <MenuCard 
                  icon={<Database size={40} />} 
                  title="นำเข้าข้อมูลเก่า" 
                  desc="นำเข้าไฟล์ JSON จาก Firebase"
                  color="bg-emerald-50 text-emerald-600 border-emerald-200" 
                  onClick={() => setActiveTab('migration')} 
                />
                </>
            )}
        </div>
      )}

      {activeTab !== 'menu' && (
        <div className="bg-white rounded-3xl shadow-sm p-4 md:p-6 min-h-[400px] relative animate-fade-in">
            <button onClick={() => { setActiveTab('menu'); setSelectedStudentForStats(null); setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-purple-600 font-bold transition-colors"><div className="bg-gray-100 p-2 rounded-full"><ArrowLeft size={20} /></div> กลับเมนูหลัก</button>
            
            {activeTab === 'students' && (
                <StudentManager 
                    students={students} 
                    teacher={teacher} 
                    canManageAll={canManageAll} 
                    myGrades={myGrades} 
                    isDirector={isDirector}
                    onRefresh={loadData}
                    onAdminLoginAsStudent={onAdminLoginAsStudent}
                />
            )}

            {activeTab === 'subjects' && (
                <SubjectManager 
                    subjects={availableSubjects} 
                    teacher={teacher} 
                    canManageAll={canManageAll} 
                    myGrades={myGrades} 
                    onRefresh={loadData} 
                />
            )}

            {activeTab === 'questions' && (
                <QuestionBank 
                    subjects={availableSubjects} 
                    teacher={teacher} 
                    canManageAll={canManageAll} 
                    myGrades={myGrades} 
                />
            )}

            {activeTab === 'assignments' && (
                <AssignmentManager 
                    assignments={assignments}
                    subjects={availableSubjects}
                    students={students}
                    stats={stats}
                    teacher={teacher}
                    canManageAll={canManageAll}
                    myGrades={myGrades}
                    onRefresh={loadData}
                />
            )}

            {activeTab === 'stats' && (
                <StatsViewer 
                    students={students}
                    stats={stats}
                    availableSubjects={availableSubjects}
                    canManageAll={canManageAll}
                    myGrades={myGrades}
                    onRefresh={loadData}
                />
            )}

            {/* MIGRATION TAB */}
            {activeTab === 'migration' && isAdmin && (
                <div className="max-w-4xl mx-auto">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-8">
                        <h3 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2"><Database/> นำเข้าข้อมูลเก่า (Migration)</h3>
                        <p className="text-emerald-700 text-sm mb-6">เครื่องมือสำหรับนำเข้าข้อมูลจาก Firebase Realtime Database (JSON Export) เข้าสู่ Supabase</p>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">1. เลือกประเภทข้อมูลที่ต้องการนำเข้า</label>
                                <select value={migrationTarget} onChange={e => setMigrationTarget(e.target.value)} className="w-full p-3 border rounded-xl bg-white mb-4">
                                    <option value="auto">⚡ Auto Detect (ตรวจสอบอัตโนมัติ)</option>
                                    <option value="students">👨‍🎓 นักเรียน (Students)</option>
                                    <option value="teachers">👩‍🏫 ครู/บุคลากร (Teachers)</option>
                                    <option value="questions">📝 ข้อสอบ (Questions)</option>
                                    <option value="schools">🏫 โรงเรียน (Schools)</option>
                                    <option value="subjects">📚 วิชา (Subjects)</option>
                                </select>

                                <label className="block text-sm font-bold text-gray-700 mb-2">2. เลือกไฟล์ JSON</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 hover:bg-white transition cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        onChange={e => setMigrationFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <UploadCloud size={32} className="mx-auto text-gray-400 mb-2"/>
                                    {migrationFile ? (
                                        <span className="font-bold text-emerald-600">{migrationFile.name}</span>
                                    ) : (
                                        <span className="text-gray-500 text-sm">คลิกเพื่อเลือกไฟล์ .json</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-col justify-end">
                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-xs text-yellow-800 mb-4">
                                    <strong className="flex items-center gap-1 mb-1"><AlertTriangle size={14}/> คำเตือน:</strong>
                                    ข้อมูลที่มี ID ซ้ำกันจะถูกเขียนทับ (Upsert) กรุณาตรวจสอบความถูกต้องก่อนนำเข้า
                                </div>
                                <button 
                                    onClick={handleMigration}
                                    disabled={!migrationFile || isMigrating}
                                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isMigrating ? <RefreshCw className="animate-spin"/> : <Database/>}
                                    {isMigrating ? 'กำลังนำเข้าข้อมูล...' : 'เริ่มนำเข้าข้อมูล'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Logs */}
                    <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 h-64 overflow-y-auto border border-slate-700 shadow-inner">
                        <div className="text-slate-500 border-b border-slate-700 pb-2 mb-2">Migration Logs...</div>
                        {migrationLog.length === 0 ? (
                            <div className="opacity-30 italic">Ready to start...</div>
                        ) : (
                            migrationLog.map((log, i) => <div key={i} className="mb-1">{log}</div>)
                        )}
                    </div>
                </div>
            )}
            
            {/* ✅ SYSTEM MONITOR TAB */}
            {activeTab === 'monitor' && isAdmin && (
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                         <div className="flex items-center gap-3">
                            <div className="bg-slate-700 p-3 rounded-full text-white"><MonitorSmartphone size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">System Monitor (ระบบติดตามการใช้งาน)</h3>
                                <p className="text-gray-500">ตรวจสอบปริมาณการใช้งานของแต่ละโรงเรียน (Real-time)</p>
                            </div>
                         </div>
                         <button onClick={fetchMonitorStats} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition">
                             <RefreshCw size={18}/> รีเฟรชข้อมูลล่าสุด
                         </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div className="text-blue-500 text-sm font-bold uppercase">โรงเรียนที่ใช้งาน</div>
                            <div className="text-3xl font-black text-blue-700">{schoolStats.length} แห่ง</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                            <div className="text-green-500 text-sm font-bold uppercase">ยอดเข้าสู่ระบบรวม (ครั้ง)</div>
                            <div className="text-3xl font-black text-green-700">
                                {schoolStats.reduce((sum, s) => sum + (s.loginCount || 0), 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <div className="text-purple-500 text-sm font-bold uppercase">ยอดทำกิจกรรมรวม (ครั้ง)</div>
                            <div className="text-3xl font-black text-purple-700">
                                {schoolStats.reduce((sum, s) => sum + (s.activityCount || 0), 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-700 font-bold">
                                <tr>
                                    <th className="p-4">โรงเรียน</th>
                                    <th className="p-4 text-center">เข้าสู่ระบบ (ครั้ง)</th>
                                    <th className="p-4 text-center">ทำกิจกรรม (ครั้ง)</th>
                                    <th className="p-4 text-right">ใช้งานล่าสุด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {schoolStats.length === 0 ? (
                                    <tr><td colSpan={4} className="p-10 text-center text-gray-400">ยังไม่มีข้อมูลการใช้งาน</td></tr>
                                ) : (
                                    schoolStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold text-gray-800">{stat.schoolName}</td>
                                            <td className="p-4 text-center">
                                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold text-sm">
                                                    {stat.loginCount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold text-sm">
                                                    {stat.activityCount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-sm text-gray-500 font-mono">
                                                {stat.lastActive ? new Date(stat.lastActive).toLocaleString('th-TH') : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ✅ REGISTRATIONS TAB */}
            {activeTab === 'registrations' && isAdmin && (
                <div className="max-w-4xl mx-auto">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <UserCog className="text-red-600"/> ระบบรับสมัครสมาชิก ({pendingRegs.length})
                    </h3>

                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-6 flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-red-900">สถานะการเปิดรับสมัคร</h4>
                            <p className="text-red-700 text-sm">เมื่อเปิดใช้งาน ผู้ใช้ทั่วไปจะสามารถส่งคำขอสมัครเป็นครูได้</p>
                        </div>
                        <button 
                            onClick={handleToggleReg} 
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${regEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${regEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {pendingRegs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                            <UserCog size={48} className="mx-auto mb-2 opacity-20"/>
                            <p>ไม่มีคำขอสมัครสมาชิกใหม่ในขณะนี้</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingRegs.map(reg => (
                                <div key={reg.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
                                    <div>
                                        <div className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                            {reg.name} {reg.surname}
                                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold">รออนุมัติ</span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1 flex flex-col sm:flex-row gap-2 sm:gap-6">
                                            <span className="flex items-center gap-1"><CreditCard size={14}/> {reg.citizenId}</span>
                                            <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(reg.timestamp).toLocaleDateString('th-TH')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button 
                                            onClick={() => setShowApproveModal(reg)} 
                                            className="flex-1 md:flex-none bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle size={16}/> อนุมัติ
                                        </button>
                                        <button 
                                            onClick={() => handleRejectReg(reg.id)} 
                                            className="flex-1 md:flex-none bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1"
                                        >
                                            <X size={16}/> ปฏิเสธ
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* O-NET TAB */}
            {activeTab === 'onet' && (
              <div className="max-w-4xl mx-auto">
                 <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-200 mb-8 shadow-sm">
                    {!onetLevel ? (
                        <div>
                            <h4 className="font-bold text-indigo-900 mb-6 flex items-center gap-2 text-xl"><Trophy className="text-yellow-500"/> เลือกระดับชั้นติว O-NET</h4>
                            <div className="grid md:grid-cols-2 gap-6">
                                <button onClick={() => { setOnetLevel('P6'); setAssignGrade('P6'); setNewlyGeneratedQuestions([]); }} className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition border-2 border-indigo-100 group text-center">
                                    <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <GraduationCap size={40} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 group-hover:text-indigo-700">พิชิต O-NET ป.6</h3>
                                    <p className="text-gray-500 mt-2">ประถมศึกษาปีที่ 6</p>
                                </button>
                                <button onClick={() => { setOnetLevel('M3'); setAssignGrade('M3'); setNewlyGeneratedQuestions([]); }} className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition border-2 border-indigo-100 group text-center">
                                    <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                        <GraduationCap size={40} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 group-hover:text-purple-700">พิชิต O-NET ม.3</h3>
                                    <p className="text-gray-500 mt-2">มัธยมศึกษาปีที่ 3</p>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {(!teacher.gradeLevel || teacher.gradeLevel === 'ALL') && (
                                <button onClick={() => setOnetLevel(null)} className="mb-4 flex items-center gap-1 text-indigo-600 font-bold hover:underline text-sm"><ArrowLeft size={16}/> กลับไปเลือกชั้น</button>
                            )}
                            <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2 text-xl"><Trophy className="text-yellow-500"/> ติวเข้มพิชิต O-NET ({GRADE_LABELS[onetLevel]})</h4>
                            
                            <div className="space-y-4">
                                <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm">
                                <div className="grid md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">วิชา (4 วิชาหลัก)</label>
                                        <select value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 outline-none">
                                            <option value="">-- เลือกวิชา --</option>
                                            {ONET_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">จำนวนข้อ</label>
                                        <input type="number" value={assignCount} onChange={(e) => setAssignCount(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white" min="5" max="20" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">กำหนดส่ง</label>
                                        <input type="date" value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">สาระที่ต้องการเน้น (Topic)</label>
                                        <input type="text" value={assignAiTopic} onChange={(e) => setAssignAiTopic(e.target.value)} placeholder="เช่น พีชคณิต, การอ่านจับใจความ" className="w-full p-2.5 rounded-lg border border-gray-300 bg-white outline-none" />
                                    </div>
                                </div>
                                
                                <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Google Gemini API Key</label>
                                        <div className="flex gap-2">
                                            <input type="password" value={geminiApiKey} onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }} className="flex-1 p-2 border rounded-lg text-sm bg-gray-50" placeholder="วาง API Key ที่นี่..." />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button 
                                        onClick={handleOnetGenerateQuestions}
                                        disabled={isGeneratingAi || !assignSubject || !assignAiTopic}
                                        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isGeneratingAi ? <RefreshCw className="animate-spin"/> : <Sparkles size={18}/>}
                                        สร้างข้อสอบ O-NET ด้วย AI
                                    </button>
                                </div>
                                
                                {newlyGeneratedQuestions.length > 0 && (
                                <div className="border rounded-xl overflow-hidden bg-white mt-6 shadow-md border-indigo-200">
                                    <div className="bg-indigo-50 p-3 flex justify-between items-center border-b border-indigo-100">
                                        <span className="font-bold text-indigo-900 text-sm">ตัวอย่างข้อสอบ ({newlyGeneratedQuestions.length} ข้อ)</span>
                                        <button onClick={() => setNewlyGeneratedQuestions([])} className="text-xs text-red-500 hover:underline">ล้างทั้งหมด</button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                                        {newlyGeneratedQuestions.map((q, i) => (
                                            <div key={i} className="p-3 border rounded-lg bg-gray-50 text-sm relative group">
                                                <div className="font-bold text-gray-800 pr-6">{i+1}. {q.text}</div>
                                                <div className="text-gray-500 text-xs mt-1">ตอบ: {q.correct} | {q.explanation}</div>
                                                <button onClick={() => setNewlyGeneratedQuestions(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 border-t bg-gray-50">
                                        <div className="mb-2">
                                            <label className="text-xs font-bold text-gray-500">ชื่อการบ้าน (ตั้งชื่ออัตโนมัติ)</label>
                                            <input 
                                            type="text" 
                                            value={assignTitle || `[O-NET] ฝึกฝน${assignSubject} เรื่อง ${assignAiTopic}`} 
                                            onChange={e => setAssignTitle(e.target.value)} 
                                            className="w-full p-2 border rounded-lg bg-white"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleFinalizeAssignment}
                                            disabled={isProcessing}
                                            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold shadow hover:bg-green-600 disabled:opacity-50 flex justify-center items-center gap-2"
                                        >
                                            {isProcessing ? 'กำลังบันทึก...' : <><Save size={20}/> บันทึกเป็นการบ้าน</>}
                                        </button>
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                    )}
                 </div>

                 {onetLevel && (
                 <div className="mt-8">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <List size={20}/> รายการติว O-NET ({filteredOnetAssignments.length})
                        </h3>
                     </div>
                     {filteredOnetAssignments.length === 0 ? (
                         <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl bg-gray-50">
                             ยังไม่มีรายการติว O-NET
                         </div>
                     ) : (
                         <div className="space-y-3">
                             {filteredOnetAssignments.slice().reverse().map(a => (
                                 <div key={a.id} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-md transition">
                                     <div className="mb-2 md:mb-0">
                                         <div className="font-bold text-indigo-900 text-lg">{a.title}</div>
                                         <div className="text-sm text-gray-500 flex gap-4">
                                             <span className="bg-indigo-50 text-indigo-600 px-2 rounded text-xs font-bold flex items-center">{a.subject}</span>
                                             <span>{a.questionCount} ข้อ</span>
                                             <span>กำหนดส่ง: {formatDate(a.deadline)}</span>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                          <button onClick={() => handleRedoAssignment(a)} className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-purple-100 flex items-center gap-1" title="มอบหมายซ้ำ"><Copy size={16}/></button>
                                          
                                          {/* ✅ UPDATED: View Score Button with Eye Icon */}
                                          <button 
                                              onClick={() => setViewingOnetAssignment(a)} 
                                              className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-100 flex items-center gap-1"
                                          >
                                              <Eye size={16}/> ดูคะแนน
                                          </button>

                                          {!isDirector && <button onClick={() => handleDeleteAssignment(a.id)} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-100"><Trash2 size={16}/></button>}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
                 )}
              </div>
            )}

            {/* ADMIN STATS & QUESTIONS */}
            {activeTab === 'admin_stats' && (isAdmin || isDirector) && (
                 <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-orange-100 p-3 rounded-full text-orange-600"><BarChart2 size={32}/></div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">สถิติและการพัฒนาผู้เรียน (สำหรับผู้บริหาร)</h3>
                            <p className="text-gray-500">ติดตามผลการเรียนและเข้าถึงข้อมูลเชิงลึกรายบุคคล</p>
                        </div>
                    </div>
                    
                    {/* ✅ O-NET Stats Section */}
                    {(() => {
                        const onetStatsData = getOnetStats();
                        return (
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Trophy className="text-indigo-600"/> สรุปผลการทดสอบ O-NET (จากผลการฝึกฝนจริง)
                                </h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {['P6', 'M3'].map(grade => (
                                        <div key={grade} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
                                            <h4 className="font-bold text-indigo-900 mb-4 text-lg border-b pb-2">ระดับชั้น {GRADE_LABELS[grade]}</h4>
                                            <div className="space-y-4">
                                                {ONET_SUBJECTS.map(subj => {
                                                    const info = onetStatsData[grade]?.[subj] || {sum:0, count:0};
                                                    const avg = info.count > 0 ? Math.round(info.sum / info.count) : 0;
                                                    return (
                                                        <div key={subj} className="flex items-center justify-between">
                                                            <span className="text-gray-600 font-medium">{subj}</span>
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                                    <div className={`h-full rounded-full transition-all duration-500 ${avg >= 50 ? 'bg-green-500' : 'bg-orange-500'}`} style={{width: `${avg}%`}}></div>
                                                                </div>
                                                                <span className="font-bold text-gray-800 w-10 text-right">{avg}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    <hr className="my-8 border-gray-100"/>

                    {/* ✅ Grade Cards Grid for Admins/Directors */}
                    {viewLevel === 'GRADES' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in mb-8">
                             {GRADES.map(g => {
                                 // Update getGradeStats logic to include ALL subjects
                                 const getGradeStats = (grade: string) => {
                                      const gradeStudents = students.filter(s => s.grade === grade);
                                      const studentIds = gradeStudents.map(s => s.id);
                                      const gradeResults = stats.filter(r => studentIds.includes(String(r.studentId)));
                                      
                                      let totalScorePercent = 0; 
                                      let count = 0;
                                      
                                      // 1. Identify ALL Subjects for this grade (from Available Subjects + Results)
                                      const distinctSubjects = new Set<string>();
                                      availableSubjects.forEach(s => {
                                          if (s.grade === 'ALL' || s.grade === grade) distinctSubjects.add(s.name);
                                      });
                                      gradeResults.forEach(r => distinctSubjects.add(r.subject));

                                      const subjectMap: Record<string, { sumPct: number, count: number }> = {};
                                      distinctSubjects.forEach(sub => { subjectMap[sub] = { sumPct: 0, count: 0 }; });

                                      gradeResults.forEach(r => {
                                          const totalQ = Number(r.totalQuestions); 
                                          const score = Number(r.score) || 0;
                                          if (totalQ > 0) { 
                                              const pct = (score / totalQ) * 100;
                                              totalScorePercent += pct; 
                                              count++; 
                                              
                                              if(subjectMap[r.subject]) {
                                                  subjectMap[r.subject].sumPct += pct;
                                                  subjectMap[r.subject].count++;
                                              }
                                          }
                                      });
                                      
                                      const avg = count > 0 ? Math.round(totalScorePercent / count) : 0;
                                      
                                      const subjectStats = Object.keys(subjectMap).map(sub => ({
                                          name: sub,
                                          avg: subjectMap[sub].count > 0 ? Math.round(subjectMap[sub].sumPct / subjectMap[sub].count) : 0,
                                          hasData: subjectMap[sub].count > 0
                                      })).sort((a,b) => {
                                          if (a.hasData && !b.hasData) return -1;
                                          if (!a.hasData && b.hasData) return 1;
                                          return b.avg - a.avg;
                                      });

                                      return { studentCount: gradeStudents.length, avgScore: avg, activityCount: count, subjectStats };
                                  };

                                 const gStats = getGradeStats(g);
                                 return (
                                    <button key={g} onClick={() => { setSelectedGradeFilter(g); setViewLevel('LIST'); }} className="bg-white hover:bg-orange-50 p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-orange-200 text-left group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-orange-50 p-2 rounded-lg text-orange-600 group-hover:bg-white"><GraduationCap size={24}/></div>
                                            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{GRADE_LABELS[g]}</span>
                                        </div>
                                        <div className="text-2xl font-black text-gray-800 mb-1">{gStats.avgScore}%</div>
                                        <div className="text-sm text-gray-500">คะแนนเฉลี่ยรวม</div>

                                        {/* Detailed Subject Breakdown with Visual Progress Bars */}
                                        {gStats.subjectStats.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                                                {gStats.subjectStats.map((s, idx) => {
                                                    // Color Logic
                                                    let barColor = 'bg-gray-200';
                                                    let textColor = 'text-gray-400';
                                                    let width = s.avg;
                                                    
                                                    if (s.hasData) {
                                                        if (s.avg >= 80) { barColor = 'bg-green-500'; textColor = 'text-green-600'; }
                                                        else if (s.avg >= 70) { barColor = 'bg-blue-500'; textColor = 'text-blue-600'; }
                                                        else if (s.avg >= 50) { barColor = 'bg-yellow-500'; textColor = 'text-yellow-600'; }
                                                        else { barColor = 'bg-red-500'; textColor = 'text-red-600'; }
                                                    } else {
                                                        width = 5; // Minimal visual
                                                    }

                                                    return (
                                                        <div key={idx} className="w-full">
                                                            <div className="flex justify-between items-center text-xs mb-1">
                                                                <span className={`font-medium truncate pr-2 ${s.hasData ? 'text-gray-700' : 'text-gray-400'}`}>{s.name}</span>
                                                                <span className={`font-bold ${textColor}`}>{s.hasData ? `${s.avg}%` : 'N/A'}</span>
                                                            </div>
                                                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                                                                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${s.hasData ? width : 0}%` }}></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        
                                        <div className="mt-4 pt-4 border-t border-dashed border-gray-100 flex justify-between text-xs font-medium text-gray-400">
                                            <span>นักเรียน {gStats.studentCount} คน</span>
                                            <span>กิจกรรม {gStats.activityCount}</span>
                                        </div>
                                    </button>
                                 );
                             })}
                        </div>
                    )}

                    {viewLevel === 'LIST' && (
                         <div className="animate-fade-in mb-8">
                             <button onClick={() => { setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="flex items-center gap-1 text-sm text-orange-600 hover:underline mb-4">
                                <ArrowLeft size={16}/> กลับไปเลือกชั้นเรียน
                             </button>
                             <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                 <BarChart2 className="text-orange-600"/> สรุปผลการเรียนชั้น {GRADE_LABELS[selectedGradeFilter || '']}
                             </h4>
                             {/* Reusing existing Stats Table Logic */}
                             {loading ? <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline mr-2"/> กำลังโหลด...</div> : (
                                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-orange-50 text-orange-800 font-bold border-b">
                                            <tr>
                                                <th className="p-4">นักเรียน</th>
                                                <th className="p-4 text-center">เข้าสอบ</th>
                                                <th className="p-4 text-right">คะแนนเฉลี่ยรวม</th>
                                                <th className="p-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">ไม่มีนักเรียนในชั้นนี้</td></tr> :
                                            filteredStudents.map(s => {
                                                const overall = getStudentOverallStats(s.id);
                                                return (
                                                    <tr key={s.id} className="hover:bg-gray-50 border-b last:border-0">
                                                        <td className="p-3 font-bold">{s.name}</td>
                                                        <td className="p-3 text-center">{overall.attempts} ครั้ง</td>
                                                        <td className="p-3 text-right font-black text-orange-600">{overall.average}%</td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => setSelectedStudentForStats(s)} className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition"><Search size={18}/></button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                             )}
                         </div>
                    )}

                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8 shadow-sm">
                        <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><KeyRound size={20}/> เข้าถึงมุมมองนักเรียน</h4>
                        <div className="flex gap-2 max-w-md">
                            <input 
                                type="text" 
                                value={impersonateId} 
                                onChange={e => setImpersonateId(e.target.value.replace(/[^0-9]/g, ''))}
                                maxLength={5}
                                placeholder="รหัสนักเรียน 5 หลัก" 
                                className="flex-1 p-3 rounded-xl border border-orange-200 focus:ring-2 focus:ring-orange-300 outline-none"
                            />
                            <button onClick={handleImpersonate} className="bg-orange-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-700 shadow-md">
                                เข้าสู่ระบบ
                            </button>
                        </div>
                        <p className="text-xs text-orange-600 mt-2">* ใช้สำหรับตรวจสอบความก้าวหน้าของนักเรียนรายบุคคลในมุมมองจริง</p>
                    </div>
                 </div>
            )}

            {activeTab === 'teachers' && isAdmin && (
                <div className="max-w-6xl mx-auto" id="teacher-form">
                    {!selectedSchoolForView ? (
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Building className="text-gray-600"/> จัดการโรงเรียน</h3>
                            
                            <div className="mb-6 flex gap-2">
                                <input type="text" value={newSchoolName} onChange={e=>setNewSchoolName(e.target.value)} placeholder="ชื่อโรงเรียนใหม่..." className="border p-2 rounded-lg flex-1"/>
                                <button onClick={handleAddSchool} className="bg-blue-600 text-white px-4 rounded-lg font-bold">เพิ่มโรงเรียน</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {schools.map(s => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => {setSelectedSchoolForView(s.name); setNewTeacherSchool(s.name);}} 
                                        className={`bg-white border rounded-xl p-6 shadow-sm hover:shadow-lg cursor-pointer transition group relative ${s.status === 'inactive' ? 'grayscale opacity-75 hover:grayscale-0 hover:opacity-100 border-red-200 bg-red-50' : 'hover:border-blue-300'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`p-3 rounded-full transition ${s.status === 'inactive' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                                <Building size={24}/>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-gray-800">{s.name}</h4>
                                                {s.status === 'inactive' && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold">ระงับการใช้งาน</span>}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500">{allTeachers.filter(t => t.school === s.name).length} คุณครู</p>
                                        
                                        <div className="absolute top-4 right-4 flex gap-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleToggleSchoolStatus(s); }} 
                                                className="text-gray-300 hover:text-blue-500 transition"
                                                title={s.status === 'inactive' ? "เปิดใช้งานโรงเรียน" : "ระงับการใช้งานโรงเรียน"}
                                            >
                                                {s.status === 'inactive' ? <ToggleLeft size={24} className="text-red-400"/> : <ToggleRight size={24} className="text-green-500"/>}
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSchool(s.id); }} 
                                                className="text-gray-300 hover:text-red-500 transition"
                                                title="ลบโรงเรียน"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* ... Teacher management logic (Unchanged) ... */}
                            <button onClick={() => {setSelectedSchoolForView(null); setNewTeacherSchool('');}} className="mb-4 text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"><ArrowLeft size={16}/> กลับไปหน้ารายชื่อโรงเรียน</button>
                            
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 flex items-center gap-3">
                                <Building className="text-blue-600" size={32}/>
                                <div>
                                    <h3 className="text-xl font-bold text-blue-900">{selectedSchoolForView}</h3>
                                    <p className="text-blue-700 text-sm">จัดการข้อมูลครูในโรงเรียนนี้</p>
                                </div>
                            </div>

                            <div className={`p-6 rounded-2xl border mb-8 shadow-sm transition-colors ${editingTeacherId ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-200'}`}>
                                <h4 className={`font-bold mb-4 flex items-center gap-2 ${editingTeacherId ? 'text-orange-800' : 'text-gray-700'}`}>
                                    {editingTeacherId ? <><Edit size={18}/> แก้ไขข้อมูลครู</> : <><PlusCircle size={18}/> เพิ่มบัญชีครู (ในโรงเรียนนี้)</>}
                                </h4>
                                <div className="grid md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อ-นามสกุล</label>
                                        <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder="เช่น ครูสมศรี ใจดี" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">Username (สำหรับเข้าสู่ระบบ)</label>
                                        <input type="text" value={newTeacherUser} onChange={e => setNewTeacherUser(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder="เช่น somsie" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">Password {editingTeacherId && '(เว้นว่างถ้าไม่เปลี่ยน)'}</label>
                                        <input type="text" value={newTeacherPass} onChange={e => setNewTeacherPass(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder={editingTeacherId ? "เว้นว่างไว้หากไม่เปลี่ยน" : "กำหนดรหัสผ่าน"} />
                                    </div>
                                    
                                    {/* Role Selection */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">ตำแหน่ง</label>
                                        <select value={newTeacherRole} onChange={(e) => setNewTeacherRole(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                                            <option value="TEACHER">คุณครู (Teacher)</option>
                                            <option value="DIRECTOR">ผู้อำนวยการ (Director)</option>
                                        </select>
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="text-xs font-bold text-gray-500 block mb-1">ระดับชั้นที่ดูแล (เลือกได้มากกว่า 1)</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {/* ALL Button */}
                                            <button 
                                                onClick={() => toggleTeacherGrade('ALL')}
                                                className={`px-2 py-1.5 text-xs font-bold rounded border transition ${newTeacherGrades.includes('ALL') ? 'bg-black text-white border-black' : 'bg-white text-gray-500'}`}
                                            >
                                                ทุกชั้น
                                            </button>
                                            {/* Grades */}
                                            {GRADES.map(g => (
                                                <button 
                                                    key={g}
                                                    onClick={() => toggleTeacherGrade(g)}
                                                    className={`px-2 py-1.5 text-xs font-bold rounded border transition ${newTeacherGrades.includes(g) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500'}`}
                                                >
                                                    {GRADE_LABELS[g]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {editingTeacherId && (
                                        <button onClick={() => { setEditingTeacherId(null); setNewTeacherName(''); setNewTeacherUser(''); setNewTeacherPass(''); setNewTeacherGrades(['ALL']); setNewTeacherRole('TEACHER'); }} className="px-6 py-2 bg-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-300">ยกเลิก</button>
                                    )}
                                    <button onClick={handleSaveTeacher} disabled={isProcessing} className={`flex-1 text-white py-2 rounded-lg font-bold shadow transition ${editingTeacherId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-800 hover:bg-black'}`}>
                                        {isProcessing ? 'กำลังบันทึก...' : (editingTeacherId ? 'บันทึกการแก้ไข' : '+ เพิ่มบัญชีบุคลากร')}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border overflow-hidden">
                                <div className="p-4 bg-gray-100 font-bold text-gray-600 border-b">รายชื่อบุคลากร ({allTeachers.filter(t => t.school === selectedSchoolForView).length})</div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500">
                                        <tr><th className="p-3">ชื่อ</th><th className="p-3">Username</th><th className="p-3">ตำแหน่ง</th><th className="p-3">ชั้นที่ดูแล</th><th className="p-3 text-right">จัดการ</th></tr>
                                    </thead>
                                    <tbody>
                                        {allTeachers.filter(t => t.school === selectedSchoolForView).map(t => (
                                            <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="p-3 font-bold">{t.name} {t.role === 'ADMIN' && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1 rounded ml-1">ADMIN</span>}</td>
                                                <td className="p-3 font-mono text-gray-500">{t.username}</td>
                                                <td className="p-3">
                                                    {t.role === 'DIRECTOR' ? <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-bold">ผู้อำนวยการ</span> : <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">คุณครู</span>}
                                                </td>
                                                <td className="p-3 text-gray-600">
                                                    <div className="flex flex-wrap gap-1">
                                                    {(!t.gradeLevel || t.gradeLevel === 'ALL') 
                                                        ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">ทุกชั้น</span>
                                                        : t.gradeLevel.split(',').map(g => (
                                                            <span key={g} className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600">{GRADE_LABELS[g.trim()] || g}</span>
                                                        ))
                                                    }
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {String(t.id) !== String(teacher.id) && t.role !== 'ADMIN' && (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleEditTeacher(t)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit size={16}/></button>
                                                            <button onClick={() => handleDeleteTeacher(String(t.id))} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

const MenuCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void }> = ({ icon, title, desc, color, onClick }) => (
    <button onClick={onClick} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col items-start gap-3 ${color} bg-white`}>
        <div className="p-3 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm">{icon}</div>
        <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-xs opacity-80 font-medium">{desc}</p>
        </div>
    </button>
);

export default TeacherDashboard;
