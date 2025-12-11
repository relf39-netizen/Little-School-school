
import React, { useState, useEffect } from 'react';
import { Teacher, Student, Assignment, Question, SubjectConfig, School, RegistrationRequest, SchoolStats } from '../types';
import { UserPlus, BarChart2, FileText, LogOut, Save, RefreshCw, Gamepad2, Calendar, Eye, CheckCircle, X, PlusCircle, ChevronLeft, ChevronRight, Book, Calculator, FlaskConical, Languages, ArrowLeft, ArrowRight, Users, GraduationCap, Trash2, Edit, UserCog, KeyRound, Sparkles, Wand2, Key, List, Trophy, User, Building, CreditCard, Search, Loader2, Clock, MonitorSmartphone, Database, UploadCloud, AlertTriangle, ToggleLeft, ToggleRight, PenTool, BrainCircuit, Copy } from 'lucide-react';
import { getTeacherDashboard, manageStudent, addAssignment, addQuestion, editQuestion, manageTeacher, getAllTeachers, deleteQuestion, deleteAssignment, getSubjects, addSubject, deleteSubject, getSchools, manageSchool, getRegistrationStatus, toggleRegistrationStatus, getPendingRegistrations, approveRegistration, rejectRegistration, verifyStudentLogin, getQuestionsBySubject, getAllSchoolStats } from '../services/api';
import { generateQuestionWithAI, GeneratedQuestion } from '../services/aiService';
import { supabase } from '../services/firebaseConfig';

interface TeacherDashboardProps {
  teacher: Teacher;
  onLogout: () => void;
  onStartGame: () => void; 
  onAdminLoginAsStudent: (student: Student) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, onLogout, onStartGame, onAdminLoginAsStudent }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'students' | 'subjects' | 'stats' | 'questions' | 'assignments' | 'teachers' | 'registrations' | 'profile' | 'onet' | 'admin_stats' | 'monitor' | 'migration'>('menu');
  
  // ✅ Navigation State for Multi-Grade Views
  const [viewLevel, setViewLevel] = useState<'GRADES' | 'LIST'>('GRADES');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  
  // ✅ Questions are loaded on demand to save bandwidth
  const [questions, setQuestions] = useState<Question[]>([]); 
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subject Management
  const [availableSubjects, setAvailableSubjects] = useState<SubjectConfig[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState('Book');
  const [newSubjectColor, setNewSubjectColor] = useState('bg-blue-100 text-blue-600');
  
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

  // Student Form & Management State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentAvatar, setNewStudentAvatar] = useState('👦');
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Processing UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Assignment Form
  const [assignStep, setAssignStep] = useState<1 | 2>(1); // 1: Info, 2: AI Generation
  const [assignTitle, setAssignTitle] = useState('');
  const [assignSubject, setAssignSubject] = useState<string>(''); // Dynamic Subject
  const [assignGrade, setAssignGrade] = useState<string>(canManageAll ? 'ALL' : (myGrades[0] || 'P6')); 
  const [assignCount, setAssignCount] = useState(10);
  const [assignDeadline, setAssignDeadline] = useState('');
  
  // Assignment AI State
  const [newlyGeneratedQuestions, setNewlyGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [assignAiTopic, setAssignAiTopic] = useState('');

  // Question Form
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qSubject, setQSubject] = useState<string>(''); // Dynamic Subject
  const [qGrade, setQGrade] = useState<string>(canManageAll ? 'P6' : (myGrades[0] || 'P6'));
  const [qText, setQText] = useState('');
  const [qImage, setQImage] = useState('');
  const [qChoices, setQChoices] = useState({c1:'', c2:'', c3:'', c4:''});
  const [qCorrect, setQCorrect] = useState('1');
  const [qExplain, setQExplain] = useState('');

  // AI Generator State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState<number>(5);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiPreviewQuestions, setAiPreviewQuestions] = useState<GeneratedQuestion[]>([]);
  const [aiSourceMode, setAiSourceMode] = useState<'bank' | 'assignment'>('bank'); 

  // Question Bank State
  const [qBankSubject, setQBankSubject] = useState<string | null>(null); 
  const [qBankPage, setQBankPage] = useState(1);
  const [showMyQuestionsOnly, setShowMyQuestionsOnly] = useState(true); // ✅ Default to TRUE as requested
  const ITEMS_PER_PAGE = 5;

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentModalTab, setAssignmentModalTab] = useState<'status' | 'questions'>('status');
  
  // Stats Modal State
  const [selectedStudentForStats, setSelectedStudentForStats] = useState<Student | null>(null);

  // O-NET View State
  const [onetSubjectFilter, setOnetSubjectFilter] = useState<string>('ALL');
  
  const hasP6 = myGrades.includes('P6');
  const hasM3 = myGrades.includes('M3');
  
  let defaultOnet = null;
  if (hasP6 && !hasM3) defaultOnet = 'P6';
  else if (!hasP6 && hasM3) defaultOnet = 'M3';
  
  const [onetLevel, setOnetLevel] = useState<string | null>(defaultOnet); 

  const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
  const GRADE_LABELS: Record<string, string> = { 
      'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
      'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' 
  };
  
  const ONET_SUBJECTS = ['คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์', 'ภาษาอังกฤษ'];

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
          const defaultGrade = myGrades[0];
          setAssignGrade(defaultGrade);
          setQGrade(defaultGrade);
          
          if (hasP6 && !hasM3) setOnetLevel('P6');
          else if (!hasP6 && hasM3) setOnetLevel('M3');
      }
  }, [teacher]);

  useEffect(() => {
      setProfileName(teacher.name || '');
  }, [teacher]);

  // ✅ Auto-select view mode based on permissions
  useEffect(() => {
    // Reset view state on tab change
    setViewLevel('GRADES');
    setSelectedGradeFilter(null);
    setEditingStudentId(null);
    setCreatedStudent(null);
    
    // Auto-drill down if single grade
    if (!canManageAll && myGrades.length === 1) {
        setViewLevel('LIST');
        setSelectedGradeFilter(myGrades[0]);
    }
  }, [activeTab]);

  // ✅ Lazy Loading for Questions when switching tabs/filtering
  useEffect(() => {
      const fetchQuestions = async () => {
          if (activeTab === 'questions' && qBankSubject) {
              setLoadingQuestions(true);
              try {
                  const data = await getQuestionsBySubject(qBankSubject);
                  setQuestions(data);
              } catch (e) {
                  console.error("Failed to load questions", e);
              } finally {
                  setLoadingQuestions(false);
              }
          } else if (activeTab === 'questions' && !qBankSubject) {
              setQuestions([]); // Clear if no subject
          }
      };
      fetchQuestions();
  }, [activeTab, qBankSubject]);
  
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
    
    if (filteredSubjects.length > 0) {
        setAssignSubject(filteredSubjects[0].name);
        setQSubject(filteredSubjects[0].name);
    }

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

  const getGradeStats = (grade: string) => {
      const gradeStudents = students.filter(s => s.grade === grade);
      const studentIds = gradeStudents.map(s => s.id);
      const gradeResults = stats.filter(r => studentIds.includes(String(r.studentId)));
      
      let totalScorePercent = 0; 
      let count = 0;
      
      // ✅ 1. Identify ALL Subjects for this grade (from Available Subjects + Results)
      const distinctSubjects = new Set<string>();
      // Add from available subjects for this grade
      availableSubjects.forEach(s => {
          if (s.grade === 'ALL' || s.grade === grade) distinctSubjects.add(s.name);
      });
      // Add from actual results (legacy coverage)
      gradeResults.forEach(r => distinctSubjects.add(r.subject));

      const subjectMap: Record<string, { sumPct: number, count: number }> = {};
      // Initialize map for all distinct subjects
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
          // Sort logic: Data first, then score
          if (a.hasData && !b.hasData) return -1;
          if (!a.hasData && b.hasData) return 1;
          return b.avg - a.avg;
      });

      return { studentCount: gradeStudents.length, avgScore: avg, activityCount: count, subjectStats };
  };

  // ✅ New Logic: Calculate O-NET Specific Stats
  const getOnetStats = () => {
      const onetAssignIds = new Set(assignments.filter(a => a.title && a.title.startsWith('[O-NET]')).map(a => a.id));
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
              const s = r.subject; // Should match ONET_SUBJECTS keys
              
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
  const handleAddSubject = async () => { if (!newSubjectName) return alert('กรุณากรอกชื่อวิชา'); setIsProcessing(true); const newSub: SubjectConfig = { id: Date.now().toString(), name: newSubjectName, school: teacher.school, teacherId: normalizeId(teacher.id), grade: canManageAll ? 'ALL' : (myGrades[0] || 'ALL'), icon: newSubjectIcon, color: newSubjectColor }; const success = await addSubject(teacher.school, newSub); setIsProcessing(false); if (success) { alert('✅ เพิ่มวิชาเรียบร้อย'); setNewSubjectName(''); loadData(); } else { alert('เกิดข้อผิดพลาด'); } };
  const handleDeleteSubject = async (subId: string) => { if (!confirm('ยืนยันการลบวิชานี้?')) return; setIsProcessing(true); await deleteSubject(teacher.school, subId); setIsProcessing(false); loadData(); };
  const toggleTeacherGrade = (grade: string) => { setNewTeacherGrades(prev => { if (grade === 'ALL') return ['ALL']; let newGrades = prev.filter(g => g !== 'ALL'); if (newGrades.includes(grade)) { newGrades = newGrades.filter(g => g !== grade); } else { newGrades.push(grade); } if (newGrades.length === 0) return ['ALL']; return newGrades; }); };
  const handleSaveTeacher = async () => { if (!newTeacherName || !newTeacherUser) return alert('กรุณากรอกชื่อและ Username'); if (!editingTeacherId && !newTeacherPass) return alert('กรุณากำหนดรหัสผ่านสำหรับบัญชีใหม่'); setIsProcessing(true); const gradeLevelString = newTeacherGrades.join(','); const teacherData: any = { action: editingTeacherId ? 'edit' : 'add', id: editingTeacherId || undefined, name: newTeacherName, username: newTeacherUser, school: newTeacherSchool || teacher.school, role: newTeacherRole, gradeLevel: gradeLevelString }; if (newTeacherPass) teacherData.password = newTeacherPass; const res = await manageTeacher(teacherData); setIsProcessing(false); if (res.success) { alert(editingTeacherId ? '✅ แก้ไขข้อมูลบุคลากรเรียบร้อย' : '✅ เพิ่มบัญชีบุคลากรเรียบร้อย'); setNewTeacherName(''); setNewTeacherUser(''); setNewTeacherPass(''); if(!selectedSchoolForView) setNewTeacherSchool(''); setNewTeacherGrades(['ALL']); setNewTeacherRole('TEACHER'); setEditingTeacherId(null); loadData(); } else { alert('เกิดข้อผิดพลาด: ' + (res.message || 'Unknown error')); } };
  const handleEditTeacher = (t: Teacher) => { setEditingTeacherId(String(t.id)); setNewTeacherName(t.name); setNewTeacherUser(t.username || ''); setNewTeacherPass(''); setNewTeacherSchool(t.school); setNewTeacherRole(t.role || 'TEACHER'); if (t.gradeLevel) { setNewTeacherGrades(t.gradeLevel.split(',').map(g => g.trim())); } else { setNewTeacherGrades(['ALL']); } document.getElementById('teacher-form')?.scrollIntoView({ behavior: 'smooth' }); };
  const handleDeleteTeacher = async (id: string) => { if (!confirm('ยืนยันลบข้อมูลครูท่านนี้?')) return; setIsProcessing(true); await manageTeacher({ action: 'delete', id }); setIsProcessing(false); loadData(); };
  const handleSaveStudent = async () => { if (!newStudentName) return; setIsSaving(true); const studentGrade = selectedGradeFilter || (canManageAll ? 'P6' : (myGrades[0] || 'P6')); if (editingStudentId) { const result = await manageStudent({ action: 'edit', id: editingStudentId, name: newStudentName, avatar: newStudentAvatar, school: teacher.school, grade: studentGrade, teacherId: normalizeId(teacher.id) }); if (result.success) { setStudents(prev => prev.map(s => s.id === editingStudentId ? { ...s, name: newStudentName, avatar: newStudentAvatar } : s)); setNewStudentName(''); setEditingStudentId(null); alert('✅ แก้ไขข้อมูลเรียบร้อย'); } else { alert('เกิดข้อผิดพลาดในการแก้ไข'); } } else { const result = await manageStudent({ action: 'add', name: newStudentName, school: teacher.school, avatar: newStudentAvatar, grade: studentGrade, teacherId: normalizeId(teacher.id) }); if (result.success && result.student) { setCreatedStudent(result.student); setStudents([...students, result.student]); setNewStudentName(''); } else { alert('เกิดข้อผิดพลาดในการบันทึก'); } } setIsSaving(false); };
  const handleEditStudent = (s: Student) => { setEditingStudentId(s.id); setNewStudentName(s.name); setNewStudentAvatar(s.avatar); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleCancelEdit = () => { setEditingStudentId(null); setNewStudentName(''); setNewStudentAvatar('👦'); };
  const handleDeleteStudent = async (id: string) => { if (isDirector) return alert("ผู้อำนวยการไม่สามารถลบนักเรียนได้"); if (!confirm('ยืนยันการลบนักเรียนคนนี้? ข้อมูลคะแนนจะหายไปทั้งหมด')) return; setIsProcessing(true); const result = await manageStudent({ action: 'delete', id }); setIsProcessing(false); if (result.success) { setStudents(prev => prev.filter(s => s.id !== id)); } else { alert('ลบไม่สำเร็จ'); } };
  
  const handleAiError = (e: any) => { console.error("AI Error:", e); alert("เกิดข้อผิดพลาด: " + (e?.message || JSON.stringify(e))); };
  
  const handleAssignGenerateQuestions = async () => { if (!geminiApiKey) return alert("กรุณาใส่ API Key"); if (!assignAiTopic) return alert("กรุณาระบุหัวข้อ"); setIsGeneratingAi(true); try { const generated = await generateQuestionWithAI(assignSubject, assignGrade, assignAiTopic, geminiApiKey, 5); if (generated) setNewlyGeneratedQuestions(prev => [...prev, ...generated]); } catch (e) { handleAiError(e); } finally { setIsGeneratingAi(false); } };
  const handleOnetGenerateQuestions = async () => { if (!geminiApiKey) return alert("กรุณาใส่ API Key"); if (!assignAiTopic) return alert("กรุณาระบุสาระ"); const gradeToGen = onetLevel || 'P6'; setIsGeneratingAi(true); try { const generated = await generateQuestionWithAI(assignSubject, gradeToGen, assignAiTopic, geminiApiKey, 5, 'onet'); if (generated) setNewlyGeneratedQuestions(prev => [...prev, ...generated]); } catch (e) { handleAiError(e); } finally { setIsGeneratingAi(false); } };
  const handleFinalizeAssignment = async () => { if (newlyGeneratedQuestions.length > 0) { setIsProcessing(true); const tid = normalizeId(teacher.id); for (const q of newlyGeneratedQuestions) { await addQuestion({ subject: assignSubject, grade: assignGrade, text: q.text, image: q.image || '', c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4, correct: q.correct, explanation: q.explanation, school: teacher.school, teacherId: tid }); } } setIsProcessing(true); let finalTitle = assignTitle; if (activeTab === 'onet') { if (!finalTitle) finalTitle = `[O-NET] ฝึกฝน${assignSubject} เรื่อง ${assignAiTopic || 'ทั่วไป'}`; else if (!finalTitle.startsWith('[O-NET]')) finalTitle = `[O-NET] ${finalTitle}`; } else { if (!finalTitle) finalTitle = `การบ้าน ${assignSubject}`; } const success = await addAssignment(teacher.school, assignSubject, assignGrade, assignCount, assignDeadline, teacher.name, finalTitle); setIsProcessing(false); if (success) { alert('✅ สั่งการบ้านเรียบร้อยแล้ว'); setAssignStep(1); setAssignDeadline(''); setAssignTitle(''); setNewlyGeneratedQuestions([]); setAssignAiTopic(''); if (activeTab === 'onet') await loadData(); else { setActiveTab('assignments'); await loadData(); } } else { alert('เกิดข้อผิดพลาดในการสร้างการบ้าน'); } };
  const handleDeleteAssignment = async (id: string) => { if (!confirm('ยืนยันลบการบ้านนี้?')) return; setIsProcessing(true); const success = await deleteAssignment(id); setIsProcessing(false); if (success) { setAssignments(prev => prev.filter(a => a.id !== id)); loadData(); } };
  const handleViewAssignment = (a: Assignment) => { setSelectedAssignment(a); setAssignmentModalTab('status'); };

  // ✅ New Redo Assignment Handler
  const handleRedoAssignment = async (original: Assignment) => {
        if(!confirm(`ต้องการมอบหมายงาน "${original.title || original.subject}" ให้นักเรียนทำอีกครั้งใช่ไหม?`)) return;
        
        setIsProcessing(true);
        // Default deadline: 3 days from now
        const date = new Date();
        date.setDate(date.getDate() + 3);
        const newDeadline = date.toISOString().split('T')[0];
        
        const success = await addAssignment(
            original.school,
            original.subject,
            original.grade || 'ALL',
            original.questionCount,
            newDeadline,
            original.createdBy,
            original.title ? `${original.title} (รอบเพิ่มเติม)` : `${original.subject} (รอบเพิ่มเติม)`
        );
        
        if(success) {
            alert('✅ มอบหมายงานซ้ำเรียบร้อยแล้ว');
            await loadData();
        } else {
            alert('เกิดข้อผิดพลาดในการมอบหมายซ้ำ');
        }
        setIsProcessing(false);
  };

  const handleSaveQuestion = async () => { if (!qText || !qChoices.c1 || !qChoices.c2 || !qSubject) return alert('กรุณากรอกข้อมูลให้ครบถ้วน'); const tid = normalizeId(teacher.id); setIsProcessing(true); const questionPayload = { id: editingQuestionId, subject: qSubject, grade: qGrade, text: qText, image: qImage, c1: qChoices.c1, c2: qChoices.c2, c3: qChoices.c3, c4: qChoices.c4, correct: qCorrect, explanation: qExplain, school: teacher.school, teacherId: tid }; let success = editingQuestionId ? await editQuestion(questionPayload) : await addQuestion(questionPayload); setIsProcessing(false); if (success) { alert('✅ บันทึกสำเร็จ'); setQText(''); setQChoices({c1:'', c2:'', c3:'', c4:''}); setEditingQuestionId(null); 
     if (activeTab === 'questions' && qBankSubject === qSubject) {
         setLoadingQuestions(true);
         const updated = await getQuestionsBySubject(qSubject);
         setQuestions(updated);
         setLoadingQuestions(false);
     }
  } else { alert('บันทึกไม่สำเร็จ'); } };
  
  const handleEditQuestion = (q: Question) => { setEditingQuestionId(q.id); setQSubject(q.subject); setQGrade(q.grade || 'P6'); setQText(q.text); setQImage(q.image || ''); setQCorrect(String(q.correctChoiceId)); setQExplain(q.explanation); setQChoices({ c1: q.choices[0]?.text || '', c2: q.choices[1]?.text || '', c3: q.choices[2]?.text || '', c4: q.choices[3]?.text || '' }); document.getElementById('question-form')?.scrollIntoView({ behavior: 'smooth' }); };
  const handleDeleteQuestion = async (id: string) => { if(!confirm('ลบข้อสอบนี้?')) return; setIsProcessing(true); await deleteQuestion(id); setIsProcessing(false); 
     if (activeTab === 'questions' && qBankSubject) {
         setLoadingQuestions(true);
         const updated = await getQuestionsBySubject(qBankSubject);
         setQuestions(updated);
         setLoadingQuestions(false);
     }
  };
  const handleAiGenerate = async () => { if (!aiTopic || !geminiApiKey) return alert("กรุณาระบุหัวข้อและ API Key"); setIsGeneratingAi(true); try { const generated = await generateQuestionWithAI(aiSourceMode === 'assignment' ? assignSubject : qSubject, aiSourceMode === 'assignment' ? assignGrade : qGrade, aiTopic, geminiApiKey, aiCount); if (generated) setAiPreviewQuestions(prev => [...prev, ...generated]); } catch (e) { handleAiError(e); } finally { setIsGeneratingAi(false); } };
  const handleSaveAiQuestions = async () => { if (aiPreviewQuestions.length === 0) return; setIsProcessing(true); const targetSubject = aiSourceMode === 'assignment' ? assignSubject : qSubject; const targetGrade = aiSourceMode === 'assignment' ? assignGrade : qGrade; const tid = normalizeId(teacher.id); for (const q of aiPreviewQuestions) { await addQuestion({ subject: targetSubject, grade: targetGrade, text: q.text, image: q.image || '', c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4, correct: q.correct, explanation: q.explanation, school: teacher.school, teacherId: tid }); } setIsProcessing(false); alert(`✅ บันทึกสำเร็จ`); setAiPreviewQuestions([]); setShowAiModal(false); 
     if (activeTab === 'questions' && qBankSubject === targetSubject) {
         setLoadingQuestions(true);
         const updated = await getQuestionsBySubject(targetSubject);
         setQuestions(updated);
         setLoadingQuestions(false);
     }
  };

  // ✅ Migration Handler
  const handleMigration = async () => {
      if (!migrationFile) return alert("กรุณาเลือกไฟล์ JSON");
      setIsMigrating(true);
      const logs: string[] = [];
      const log = (msg: string) => { logs.push(msg); setMigrationLog([...logs]); };
      
      try {
          const text = await migrationFile.text();
          const json = JSON.parse(text);
          
          log(`Loaded file: ${migrationFile.name}`);
          
          // Determine structure
          let dataToImport: any[] = [];
          let targetTable = migrationTarget;

          // Helper to normalize Firebase object to array
          const toArray = (obj: any) => {
             if (Array.isArray(obj)) return obj.filter(x => x);
             return Object.keys(obj).map(key => ({ id: key, ...obj[key] }));
          };

          if (migrationTarget === 'auto') {
              // Try to detect root keys
              if (json.students) {
                  log("Detected 'students' node. Importing students...");
                  const rows = toArray(json.students);
                  const { error } = await supabase.from('students').upsert(rows);
                  if(error) log(`Error importing students: ${error.message}`);
                  else log(`✅ Imported ${rows.length} students.`);
              }
              if (json.teachers) {
                  log("Detected 'teachers' node. Importing teachers...");
                  const rows = toArray(json.teachers);
                  const { error } = await supabase.from('teachers').upsert(rows);
                  if(error) log(`Error importing teachers: ${error.message}`);
                  else log(`✅ Imported ${rows.length} teachers.`);
              }
              if (json.questions) {
                  log("Detected 'questions' node. Importing questions...");
                  // Need to fix choices structure if from old system
                  let rows = toArray(json.questions);
                  // Normalize fields
                  rows = rows.map((q: any) => ({
                      id: q.id,
                      subject: q.subject,
                      text: q.text,
                      grade: q.grade || 'P6',
                      // Fix choices: convert array of objects to simple jsonb if needed, or keep as is if compatible
                      choices: JSON.stringify(q.choices), 
                      correct_choice_id: q.correctChoiceId,
                      explanation: q.explanation,
                      school: q.school,
                      teacher_id: q.teacherId
                  }));

                  const { error } = await supabase.from('questions').upsert(rows);
                  if(error) log(`Error importing questions: ${error.message}`);
                  else log(`✅ Imported ${rows.length} questions.`);
              }
          } else {
               // Specific table import
               log(`Importing into '${migrationTarget}'...`);
               let rows = toArray(json); // Assume the file IS the data for that table
               
               // Adjust fields based on target
               if (migrationTarget === 'questions') {
                    rows = rows.map((q: any) => ({
                      id: q.id,
                      subject: q.subject,
                      text: q.text,
                      grade: q.grade || 'P6',
                      choices: typeof q.choices === 'object' ? JSON.stringify(q.choices) : q.choices, 
                      correct_choice_id: q.correctChoiceId || q.correct_choice_id,
                      explanation: q.explanation,
                      school: q.school,
                      teacher_id: q.teacherId || q.teacher_id
                   }));
               }
               
               const { error } = await supabase.from(migrationTarget).upsert(rows);
               if(error) throw error;
               log(`✅ Imported ${rows.length} rows into ${migrationTarget}.`);
          }
          
          log("Migration Completed.");

      } catch (e: any) {
          log(`❌ Error: ${e.message}`);
          console.error(e);
      } finally {
          setIsMigrating(false);
      }
  };

  const formatDate = (dateString: string) => { if (!dateString) return '-'; const date = new Date(dateString); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const countSubmitted = (assignmentId: string) => { const submittedStudentIds = new Set(stats.filter(r => r.assignmentId === assignmentId).map(r => r.studentId)); return submittedStudentIds.size; };

  const getAssignmentQuestions = (a: Assignment | null) => {
    if (!a) return [];
    return questions.filter(q => 
        q.subject === a.subject && 
        (!a.grade || a.grade === 'ALL' || q.grade === a.grade || q.grade === 'ALL')
    ).slice(0, a.questionCount);
  };
  
  useEffect(() => {
    if (selectedAssignment && assignmentModalTab === 'questions') {
       const loadAssignQs = async () => {
           setLoadingQuestions(true);
           const qs = await getQuestionsBySubject(selectedAssignment.subject);
           // Filter just for this assignment visually if needed, but getQuestionsBySubject returns all for subject.
           // We will slice in render.
           setQuestions(qs);
           setLoadingQuestions(false);
       };
       loadAssignQs();
    }
  }, [selectedAssignment, assignmentModalTab]);

  const onetAssignments = assignments.filter(a => a.title && a.title.startsWith('[O-NET]'));
  const normalAssignments = assignments.filter(a => !a.title || !a.title.startsWith('[O-NET]'));
  let filteredOnetAssignments = onetAssignments;
  if (onetSubjectFilter !== 'ALL') filteredOnetAssignments = filteredOnetAssignments.filter(a => a.subject === onetSubjectFilter);
  if (onetLevel) filteredOnetAssignments = filteredOnetAssignments.filter(a => a.grade === onetLevel);

  const getFilteredQuestions = () => { 
      const currentTid = normalizeId(teacher.id);
      let result = questions;
      if (showMyQuestionsOnly) {
          if (!currentTid) result = [];
          else result = result.filter(q => normalizeId(q.teacherId) === currentTid);
      }
      return result;
  };
  
  const filteredQuestions = getFilteredQuestions();
  const currentQuestions = filteredQuestions.slice((qBankPage - 1) * ITEMS_PER_PAGE, qBankPage * ITEMS_PER_PAGE);

  // Filter students by selected Grade
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
       
       {/* 🟢 ASSIGNMENT SUBMISSION MODAL */}
       {selectedAssignment && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <FileText size={20} className="text-blue-600"/> 
                                {selectedAssignment.title || selectedAssignment.subject}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {GRADE_LABELS[selectedAssignment.grade || 'ALL'] || selectedAssignment.grade} | 
                                ส่งภายใน: {formatDate(selectedAssignment.deadline)}
                            </p>
                        </div>
                        <button onClick={() => setSelectedAssignment(null)} className="text-gray-400 hover:text-red-500 p-2"><X size={24}/></button>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex border-b bg-white">
                        <button 
                            onClick={() => setAssignmentModalTab('status')}
                            className={`flex-1 py-3 text-sm font-bold transition ${assignmentModalTab === 'status' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            สถานะการส่งงาน
                        </button>
                        <button 
                            onClick={() => setAssignmentModalTab('questions')}
                            className={`flex-1 py-3 text-sm font-bold transition ${assignmentModalTab === 'questions' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            ข้อสอบที่ใช้
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-0 bg-white">
                    {assignmentModalTab === 'status' ? (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-blue-50 text-blue-900 font-bold sticky top-0">
                                <tr>
                                    <th className="p-4">รายชื่อนักเรียน</th>
                                    <th className="p-4 text-center">สถานะ</th>
                                    <th className="p-4 text-right">คะแนน</th>
                                    <th className="p-4 text-right">ส่งเมื่อ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* Filter students based on assignment grade */}
                                {students
                                    .filter(s => !selectedAssignment.grade || selectedAssignment.grade === 'ALL' || s.grade === selectedAssignment.grade)
                                    .map(s => {
                                        const results = stats.filter(r => String(r.studentId) === String(s.id) && r.assignmentId === selectedAssignment.id);
                                        const result = results.length > 0 ? results[results.length - 1] : undefined;
                                        
                                        return (
                                            <tr key={s.id} className="hover:bg-gray-50">
                                                <td className="p-4 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">{s.avatar}</div>
                                                    <div>
                                                        <div className="font-bold text-gray-800">{s.name}</div>
                                                        <div className="text-xs text-gray-400">ID: {s.id}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {result ? (
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                            <CheckCircle size={12}/> ส่งแล้ว
                                                        </span>
                                                    ) : (
                                                        <span className="bg-gray-100 text-gray-400 px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                            <Clock size={12}/> รอส่ง
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {result ? <span className="font-bold text-blue-600 text-lg">{result.score}/{result.totalQuestions}</span> : '-'}
                                                </td>
                                                <td className="p-4 text-right text-gray-500 text-xs">
                                                    {result ? new Date(result.timestamp).toLocaleString('th-TH') : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {students.filter(s => !selectedAssignment.grade || selectedAssignment.grade === 'ALL' || s.grade === selectedAssignment.grade).length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">ไม่พบนักเรียนในกลุ่มเป้าหมาย</td></tr>
                                    )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-6">
                            {loadingQuestions ? (
                                <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline mr-2"/>กำลังโหลดข้อสอบ...</div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-3 rounded-lg text-blue-800 text-sm border border-blue-100 mb-4">
                                        <b>หมายเหตุ:</b> รายการข้อสอบที่แสดงอาจมีการเปลี่ยนแปลงหากมีการแก้ไขในคลังข้อสอบ
                                    </div>
                                    {questions.filter(q => q.subject === selectedAssignment.subject && (!selectedAssignment.grade || selectedAssignment.grade === 'ALL' || q.grade === selectedAssignment.grade || q.grade === 'ALL')).slice(0, selectedAssignment.questionCount).map((q, i) => (
                                        <div key={i} className="p-4 border rounded-xl bg-gray-50 relative group hover:bg-white transition shadow-sm">
                                            <div className="font-bold text-gray-800 mb-2">ข้อที่ {i+1}</div>
                                            <div className="text-gray-700 mb-2">{q.text}</div>
                                            {q.image && <img src={q.image} className="h-32 object-contain rounded border bg-white mb-2" />}
                                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                                {q.choices.map((c, idx) => (
                                                    <div key={idx} className={`${(idx+1).toString() === q.correctChoiceId ? 'text-green-600 font-bold' : ''}`}>
                                                        {idx+1}. {c.text}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-xs text-blue-500 mt-2 pt-2 border-t border-gray-200">
                                                <b>เฉลย:</b> {q.explanation}
                                            </div>
                                        </div>
                                    ))}
                                    {questions.length === 0 && <div className="text-center text-gray-400">ไม่พบข้อมูลข้อสอบ</div>}
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
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

      {/* AI Generator Modal */}
      {showAiModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Wand2 size={20}/> AI สร้างข้อสอบลงคลัง</h3>
                      <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1 rounded"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-4 text-sm text-purple-700">
                          วิชา: <b>{qSubject}</b> | ชั้น: <b>{GRADE_LABELS[qGrade] || qGrade}</b>
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Google Gemini API Key</label>
                              <div className="flex gap-2">
                                  <input type="password" value={geminiApiKey} onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }} className="flex-1 p-2 border rounded-lg text-sm" placeholder="วาง API Key ที่นี่..." />
                                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200"><Key size={18}/></a>
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">หัวข้อเรื่อง (Topic)</label>
                              <input type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="เช่น การบวกเลข, สัตว์เลี้ยงลูกด้วยนม..." />
                          </div>
                          <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">จำนวนข้อต่อครั้ง</label>
                             <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="w-full p-2 border rounded-lg">
                                 <option value="1">1 ข้อ</option>
                                 <option value="3">3 ข้อ</option>
                                 <option value="5">5 ข้อ</option>
                                 <option value="10">10 ข้อ</option>
                             </select>
                          </div>
                          
                          <button onClick={handleAiGenerate} disabled={isGeneratingAi} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-purple-200 disabled:opacity-50 flex justify-center items-center gap-2">
                              {isGeneratingAi ? <RefreshCw className="animate-spin"/> : <Wand2 size={18}/>} 
                              {isGeneratingAi ? 'กำลังสร้าง...' : 'เริ่มสร้างข้อสอบ'}
                          </button>
                      </div>
                      
                      {aiPreviewQuestions.length > 0 && (
                          <div className="mt-6 border-t pt-4">
                              <h4 className="font-bold text-gray-800 mb-2 flex justify-between items-center">
                                  <span>ตัวอย่างที่สร้างได้ ({aiPreviewQuestions.length} ข้อ)</span>
                                  <button onClick={() => setAiPreviewQuestions([])} className="text-xs text-red-500 underline">ล้างทั้งหมด</button>
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto mb-4 border border-gray-200">
                                  {aiPreviewQuestions.map((q, i) => (
                                      <div key={i} className="text-xs border-b last:border-0 p-2 text-gray-600">
                                          {i+1}. {q.text} <span className="text-green-600 font-bold">(ตอบ: {q.correct})</span>
                                      </div>
                                  ))}
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={handleAiGenerate} disabled={isGeneratingAi} className="flex-1 py-3 border-2 border-purple-500 text-purple-600 rounded-xl font-bold hover:bg-purple-50">
                                      + เพิ่มอีก {aiCount} ข้อ
                                  </button>
                                  <button onClick={handleSaveAiQuestions} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold shadow-lg hover:bg-green-600">
                                      บันทึกลงคลัง
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* STATS DETAILS MODAL */}
      {selectedStudentForStats && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
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
                                  {stats.filter(r => String(r.studentId) === String(selectedStudentForStats.id)).slice().reverse().slice(0, 10).map((r, i) => (
                                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                          <td className="p-2">{r.subject}</td>
                                          <td className="p-2 text-center"><span className="font-bold">{r.score}</span><span className="text-gray-400">/{r.totalQuestions}</span></td>
                                          <td className="p-2 text-right text-xs text-gray-500">{new Date(r.timestamp).toLocaleDateString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
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
            <MenuCard icon={<Calendar size={40} />} title="สั่งการบ้าน" desc="มอบหมายงานและติดตาม" color="bg-orange-50 text-orange-600 border-orange-200" onClick={() => { setActiveTab('assignments'); setAssignStep(1); setAssignTitle(''); setNewlyGeneratedQuestions([]); }} />
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
                onClick={() => { setActiveTab('onet'); setAssignStep(1); setNewlyGeneratedQuestions([]); }} 
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
            <button onClick={() => { setActiveTab('menu'); setEditingStudentId(null); setCreatedStudent(null); setSelectedStudentForStats(null); setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-purple-600 font-bold transition-colors"><div className="bg-gray-100 p-2 rounded-full"><ArrowLeft size={20} /></div> กลับเมนูหลัก</button>
            
            {/* STUDENTS TAB - Navigation for Multi-Grade Teachers */}
            {activeTab === 'students' && viewLevel === 'GRADES' && (
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
            )}
            
            {/* ... Other Tabs (Students List, Subjects, Stats, etc.) - Preserving structure ... */}

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
            
            {/* STUDENTS TAB - List View */}
            {activeTab === 'students' && viewLevel === 'LIST' && (
                <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                     {/* If manually selected grade, show back button */}
                     {(!(!canManageAll && myGrades.length === 1)) && (
                         <div className="md:col-span-2">
                             <button onClick={() => { setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="flex items-center gap-1 text-sm text-purple-600 hover:underline">
                                <ArrowLeft size={16}/> เลือกชั้นเรียนอื่น
                             </button>
                             <h3 className="text-xl font-bold text-gray-800 mt-2">จัดการนักเรียนชั้น {GRADE_LABELS[selectedGradeFilter || '']}</h3>
                         </div>
                     )}
                     
                     {/* ... Student Form ... */}
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
                        
                        {/* New Student Card Preview */}
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

                    {/* Student List */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-gray-500">รายชื่อนักเรียน ({filteredStudents.length})</h4>
                            <button onClick={loadData} className="text-purple-600 hover:bg-purple-50 p-1 rounded"><RefreshCw size={14}/></button>
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
            )}

            {/* SUBJECTS TAB */}
            {activeTab === 'subjects' && (
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
                        {availableSubjects.map(sub => (
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
                    {availableSubjects.length === 0 && <div className="text-center text-gray-400 py-10">ยังไม่มีรายวิชา</div>}
                </div>
            )}

            {/* STATS TAB - View Navigation */}
            {activeTab === 'stats' && viewLevel === 'GRADES' && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-green-600"/> เลือกชั้นเรียน (ดูผลการเรียน)</h3>
                        <button onClick={loadData} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600 flex items-center gap-1"><RefreshCw size={14}/> รีเฟรช</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {(canManageAll ? GRADES : myGrades).map(g => {
                            const gStats = getGradeStats(g);
                            if (gStats.studentCount === 0) return null;
                            return (
                                <button key={g} onClick={() => { setSelectedGradeFilter(g); setViewLevel('LIST'); }} className="bg-white hover:bg-green-50 p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-green-200 text-left group">
                                    <div className="text-xs font-bold text-gray-400 mb-1">{GRADE_LABELS[g]}</div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-2xl font-black text-gray-800 group-hover:text-green-700">{gStats.avgScore}%</div>
                                        <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full group-hover:bg-white">{gStats.studentCount} คน</div>
                                    </div>
                                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-green-500 h-full" style={{width: `${gStats.avgScore}%`}}></div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* STATS TAB - List View */}
            {activeTab === 'stats' && viewLevel === 'LIST' && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                             {(!(!canManageAll && myGrades.length === 1)) && (
                                 <button onClick={() => { setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="flex items-center gap-1 text-sm text-green-600 hover:underline mb-1">
                                    <ArrowLeft size={16}/> เลือกชั้นเรียนอื่น
                                 </button>
                             )}
                             <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <BarChart2 className="text-green-600"/> ผลการเรียนชั้น {GRADE_LABELS[selectedGradeFilter || '']}
                             </h3>
                        </div>
                        <button onClick={loadData} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600 flex items-center gap-1"><RefreshCw size={14}/> รีเฟรช</button>
                    </div>

                    {loading ? <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline mr-2"/> กำลังโหลด...</div> : (
                        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                    <tr>
                                        <th className="p-4">นักเรียน</th>
                                        <th className="p-4 text-center">ระดับชั้น</th>
                                        <th className="p-4 text-center">เข้าสอบ (ครั้ง)</th>
                                        <th className="p-4 text-right">คะแนนเฉลี่ยรวม</th>
                                        <th className="p-4 text-center">รายละเอียด</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredStudents.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">ไม่มีนักเรียนในชั้นนี้</td></tr> :
                                    filteredStudents.map(s => {
                                        const overall = getStudentOverallStats(s.id);
                                        return (
                                            <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">{s.avatar}</div>
                                                        <div>
                                                            <div className="font-bold text-gray-800">{s.name}</div>
                                                            <div className="text-xs text-gray-400 font-mono">ID: {s.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{GRADE_LABELS[s.grade || ''] || s.grade}</span></td>
                                                <td className="p-3 text-center font-mono text-gray-600">{overall.attempts}</td>
                                                <td className="p-3 text-right">
                                                    {overall.attempts > 0 ? (
                                                        <span className={`font-black text-lg ${overall.average >= 80 ? 'text-green-600' : overall.average >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                            {overall.average}%
                                                        </span>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </td>
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
            
            {/* O-NET TAB */}
            {activeTab === 'onet' && (
              <div className="max-w-4xl mx-auto">
                 {/* ... O-NET Content (Unchanged) ... */}
                 
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
                                          <button onClick={() => handleRedoAssignment(a)} className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-purple-100 flex items-center gap-1" title="มอบหมายซ้ำ"><Copy size={16}/> ทำซ้ำ</button>
                                          <button onClick={() => handleViewAssignment(a)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-100">ดูรายละเอียด</button>
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

            {/* ASSIGNMENTS TAB (Unchanged) */}
            {activeTab === 'assignments' && (
              <div className="max-w-4xl mx-auto">
                 {/* ... Assignment Creation Form ... */}
                 <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-orange-500"/> สั่งงานใหม่</h4>
                    
                    {availableSubjects.length === 0 ? (
                        <div className="text-red-500 text-center p-4 bg-red-50 rounded-xl border border-red-200 mb-4">
                            กรุณาไปที่เมนู "จัดการรายวิชา" เพื่อเพิ่มวิชาก่อนสั่งงาน
                        </div>
                    ) : (
                    <div>
                        {assignStep === 1 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อหัวข้อการบ้าน</label>
                                        <input type="text" value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder={`เช่น การบ้าน ${assignSubject || '...'} ประจำสัปดาห์`} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-orange-200 outline-none"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">วิชา</label>
                                        <select value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 outline-none">
                                            <option value="">-- เลือกวิชา --</option>
                                            {availableSubjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">ระดับชั้น</label>
                                        <select value={assignGrade} onChange={(e) => setAssignGrade(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white outline-none">
                                            {canManageAll ? <option value="ALL">ทุกชั้น</option> : null}
                                            {myGrades.map(g => (
                                                <option key={g} value={g}>{GRADE_LABELS[g] || g}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">จำนวนข้อ</label>
                                        <input type="number" value={assignCount} onChange={(e) => setAssignCount(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white" min="5" max="50" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">ส่งภายใน</label>
                                        <input type="date" value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white" />
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            if (!assignSubject || !assignDeadline) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
                                            setAssignStep(2);
                                        }}
                                        className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-600 shadow-sm flex items-center gap-2"
                                    >
                                        ถัดไป: สร้างข้อสอบด้วย AI <ArrowRight size={18}/>
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Step 2 ... (Unchanged logic) ... */}
                        {assignStep === 2 && (
                            <div className="animate-fade-in space-y-4">
                                <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 text-orange-900 text-sm mb-4 flex justify-between items-center">
                                    <span>สร้างข้อสอบสำหรับ: <b>{assignSubject}</b> ({assignCount} ข้อ)</span>
                                    <button onClick={() => setAssignStep(1)} className="text-orange-700 underline text-xs">แก้ไขข้อมูล</button>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Google Gemini API Key</label>
                                    <div className="flex gap-2">
                                        <input type="password" value={geminiApiKey} onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }} className="flex-1 p-2 border rounded-lg text-sm bg-white" placeholder="วาง API Key ที่นี่..." />
                                    </div>
                                </div>

                                <div className="p-4 bg-white border rounded-xl shadow-sm">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">หัวข้อเรื่องที่ต้องการ (Topic)</label>
                                    <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            value={assignAiTopic} 
                                            onChange={(e) => setAssignAiTopic(e.target.value)} 
                                            placeholder="ระบุเรื่องที่ต้องการให้ AI สร้างโจทย์ เช่น การบวกเลข, คำราชาศัพท์"
                                            className="flex-1 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
                                        />
                                        <button 
                                            onClick={handleAssignGenerateQuestions}
                                            disabled={isGeneratingAi || !assignAiTopic}
                                            className="bg-purple-600 text-white px-4 rounded-xl font-bold shadow-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isGeneratingAi ? <RefreshCw className="animate-spin" size={18}/> : <BrainCircuit size={18}/>}
                                            สร้าง +5 ข้อ
                                        </button>
                                    </div>
                                </div>

                                {/* Generated List */}
                                <div className="border rounded-xl overflow-hidden bg-white">
                                    <div className="bg-gray-100 p-3 flex justify-between items-center">
                                        <span className="font-bold text-gray-700 text-sm">รายการข้อสอบ ({newlyGeneratedQuestions.length}/{assignCount})</span>
                                        {newlyGeneratedQuestions.length > 0 && <button onClick={() => setNewlyGeneratedQuestions([])} className="text-xs text-red-500 hover:underline">ล้างทั้งหมด</button>}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                                        {newlyGeneratedQuestions.map((q, i) => (
                                            <div key={i} className="p-3 border rounded-lg bg-gray-50 text-sm relative group">
                                                <div className="font-bold text-gray-800 pr-6">{i+1}. {q.text}</div>
                                                <div className="text-gray-500 text-xs mt-1">ตอบ: {q.correct}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="flex gap-3 pt-4 border-t">
                                    <button onClick={() => setAssignStep(1)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">ย้อนกลับ</button>
                                    <button 
                                        onClick={handleFinalizeAssignment}
                                        disabled={isProcessing || newlyGeneratedQuestions.length === 0}
                                        className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-600 disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {isProcessing ? 'กำลังบันทึก...' : <><Save size={20}/> บันทึกการบ้าน</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                 </div>

                 {/* Assignment List */}
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">รายการการบ้าน ({normalAssignments.length})</h3>
                    <button onClick={loadData} className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200 transition"><RefreshCw size={14}/> รีเฟรช</button>
                 </div>
                 
                 {normalAssignments.length === 0 ? (
                     <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">ยังไม่มีการบ้าน</div>
                 ) : (
                     <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                         <table className="w-full text-sm text-left">
                             <thead className="bg-orange-50 text-orange-900">
                                 <tr><th className="p-3">หัวข้อการบ้าน</th><th className="p-3 text-center">วิชา (ชั้น)</th><th className="p-3 text-center">จำนวนข้อ</th><th className="p-3">ส่งภายใน</th><th className="p-3 text-center">ส่งแล้ว</th><th className="p-3 text-right">จัดการ</th></tr>
                             </thead>
                             <tbody>
                                 {normalAssignments.slice().reverse().map((a) => {
                                     const submittedCount = countSubmitted(a.id);
                                     // ✅ Fix: Calculate Total Eligible Students
                                     const eligibleStudents = students.filter(s => !a.grade || a.grade === 'ALL' || s.grade === a.grade);
                                     const totalEligible = eligibleStudents.length;
                                     const notSubmittedCount = totalEligible - submittedCount;
                                     
                                     const isExpired = new Date(a.deadline) < new Date();
                                     return (
                                         <tr key={a.id} className="border-b hover:bg-gray-50 last:border-0 transition-colors">
                                             <td className="p-3 font-bold text-gray-900">
                                                 {a.title || a.subject} 
                                             </td>
                                             <td className="p-3 text-center text-gray-600">
                                                 {a.subject}
                                                 {a.grade && a.grade !== 'ALL' && <div className="text-[10px] text-gray-400">{GRADE_LABELS[a.grade] || a.grade}</div>}
                                             </td>
                                             <td className="p-3 text-center font-mono">{a.questionCount}</td>
                                             <td className={`p-3 font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                                                 {formatDate(a.deadline)}
                                             </td>
                                             <td className="p-3 text-center">
                                                 <div className="flex flex-col items-center">
                                                     <span className={`px-2 py-1 rounded-full font-bold text-xs ${submittedCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                         {submittedCount} / {totalEligible}
                                                     </span>
                                                     {notSubmittedCount > 0 && (
                                                         <span className="text-[10px] text-red-500 font-medium mt-1">
                                                             (ยังไม่ส่ง {notSubmittedCount})
                                                         </span>
                                                     )}
                                                 </div>
                                             </td>
                                             <td className="p-3 text-right flex justify-end gap-2">
                                                 <button onClick={() => handleRedoAssignment(a)} className="text-purple-600 hover:bg-purple-50 p-1.5 rounded" title="มอบหมายซ้ำ"><Copy size={16}/></button>
                                                 <button onClick={() => handleViewAssignment(a)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" title="ดูรายละเอียด"><Eye size={16} /></button>
                                                 <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="ลบ"><Trash2 size={16}/></button>
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

            {/* ADMIN STATS & QUESTIONS ... (Unchanged) */}
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
                                    <Trophy className="text-indigo-600"/> สรุปผลการทดสอบ O-NET (จำลอง)
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
                             {loading ? <div className="text-center py-10"><Loader2 className="animate-spin inline"/></div> : (
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
                                                            <button onClick={() => setSelectedStudentForStats(s)} className="text-blue-600 hover:underline text-xs">ดูรายละเอียด</button>
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

            {activeTab === 'questions' && (
               <div className="max-w-6xl mx-auto">
                   {/* ... Content from previous step ... */}
                   {/* Keeping previous content for Questions */}
                   <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileText className="text-blue-600" /> คลังข้อสอบ</h3>
                      <div className="flex gap-2">
                           <button
                                onClick={() => { setAiSourceMode('bank'); setShowAiModal(true); setAiPreviewQuestions([]); }}
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2"
                           >
                               <Wand2 size={16}/> AI สร้างข้อสอบ
                           </button>
                           <button
                                onClick={() => { setShowMyQuestionsOnly(!showMyQuestionsOnly); setQBankSubject(null); }}
                                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition ${showMyQuestionsOnly ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
                           >
                                {showMyQuestionsOnly ? <CheckCircle size={16}/> : <UserCog size={16}/>} ของฉัน
                           </button>
                      </div>
                  </div>
                  <div id="question-form" className={`bg-white p-6 rounded-2xl shadow-sm border mb-8 ${editingQuestionId ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                      {/* Question Form content */}
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            {editingQuestionId ? '✏️ แก้ไขข้อสอบ' : '➕ เพิ่มข้อสอบใหม่ (Manual)'}
                        </h4>
                      </div>
                      
                      {/* ... Form Fields ... */}
                      {/* Render same form as before for brevity */}
                      {availableSubjects.length === 0 ? (
                           <div className="text-red-500 text-center p-4">กรุณาสร้างรายวิชาก่อนเพิ่มข้อสอบด้วยตนเอง</div>
                      ) : (
                      <>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">วิชา</label>
                            <select value={qSubject} onChange={(e)=>setQSubject(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                                 <option value="">-- เลือกวิชา --</option>
                                 {availableSubjects.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ระดับชั้น</label>
                            {canManageAll ? (
                                <select value={qGrade} onChange={(e)=>setQGrade(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                                    {GRADES.map(g=><option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
                                </select>
                            ) : (
                                <select value={qGrade} onChange={(e)=>setQGrade(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                                    {myGrades.map(g => (
                                        <option key={g} value={g}>{GRADE_LABELS[g] || g}</option>
                                    ))}
                                </select>
                            )}
                         </div>
                      </div>
                      <div className="mb-4">
                         <label className="block text-xs font-bold text-gray-500 mb-1">โจทย์</label>
                         <textarea value={qText} onChange={(e)=>setQText(e.target.value)} className="w-full p-2 border rounded-lg" rows={2} placeholder="โจทย์..."></textarea>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                         <input type="text" value={qChoices.c1} onChange={(e)=>setQChoices({...qChoices, c1:e.target.value})} placeholder="ก." className="p-2 border rounded-lg"/>
                         <input type="text" value={qChoices.c2} onChange={(e)=>setQChoices({...qChoices, c2:e.target.value})} placeholder="ข." className="p-2 border rounded-lg"/>
                         <input type="text" value={qChoices.c3} onChange={(e)=>setQChoices({...qChoices, c3:e.target.value})} placeholder="ค." className="p-2 border rounded-lg"/>
                         <input type="text" value={qChoices.c4} onChange={(e)=>setQChoices({...qChoices, c4:e.target.value})} placeholder="ง." className="p-2 border rounded-lg"/>
                      </div>
                      <div className="mb-4">
                         <label className="block text-xs font-bold text-gray-500 mb-1">ข้อถูก</label>
                         <select value={qCorrect} onChange={(e)=>setQCorrect(e.target.value)} className="w-full p-2 border rounded-lg">
                            <option value="1">ก.</option><option value="2">ข.</option><option value="3">ค.</option><option value="4">ง.</option>
                         </select>
                      </div>
                      <div className="mb-4">
                         <label className="block text-xs font-bold text-gray-500 mb-1">เฉลยละเอียด</label>
                         <textarea value={qExplain} onChange={(e)=>setQExplain(e.target.value)} className="w-full p-2 border rounded-lg" rows={1}></textarea>
                      </div>
                      
                      <div className="flex gap-2">
                          {editingQuestionId && (
                              <button onClick={() => { setEditingQuestionId(null); setQText(''); }} className="px-4 py-2 bg-gray-200 rounded-xl font-bold">ยกเลิก</button>
                          )}
                          <button onClick={handleSaveQuestion} disabled={isProcessing} className={`flex-1 py-2 rounded-xl font-bold text-white flex items-center justify-center gap-2 ${editingQuestionId ? 'bg-orange-500' : 'bg-blue-600'}`}>
                             {isProcessing ? 'บันทึก...' : (editingQuestionId ? 'บันทึกแก้ไข' : 'บันทึกข้อสอบ')}
                          </button>
                      </div>
                      </>
                      )}
                  </div>
                  {/* ... Question List ... */}
                  {availableSubjects.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                         <div className="text-xs font-bold text-gray-500 mr-2 flex items-center">เลือกวิชาเพื่อดูข้อสอบ:</div>
                         {availableSubjects.map(sub => (
                            <button 
                                key={sub.id}
                                onClick={() => { setQBankSubject(sub.name); setQBankPage(1); }}
                                className={`px-4 py-2 rounded-full border transition-all ${
                                    qBankSubject === sub.name 
                                    ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold shadow-sm' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                {sub.name}
                            </button>
                         ))}
                      </div>
                  )}
                  {/* ... List Rendering ... */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[200px]">
                        {!qBankSubject ? (
                            <div className="flex flex-col items-center justify-center p-10 text-gray-400">
                                <Book size={40} className="mb-2 opacity-20"/>
                                <p>กรุณาเลือกวิชาด้านบนเพื่อโหลดข้อสอบ</p>
                            </div>
                        ) : loadingQuestions ? (
                             <div className="flex flex-col items-center justify-center p-10 text-blue-500">
                                <Loader2 className="animate-spin mb-2" size={32}/>
                                <p>กำลังโหลดข้อสอบ...</p>
                            </div>
                        ) : (
                        <>
                        <div className="p-4 bg-gray-50 font-bold text-gray-700 flex justify-between">
                            <span>รายการข้อสอบ {qBankSubject} ({filteredQuestions.length})</span>
                            <span className="text-xs font-normal text-gray-500">แสดงเฉพาะ: {showMyQuestionsOnly ? 'ของฉัน' : 'ทั้งหมด'}</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {currentQuestions.length > 0 ? currentQuestions.map((q, idx) => (
                                <div key={q.id} className="p-5 hover:bg-blue-50 transition">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-800">{q.text}</span>
                                        {normalizeId(q.teacherId) === normalizeId(teacher.id) && (
                                            <div className="flex gap-2">
                                                <button onClick={()=>handleEditQuestion(q)}><Edit size={16} className="text-blue-500"/></button>
                                                <button onClick={()=>handleDeleteQuestion(q.id)}><Trash2 size={16} className="text-red-500"/></button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2 flex gap-3">
                                        <span>ID: {q.id}</span>
                                        <span className="bg-gray-100 px-1 rounded text-gray-500">{GRADE_LABELS[q.grade || ''] || q.grade}</span>
                                        <span>วิชา: {q.subject}</span>
                                    </div>
                                </div>
                            )) : <div className="p-10 text-center text-gray-400">ไม่พบข้อสอบในหมวดนี้</div>}
                        </div>
                        {filteredQuestions.length > ITEMS_PER_PAGE && (
                            <div className="p-4 border-t flex justify-center gap-2">
                                <button disabled={qBankPage===1} onClick={()=>setQBankPage(p=>p-1)} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16}/></button>
                                <span className="p-2 text-sm text-gray-500">หน้า {qBankPage}</span>
                                <button disabled={qBankPage * ITEMS_PER_PAGE >= filteredQuestions.length} onClick={()=>setQBankPage(p=>p+1)} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16}/></button>
                            </div>
                        )}
                        </>
                        )}
                  </div>
               </div>
            )}
            
            {activeTab === 'profile' && (
                <div className="max-w-xl mx-auto">
                    {/* ... Profile Content (Unchanged) ... */}
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><User className="text-teal-600"/> จัดการข้อมูลส่วนตัว</h3>
                    <div className="bg-teal-50 p-6 rounded-2xl border border-teal-200 shadow-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อ-นามสกุล</label>
                                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full p-3 border rounded-xl bg-white" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)</label>
                                <input type="password" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} className="w-full p-3 border rounded-xl bg-white mb-2" placeholder="รหัสผ่านใหม่" />
                                <input type="password" value={profileConfirmPass} onChange={e => setProfileConfirmPass(e.target.value)} className="w-full p-3 border rounded-xl bg-white" placeholder="ยืนยันรหัสผ่านใหม่" />
                            </div>
                            <div className="pt-2">
                                <div className="text-xs text-gray-500 mb-2">
                                    <div>โรงเรียน: {teacher.school}</div>
                                    <div>Username: {teacher.username}</div>
                                    <div>ระดับชั้น: {teacher.gradeLevel || 'ALL'}</div>
                                </div>
                                <button onClick={handleUpdateProfile} disabled={isProcessing} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold shadow hover:bg-teal-700 disabled:opacity-50">
                                    {isProcessing ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'registrations' && isAdmin && (
                <div className="max-w-4xl mx-auto">
                    {/* ... Registration Content (Unchanged) ... */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><UserCog className="text-red-600"/> ระบบรับสมัครสมาชิก</h3>
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full">
                            <button onClick={handleToggleReg} className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${regEnabled ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>
                                เปิดรับสมัคร
                            </button>
                            <button onClick={handleToggleReg} className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${!regEnabled ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>
                                ปิดรับสมัคร
                            </button>
                        </div>
                    </div>

                    {pendingRegs.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                            ไม่มีคำขอสมัครสมาชิกใหม่
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {pendingRegs.map(req => (
                                <div key={req.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-lg text-gray-800">{req.name} {req.surname}</div>
                                            <div className="flex items-center gap-1 text-gray-500 text-xs font-mono bg-gray-100 px-2 py-1 rounded w-fit">
                                                <CreditCard size={12}/> {req.citizenId}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-gray-400">{new Date(req.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => setShowApproveModal(req)} className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-600">อนุมัติ</button>
                                        <button onClick={() => handleRejectReg(req.id)} className="flex-1 bg-red-100 text-red-600 py-2 rounded-lg font-bold text-sm hover:bg-red-200">ปฏิเสธ</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TEACHER MANAGEMENT TAB */}
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
