import React, { useState, useEffect } from 'react';
import { Teacher, Student, Subject, Assignment, Question, SubjectConfig } from '../types';
import { UserPlus, BarChart2, FileText, LogOut, Save, RefreshCw, Gamepad2, Calendar, Eye, CheckCircle, X, PlusCircle, ChevronLeft, ChevronRight, Book, Calculator, FlaskConical, Languages, ArrowLeft, Users, GraduationCap, Trash2, Edit, Shield, UserCog, KeyRound, Sparkles, Wand2, Key, HelpCircle, ChevronDown, ChevronUp, Layers, Clock, Library, Palette, Type, AlertCircle, ArrowRight, BrainCircuit, List, CheckSquare, Trophy, Lock } from 'lucide-react';
import { getTeacherDashboard, manageStudent, addAssignment, addQuestion, editQuestion, manageTeacher, getAllTeachers, GOOGLE_SCRIPT_URL, deleteQuestion, deleteAssignment, getSubjects, addSubject, deleteSubject } from '../services/api';
import { generateQuestionWithAI, GeneratedQuestion } from '../services/aiService';

interface TeacherDashboardProps {
  teacher: Teacher;
  onLogout: () => void;
  onStartGame: () => void; 
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, onLogout, onStartGame }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'students' | 'subjects' | 'stats' | 'questions' | 'assignments' | 'teachers' | 'profile' | 'onet'>('menu');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]); 
  const [loading, setLoading] = useState(true);

  // Subject Management
  const [availableSubjects, setAvailableSubjects] = useState<SubjectConfig[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState('Book');
  const [newSubjectColor, setNewSubjectColor] = useState('bg-blue-100 text-blue-600');
  
  // Teacher Management State
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherUser, setNewTeacherUser] = useState('');
  const [newTeacherPass, setNewTeacherPass] = useState('');
  const [newTeacherSchool, setNewTeacherSchool] = useState('');
  const [newTeacherGrade, setNewTeacherGrade] = useState('ALL'); // ✅ Added Grade Level State
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null); // ✅ Added Editing ID State
  
  // Permissions Logic
  const canManageAll = !teacher.gradeLevel || teacher.gradeLevel === 'ALL';
  const userGradeLevel = canManageAll ? 'P6' : teacher.gradeLevel!; 
  const isP6OrAdmin = userGradeLevel === 'P6' || canManageAll;
  
  // Robust Admin Check (Check both Role and Username fallback)
  const isAdmin = (teacher.role && teacher.role.toUpperCase() === 'ADMIN') || 
                  (teacher.username && teacher.username.toLowerCase() === 'admin');

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
  const [assignGrade, setAssignGrade] = useState<string>(canManageAll ? 'ALL' : teacher.gradeLevel!); 
  const [assignCount, setAssignCount] = useState(10);
  const [assignDeadline, setAssignDeadline] = useState('');
  
  // Assignment AI State
  const [newlyGeneratedQuestions, setNewlyGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [assignAiTopic, setAssignAiTopic] = useState('');

  // Question Form
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qSubject, setQSubject] = useState<string>(''); // Dynamic Subject
  const [qGrade, setQGrade] = useState<string>(userGradeLevel);
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
  const [showMyQuestionsOnly, setShowMyQuestionsOnly] = useState(false); 
  const ITEMS_PER_PAGE = 5;

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentModalTab, setAssignmentModalTab] = useState<'status' | 'questions'>('status');
  
  // O-NET View State
  const [onetSubjectFilter, setOnetSubjectFilter] = useState<string>('ALL');

  const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const GRADE_LABELS: Record<string, string> = { 'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 'ALL': 'ทุกชั้น' };
  
  const ONET_SUBJECTS = ['คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์', 'ภาษาอังกฤษ'];

  // Icon options for Subjects
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
      if (!canManageAll && teacher.gradeLevel) {
          setAssignGrade(teacher.gradeLevel);
          setQGrade(teacher.gradeLevel);
      }
  }, [teacher]);

  const loadData = async () => {
    setLoading(true);
    const data = await getTeacherDashboard(teacher.school);
    const subs = await getSubjects(teacher.school);
    
    // Load teachers if admin
    if (isAdmin) {
        const teachers = await getAllTeachers();
        setAllTeachers(teachers);
    }
    
    const filteredSubjects = subs.filter(s => {
        if (canManageAll) return true;
        return s.teacherId === normalizeId(teacher.id) || s.grade === teacher.gradeLevel;
    });

    setAvailableSubjects(filteredSubjects);
    
    if (filteredSubjects.length > 0) {
        setAssignSubject(filteredSubjects[0].name);
        setQSubject(filteredSubjects[0].name);
    }

    const myStudents = (data.students || []).filter((s: Student) => {
        if (s.school !== teacher.school) return false;
        if (!canManageAll && s.grade !== teacher.gradeLevel) return false;
        return true; 
    });
    
    setStudents(myStudents);
    setStats(data.results || []);
    setAssignments(data.assignments || []); 
    setQuestions(data.questions || []); 
    
    setLoading(false);
  };

  // --- Handlers ---

  const handleAddSubject = async () => {
      if (!newSubjectName) return alert('กรุณากรอกชื่อวิชา');
      setIsProcessing(true);
      const newSub: SubjectConfig = {
          id: Date.now().toString(),
          name: newSubjectName,
          school: teacher.school,
          teacherId: normalizeId(teacher.id),
          grade: teacher.gradeLevel || 'ALL',
          icon: newSubjectIcon,
          color: newSubjectColor
      };
      
      const success = await addSubject(teacher.school, newSub);
      setIsProcessing(false);
      
      if (success) {
          alert('✅ เพิ่มวิชาเรียบร้อย');
          setNewSubjectName('');
          loadData();
      } else {
          alert('เกิดข้อผิดพลาด');
      }
  };

  const handleDeleteSubject = async (subId: string) => {
      if (!confirm('ยืนยันการลบวิชานี้?')) return;
      setIsProcessing(true);
      await deleteSubject(teacher.school, subId);
      setIsProcessing(false);
      loadData();
  };
  
  // Teacher Management
  const handleSaveTeacher = async () => {
      if (!newTeacherName || !newTeacherUser || !newTeacherPass) return alert('กรุณากรอกข้อมูลให้ครบ');
      setIsProcessing(true);
      
      const res = await manageTeacher({
          action: editingTeacherId ? 'edit' : 'add',
          id: editingTeacherId || undefined,
          name: newTeacherName,
          username: newTeacherUser,
          password: newTeacherPass,
          school: newTeacherSchool || teacher.school,
          role: 'TEACHER',
          gradeLevel: newTeacherGrade // ✅ Send Selected Grade
      });
      
      setIsProcessing(false);
      if (res.success) {
          alert(editingTeacherId ? '✅ แก้ไขข้อมูลครูเรียบร้อย' : '✅ เพิ่มบัญชีครูเรียบร้อย');
          // Reset Form
          setNewTeacherName(''); 
          setNewTeacherUser(''); 
          setNewTeacherPass(''); 
          setNewTeacherSchool('');
          setNewTeacherGrade('ALL');
          setEditingTeacherId(null);
          loadData();
      } else {
          alert('เกิดข้อผิดพลาด: ' + (res.message || 'Unknown error'));
      }
  };

  const handleEditTeacher = (t: Teacher) => {
      setEditingTeacherId(String(t.id));
      setNewTeacherName(t.name);
      setNewTeacherUser(t.username || '');
      setNewTeacherPass(t.password || '');
      setNewTeacherSchool(t.school);
      setNewTeacherGrade(t.gradeLevel || 'ALL'); // ✅ Load Grade
      document.getElementById('teacher-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteTeacher = async (id: string) => {
      if (!confirm('ยืนยันลบข้อมูลครูท่านนี้?')) return;
      setIsProcessing(true);
      await manageTeacher({ action: 'delete', id });
      setIsProcessing(false);
      loadData();
  };

  const handleSaveStudent = async () => {
    if (!newStudentName) return;
    setIsSaving(true);
    
    if (editingStudentId) {
        // Edit Mode
        const result = await manageStudent({
            action: 'edit',
            id: editingStudentId,
            name: newStudentName,
            avatar: newStudentAvatar,
            school: teacher.school,
            grade: userGradeLevel,
            teacherId: normalizeId(teacher.id)
        });

        if (result.success) {
            setStudents(prev => prev.map(s => s.id === editingStudentId ? { ...s, name: newStudentName, avatar: newStudentAvatar } : s));
            setNewStudentName('');
            setEditingStudentId(null);
            alert('✅ แก้ไขข้อมูลเรียบร้อย');
        } else {
             alert('เกิดข้อผิดพลาดในการแก้ไข');
        }

    } else {
        // Add Mode
        const result = await manageStudent({ 
            action: 'add', 
            name: newStudentName, 
            school: teacher.school, 
            avatar: newStudentAvatar,
            grade: userGradeLevel,
            teacherId: normalizeId(teacher.id)
        });

        if (result.success && result.student) {
            setCreatedStudent(result.student);
            setStudents([...students, result.student]);
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
    // Scroll to top or form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setNewStudentName('');
    setNewStudentAvatar('👦');
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('ยืนยันการลบนักเรียนคนนี้? ข้อมูลคะแนนจะหายไปทั้งหมด')) return;
    setIsProcessing(true);
    setProcessingMessage('กำลังลบข้อมูล...');
    
    const result = await manageStudent({ action: 'delete', id });
    setIsProcessing(false);

    if (result.success) {
        setStudents(prev => prev.filter(s => s.id !== id));
    } else {
        alert('ลบไม่สำเร็จ');
    }
  };

  // --- Assignment Creation Logic ---
  const handleAssignGenerateQuestions = async () => {
      if (!geminiApiKey) return alert("กรุณาใส่ API Key ในหน้า 'คลังข้อสอบ > AI' ก่อน");
      if (!assignAiTopic) return alert("กรุณาระบุหัวข้อเรื่อง");
      
      setIsGeneratingAi(true);
      try {
          const generated = await generateQuestionWithAI(
              assignSubject, 
              assignGrade, 
              assignAiTopic, 
              geminiApiKey, 
              5 // Generate 5 at a time
          );

          if (generated) {
             setNewlyGeneratedQuestions(prev => [...prev, ...generated]);
          }
      } catch (e) {
          alert("เกิดข้อผิดพลาด: " + e);
      } finally {
          setIsGeneratingAi(false);
      }
  };

  // --- O-NET AI Generation Logic ---
  const handleOnetGenerateQuestions = async () => {
      if (!geminiApiKey) return alert("กรุณาใส่ API Key");
      if (!assignAiTopic) return alert("กรุณาระบุสาระที่ต้องการเน้น");
      
      setIsGeneratingAi(true);
      try {
          const generated = await generateQuestionWithAI(
              assignSubject, 
              'P6', // O-NET is for P6
              assignAiTopic, 
              geminiApiKey, 
              5,
              'onet' // Activate O-NET mode
          );

          if (generated) {
             setNewlyGeneratedQuestions(prev => [...prev, ...generated]);
          }
      } catch (e) {
          alert("เกิดข้อผิดพลาด: " + e);
      } finally {
          setIsGeneratingAi(false);
      }
  };

  const handleFinalizeAssignment = async () => {
    // 1. Save new questions
    if (newlyGeneratedQuestions.length > 0) {
        setIsProcessing(true);
        setProcessingMessage(`กำลังบันทึกข้อสอบ ${newlyGeneratedQuestions.length} ข้อ...`);
        
        const tid = normalizeId(teacher.id);
        let successCount = 0;
        
        for (const q of newlyGeneratedQuestions) {
            await addQuestion({
                subject: assignSubject,
                grade: assignGrade,
                text: q.text,
                image: q.image || '',
                c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4,
                correct: q.correct,
                explanation: q.explanation,
                school: teacher.school,
                teacherId: tid
            });
            successCount++;
        }
    }

    // 2. Save Assignment
    setProcessingMessage('กำลังสร้างการบ้าน...');
    const finalTitle = assignTitle || `การบ้าน ${assignSubject}`;
    const success = await addAssignment(teacher.school, assignSubject, assignGrade, assignCount, assignDeadline, teacher.name, finalTitle);
    
    setIsProcessing(false);
    
    if (success) { 
        alert('✅ สั่งการบ้านเรียบร้อยแล้ว'); 
        setAssignStep(1);
        setAssignDeadline(''); 
        setAssignTitle('');
        setNewlyGeneratedQuestions([]);
        setAssignAiTopic('');
        // If coming from O-NET tab, stay there.
        if (activeTab === 'onet') {
            await loadData();
        } else {
            setActiveTab('assignments'); 
            await loadData();
        }
    } else { 
        alert('เกิดข้อผิดพลาดในการสร้างการบ้าน'); 
    }
  };


  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('ยืนยันลบการบ้านนี้?')) return;
    setIsProcessing(true);
    const success = await deleteAssignment(id);
    setIsProcessing(false);
    if (success) {
        setAssignments(prev => prev.filter(a => a.id !== id));
        loadData();
    }
  };

  const handleViewAssignment = (a: Assignment) => {
      setSelectedAssignment(a);
      setAssignmentModalTab('status'); // Reset tab
  };

  const handleSaveQuestion = async () => {
    if (!qText || !qChoices.c1 || !qChoices.c2 || !qSubject) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    const tid = normalizeId(teacher.id);

    setIsProcessing(true);
    setProcessingMessage(editingQuestionId ? 'กำลังบันทึกการแก้ไข...' : 'กำลังบันทึกข้อสอบ...');
    
    const questionPayload = { 
        id: editingQuestionId,
        subject: qSubject, 
        grade: qGrade, 
        text: qText, 
        image: qImage, 
        c1: qChoices.c1, c2: qChoices.c2, c3: qChoices.c3, c4: qChoices.c4, 
        correct: qCorrect, 
        explanation: qExplain, 
        school: teacher.school,
        teacherId: tid
    };

    let success = false;
    if (editingQuestionId) {
        success = await editQuestion(questionPayload);
    } else {
        success = await addQuestion(questionPayload);
    }

    setIsProcessing(false);
    if (success) { 
        alert('✅ บันทึกสำเร็จ'); 
        setQText(''); setQChoices({c1:'', c2:'', c3:'', c4:''});
        setEditingQuestionId(null);
        await loadData(); 
    } else { 
        alert('บันทึกไม่สำเร็จ'); 
    }
  };
  
  const handleEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQSubject(q.subject);
    setQGrade(q.grade || 'P6');
    setQText(q.text);
    setQImage(q.image || '');
    setQCorrect(String(q.correctChoiceId));
    setQExplain(q.explanation);
    setQChoices({ c1: q.choices[0]?.text || '', c2: q.choices[1]?.text || '', c3: q.choices[2]?.text || '', c4: q.choices[3]?.text || '' });
    document.getElementById('question-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteQuestion = async (id: string) => {
      if(!confirm('ลบข้อสอบนี้?')) return;
      setIsProcessing(true);
      await deleteQuestion(id);
      setIsProcessing(false);
      loadData();
  };

  // ----------------------------------------
  // AI GENERATOR LOGIC (Question Bank)
  // ----------------------------------------

  const handleAiGenerate = async () => {
      if (!aiTopic || !geminiApiKey) return alert("กรุณาระบุหัวข้อและ API Key");
      setIsGeneratingAi(true);
      try {
          const generated = await generateQuestionWithAI(
              aiSourceMode === 'assignment' ? assignSubject : qSubject, 
              aiSourceMode === 'assignment' ? assignGrade : qGrade, 
              aiTopic, 
              geminiApiKey, 
              aiCount
          );

          if (generated) {
             setAiPreviewQuestions(prev => [...prev, ...generated]); // Append to list
          }
      } catch (e) {
          alert("เกิดข้อผิดพลาดในการสร้างข้อสอบ: " + e);
      } finally {
          setIsGeneratingAi(false);
      }
  };

  const handleSaveAiQuestions = async () => {
      if (aiPreviewQuestions.length === 0) return;
      setIsProcessing(true);
      setProcessingMessage(`กำลังบันทึก ${aiPreviewQuestions.length} ข้อลงคลัง...`);
      
      const targetSubject = aiSourceMode === 'assignment' ? assignSubject : qSubject;
      const targetGrade = aiSourceMode === 'assignment' ? assignGrade : qGrade;
      const tid = normalizeId(teacher.id);

      let successCount = 0;
      for (const q of aiPreviewQuestions) {
          const success = await addQuestion({
              subject: targetSubject,
              grade: targetGrade,
              text: q.text,
              image: q.image || '',
              c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4,
              correct: q.correct,
              explanation: q.explanation,
              school: teacher.school,
              teacherId: tid
          });
          if (success) successCount++;
      }
      
      setIsProcessing(false);
      alert(`✅ บันทึกสำเร็จ ${successCount} ข้อ`);
      setAiPreviewQuestions([]);
      setShowAiModal(false);
      loadData();
  };

  // ----------------------------------------
  // Helper Logic
  // ----------------------------------------
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getFilteredQuestions = () => { 
      const currentTid = normalizeId(teacher.id);
      if (showMyQuestionsOnly) {
          if (!currentTid) return [];
          return questions.filter(q => normalizeId(q.teacherId) === currentTid);
      }
      if (!qBankSubject) return []; 
      return questions.filter(q => { 
          if (q.subject !== qBankSubject) return false; 
          const isMine = isAdmin || (currentTid && normalizeId(q.teacherId) === currentTid);
          if (isMine) return true;
          return q.school === teacher.school; 
      }); 
  };
  
  const filteredQuestions = getFilteredQuestions();
  const currentQuestions = filteredQuestions.slice((qBankPage - 1) * ITEMS_PER_PAGE, qBankPage * ITEMS_PER_PAGE);
  const myCreatedSubjects = availableSubjects.filter(s => s.teacherId === normalizeId(teacher.id));

  const countSubmitted = (assignmentId: string) => {
      const submittedStudentIds = new Set(
        stats.filter(r => r.assignmentId === assignmentId).map(r => r.studentId)
      );
      return submittedStudentIds.size;
  };

  const getAssignmentQuestions = (assignment: Assignment) => {
      let qList = questions.filter(q => 
          (q.subject === assignment.subject) &&
          (q.school === assignment.school || q.school === 'CENTER' || q.school === 'Admin')
      );
      
      if (assignment.grade && assignment.grade !== 'ALL') {
          qList = qList.filter(q => q.grade === assignment.grade || q.grade === 'ALL');
      }

      // Logic: Reverse to get newest, then slice by count
      return [...qList].reverse().slice(0, assignment.questionCount);
  };

  // ✅ Separate O-NET and Normal Assignments
  const onetAssignments = assignments.filter(a => a.title && a.title.startsWith('[O-NET]'));
  const normalAssignments = assignments.filter(a => !a.title || !a.title.startsWith('[O-NET]'));

  // Filter O-NET by Subject Tab
  const filteredOnetAssignments = onetSubjectFilter === 'ALL' 
    ? onetAssignments 
    : onetAssignments.filter(a => a.subject === onetSubjectFilter);

  return (
    <div className="max-w-6xl mx-auto pb-20 relative">
       {/* Processing Overlay */}
       {isProcessing && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
             <div className="bg-white p-6 rounded-xl animate-bounce shadow-xl font-bold text-gray-700">{processingMessage || 'กำลังประมวลผล...'}</div>
        </div>
       )}

      {/* AI Generator Modal (Question Bank Only) */}
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

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-b-3xl md:rounded-3xl shadow-lg mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><GraduationCap size={28} /> ห้องพักครู</h2>
          <div className="opacity-90 text-sm mt-1 flex gap-2 items-center">
             <span>{teacher.school} • คุณครู{teacher.name}</span>
             <span className={`px-2 py-0.5 rounded text-xs font-bold ${canManageAll ? 'bg-yellow-400 text-yellow-900' : 'bg-green-400 text-green-900'}`}>
                 {canManageAll ? 'ดูแลทุกชั้น' : `ประจำชั้น ${teacher.gradeLevel}`}
             </span>
          </div>
        </div>
        <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition backdrop-blur-sm"><LogOut size={20} /></button>
      </div>

      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0">
            <MenuCard icon={<Library size={40} />} title="จัดการรายวิชา" desc="เพิ่ม/ลบ รายวิชาที่สอน" color="bg-pink-50 text-pink-600 border-pink-200" onClick={() => setActiveTab('subjects')} />
            <MenuCard icon={<UserPlus size={40} />} title="จัดการนักเรียน" desc="ลงทะเบียนและแก้ไขข้อมูล" color="bg-purple-50 text-purple-600 border-purple-200" onClick={() => setActiveTab('students')} />
            <MenuCard icon={<Calendar size={40} />} title="สั่งการบ้าน" desc="มอบหมายงานและติดตาม" color="bg-orange-50 text-orange-600 border-orange-200" onClick={() => { setActiveTab('assignments'); setAssignStep(1); setAssignTitle(''); setNewlyGeneratedQuestions([]); }} />
            <MenuCard icon={<BarChart2 size={40} />} title="ดูผลคะแนน" desc="สถิติการสอบ" color="bg-green-50 text-green-600 border-green-200" onClick={() => setActiveTab('stats')} />
            <MenuCard icon={<FileText size={40} />} title="คลังข้อสอบ" desc="เพิ่มและจัดการข้อสอบ" color="bg-blue-50 text-blue-600 border-blue-200" onClick={() => setActiveTab('questions')} />
            <MenuCard icon={<Gamepad2 size={40} />} title="จัดกิจกรรมเกม" desc="เปิดห้องแข่งขัน Real-time" color="bg-yellow-50 text-yellow-600 border-yellow-200" onClick={onStartGame} />
            
            {/* O-NET Tutor Card: Only visible to P6 Teachers or Admin */}
            {isP6OrAdmin && (
              <MenuCard 
                icon={<Trophy size={40} />} 
                title="พิชิต O-NET" 
                desc="สร้างข้อสอบติวเข้ม O-NET ด้วย AI" 
                color="bg-indigo-50 text-indigo-600 border-indigo-200 shadow-indigo-100" 
                onClick={() => { setActiveTab('onet'); setAssignStep(1); setNewlyGeneratedQuestions([]); }} 
              />
            )}

            {/* Admin Only Card */}
            {isAdmin && (
                <MenuCard 
                  icon={<UserCog size={40} />} 
                  title="จัดการข้อมูลครู" 
                  desc="เพิ่ม/ลบ บัญชีผู้ใช้ครู" 
                  color="bg-gray-100 text-gray-700 border-gray-300" 
                  onClick={() => setActiveTab('teachers')} 
                />
            )}
        </div>
      )}

      {activeTab !== 'menu' && (
        <div className="bg-white rounded-3xl shadow-sm p-4 md:p-6 min-h-[400px] relative animate-fade-in">
            <button onClick={() => { setActiveTab('menu'); setEditingStudentId(null); setCreatedStudent(null); }} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-purple-600 font-bold transition-colors"><div className="bg-gray-100 p-2 rounded-full"><ArrowLeft size={20} /></div> กลับเมนูหลัก</button>
            
            {/* O-NET TAB */}
            {activeTab === 'onet' && isP6OrAdmin && (
              <div className="max-w-4xl mx-auto">
                 <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-200 mb-8 shadow-sm">
                    <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2 text-xl"><Trophy className="text-yellow-500"/> ติวเข้มพิชิต O-NET (ป.6)</h4>
                    
                    <div className="space-y-4 animate-fade-in">
                        {/* INPUT SECTION */}
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

                        {/* GENERATE BUTTON */}
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
                        
                        <div className="text-xs text-center text-indigo-400">
                             *ระบบจะวิเคราะห์แนวข้อสอบเก่า O-NET ปี 2560-2566 เพื่อสร้างข้อสอบใหม่ที่ใกล้เคียงที่สุด
                        </div>

                        {/* PREVIEW LIST */}
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
                                  <div className="flex gap-2 mb-4">
                                      <button 
                                          onClick={handleOnetGenerateQuestions}
                                          disabled={isGeneratingAi}
                                          className="flex-1 py-2 bg-indigo-100 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-200 flex items-center justify-center gap-2"
                                      >
                                          {isGeneratingAi ? <RefreshCw size={14} className="animate-spin"/> : <PlusCircle size={14}/>} เพิ่มข้อสอบอีก
                                      </button>
                                  </div>

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

                 {/* O-NET ASSIGNMENT LIST (Separated Tabs) */}
                 <div className="mt-8">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <List size={20}/> รายการติว O-NET ({filteredOnetAssignments.length})
                        </h3>
                        {/* Subject Filter Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setOnetSubjectFilter('ALL')} 
                                className={`px-3 py-1 rounded-md text-xs font-bold transition ${onetSubjectFilter === 'ALL' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                ทั้งหมด
                            </button>
                            {ONET_SUBJECTS.map(subj => (
                                <button 
                                    key={subj}
                                    onClick={() => setOnetSubjectFilter(subj)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${onetSubjectFilter === subj ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {subj}
                                </button>
                            ))}
                        </div>
                     </div>

                     {filteredOnetAssignments.length === 0 ? (
                         <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl bg-gray-50">
                             {onetSubjectFilter === 'ALL' ? 'ยังไม่ได้สร้างรายการติว O-NET' : `ไม่พบรายการติววิชา${onetSubjectFilter}`}
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
                                          <button onClick={() => handleViewAssignment(a)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-100">ดูรายละเอียด</button>
                                          <button onClick={() => handleDeleteAssignment(a.id)} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-100"><Trash2 size={16}/></button>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
              </div>
            )}

            {/* TEACHER MANAGEMENT TAB (Admin Only) */}
            {activeTab === 'teachers' && isAdmin && (
                <div className="max-w-4xl mx-auto" id="teacher-form">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><UserCog className="text-gray-600"/> จัดการข้อมูลครู</h3>
                    
                    <div className={`p-6 rounded-2xl border mb-8 shadow-sm transition-colors ${editingTeacherId ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-200'}`}>
                        <h4 className={`font-bold mb-4 flex items-center gap-2 ${editingTeacherId ? 'text-orange-800' : 'text-gray-700'}`}>
                            {editingTeacherId ? <><Edit size={18}/> แก้ไขข้อมูลครู</> : <><PlusCircle size={18}/> เพิ่มบัญชีครู</>}
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อ-นามสกุล</label>
                                <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder="เช่น ครูสมศรี ใจดี" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">โรงเรียน</label>
                                <input type="text" value={newTeacherSchool} onChange={e => setNewTeacherSchool(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder={`ค่าเริ่มต้น: ${teacher.school}`} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">Username (สำหรับเข้าสู่ระบบ)</label>
                                <input type="text" value={newTeacherUser} onChange={e => setNewTeacherUser(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder="เช่น somsie" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">Password</label>
                                <input type="text" value={newTeacherPass} onChange={e => setNewTeacherPass(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder="เช่น 1234" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ระดับชั้นที่ดูแล</label>
                                <select value={newTeacherGrade} onChange={(e) => setNewTeacherGrade(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none">
                                    <option value="ALL">ทุกระดับชั้น (Admin/Director)</option>
                                    {GRADES.map(g => (
                                        <option key={g} value={g}>{GRADE_LABELS[g]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {editingTeacherId && (
                                <button onClick={() => { setEditingTeacherId(null); setNewTeacherName(''); setNewTeacherUser(''); setNewTeacherPass(''); setNewTeacherSchool(''); setNewTeacherGrade('ALL'); }} className="px-6 py-2 bg-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-300">ยกเลิก</button>
                            )}
                            <button onClick={handleSaveTeacher} disabled={isProcessing} className={`flex-1 text-white py-2 rounded-lg font-bold shadow transition ${editingTeacherId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-800 hover:bg-black'}`}>
                                {isProcessing ? 'กำลังบันทึก...' : (editingTeacherId ? 'บันทึกการแก้ไข' : '+ เพิ่มบัญชีครู')}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border overflow-hidden">
                        <div className="p-4 bg-gray-100 font-bold text-gray-600 border-b">รายชื่อครูทั้งหมด ({allTeachers.length})</div>
                        {allTeachers.length === 0 ? <div className="p-6 text-center text-gray-400">ไม่พบข้อมูล</div> : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr><th className="p-3">ชื่อ</th><th className="p-3">Username</th><th className="p-3">โรงเรียน</th><th className="p-3">ชั้น</th><th className="p-3 text-right">จัดการ</th></tr>
                                </thead>
                                <tbody>
                                    {allTeachers.map(t => (
                                        <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-3 font-bold">{t.name} {t.role === 'ADMIN' && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1 rounded ml-1">ADMIN</span>}</td>
                                            <td className="p-3 font-mono text-gray-500">{t.username}</td>
                                            <td className="p-3 text-gray-600">{t.school}</td>
                                            <td className="p-3 text-gray-600">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${!t.gradeLevel || t.gradeLevel === 'ALL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {(!t.gradeLevel || t.gradeLevel === 'ALL') ? 'ทุกชั้น' : GRADE_LABELS[t.gradeLevel] || t.gradeLevel}
                                                </span>
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
                        )}
                    </div>
                </div>
            )}

            {/* SUBJECT MANAGEMENT TAB */}
            {activeTab === 'subjects' && (
                <div className="max-w-3xl mx-auto">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Library className="text-pink-500"/> รายวิชาของฉัน</h3>
                    <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100 mb-6 shadow-sm">
                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><PlusCircle size={18}/> เพิ่มรายวิชาใหม่</h4>
                        
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อวิชา</label>
                                <input 
                                    type="text" 
                                    value={newSubjectName} 
                                    onChange={e => setNewSubjectName(e.target.value)} 
                                    placeholder="เช่น คณิตศาสตร์, สังคมศึกษา" 
                                    className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-pink-200 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ไอคอนประจำวิชา</label>
                                <div className="relative">
                                    <select value={newSubjectIcon} onChange={e => setNewSubjectIcon(e.target.value)} className="w-full p-3 border rounded-xl appearance-none bg-white pr-8 outline-none">
                                        {SUBJECT_ICONS.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                                        {SUBJECT_ICONS.find(i=>i.name===newSubjectIcon)?.component}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="text-xs font-bold text-gray-500 block mb-2">เลือกสีการ์ด</label>
                            <div className="flex flex-wrap gap-2">
                                {CARD_COLORS.map(c => (
                                    <button 
                                        key={c.name} 
                                        onClick={() => setNewSubjectColor(c.class)}
                                        className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${newSubjectColor === c.class ? 'ring-2 ring-pink-400 scale-105 shadow-md ' + c.class : 'bg-white border-gray-200 text-gray-500 opacity-60 hover:opacity-100'}`}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                            {/* Preview */}
                            <div className={`mt-4 p-4 rounded-xl border-2 flex items-center gap-3 ${newSubjectColor}`}>
                                <div className="bg-white/50 p-2 rounded-full">
                                    {SUBJECT_ICONS.find(i=>i.name===newSubjectIcon)?.component}
                                </div>
                                <span className="font-bold">{newSubjectName || 'ตัวอย่างชื่อวิชา'}</span>
                            </div>
                        </div>

                        <button onClick={handleAddSubject} disabled={!newSubjectName} className="w-full bg-pink-500 text-white py-3 rounded-xl font-bold shadow hover:bg-pink-600 disabled:opacity-50 transition">
                            บันทึกรายวิชา
                        </button>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-gray-700">รายวิชาที่มีอยู่ ({myCreatedSubjects.length})</h4>
                        {myCreatedSubjects.length === 0 ? (
                            <div className="text-gray-400 text-center py-10 border-2 border-dashed rounded-xl">ยังไม่ได้สร้างรายวิชา</div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-3">
                                {myCreatedSubjects.map(s => (
                                    <div key={s.id} className={`flex items-center justify-between p-4 border rounded-xl hover:shadow-md transition ${s.color}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm shadow-sm">
                                                {SUBJECT_ICONS.find(i => i.name === s.icon)?.component || <Book />}
                                            </div>
                                            <span className="font-bold">{s.name}</span>
                                        </div>
                                        <button onClick={() => handleDeleteSubject(s.id)} className="bg-white/50 hover:bg-white p-2 rounded-lg text-red-500 transition"><Trash2 size={18}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ASSIGNMENTS TAB */}
            {activeTab === 'assignments' && (
              <div className="max-w-4xl mx-auto">
                 <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-orange-500"/> สั่งงานใหม่</h4>
                    
                    {availableSubjects.length === 0 ? (
                        <div className="text-red-500 text-center p-4 bg-red-50 rounded-xl border border-red-200 mb-4">
                            กรุณาไปที่เมนู "จัดการรายวิชา" เพื่อเพิ่มวิชาก่อนสั่งงาน
                        </div>
                    ) : (
                    <div>
                        {/* Step 1: Assignment Details */}
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
                                        {canManageAll ? (
                                            <select value={assignGrade} onChange={(e) => setAssignGrade(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white outline-none">
                                                <option value="ALL">ทุกชั้น</option>
                                                {GRADES.map(g => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
                                            </select>
                                        ) : (
                                            <div className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-100 text-gray-600 font-bold flex items-center">{GRADE_LABELS[assignGrade] || assignGrade}</div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">จำนวนข้อที่ต้องการ</label>
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

                        {/* Step 2: AI Generation */}
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
                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200"><Key size={18}/></a>
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
                                    <p className="text-xs text-gray-400">ระบบจะสร้างข้อสอบทีละ 5 ข้อ จนกว่าจะครบตามจำนวนที่ต้องการ</p>
                                </div>

                                {/* Generated List */}
                                <div className="border rounded-xl overflow-hidden bg-white">
                                    <div className="bg-gray-100 p-3 flex justify-between items-center">
                                        <span className="font-bold text-gray-700 text-sm">รายการข้อสอบ ({newlyGeneratedQuestions.length}/{assignCount})</span>
                                        {newlyGeneratedQuestions.length > 0 && <button onClick={() => setNewlyGeneratedQuestions([])} className="text-xs text-red-500 hover:underline">ล้างทั้งหมด</button>}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                                        {newlyGeneratedQuestions.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีข้อสอบ กด "สร้าง" เพื่อเริ่ม</div>
                                        ) : (
                                            newlyGeneratedQuestions.map((q, i) => (
                                                <div key={i} className="p-3 border rounded-lg bg-gray-50 text-sm relative group">
                                                    <div className="font-bold text-gray-800 pr-6">{i+1}. {q.text}</div>
                                                    <div className="text-gray-500 text-xs mt-1">ตอบ: {q.correct} | {q.explanation}</div>
                                                    <button 
                                                        onClick={() => setNewlyGeneratedQuestions(prev => prev.filter((_, idx) => idx !== i))}
                                                        className="absolute top-2 right-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                
                                {newlyGeneratedQuestions.length < assignCount && (
                                    <div className="text-center text-xs text-orange-600 font-bold">
                                        ⚠️ ยังขาดอีก {assignCount - newlyGeneratedQuestions.length} ข้อ
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4 border-t">
                                    <button onClick={() => setAssignStep(1)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">ย้อนกลับ</button>
                                    <button 
                                        onClick={handleFinalizeAssignment}
                                        disabled={isProcessing || newlyGeneratedQuestions.length === 0}
                                        className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-600 disabled:opacity-50 disabled:bg-gray-300 flex justify-center items-center gap-2"
                                    >
                                        {isProcessing ? 'กำลังบันทึก...' : <><Save size={20}/> บันทึกการบ้าน</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                 </div>

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
                                                 <span className={`px-2 py-1 rounded-full font-bold text-xs ${submittedCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                     {submittedCount}
                                                 </span>
                                             </td>
                                             <td className="p-3 text-right flex justify-end gap-2">
                                                 <button onClick={() => handleViewAssignment(a)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Eye size={16} /></button>
                                                 <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
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

            {/* QUESTIONS TAB */}
            {activeTab === 'questions' && (
               <div className="max-w-6xl mx-auto">
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
                  
                  {/* Form เพิ่ม/แก้ไขข้อสอบ */}
                  <div id="question-form" className={`bg-white p-6 rounded-2xl shadow-sm border mb-8 ${editingQuestionId ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            {editingQuestionId ? '✏️ แก้ไขข้อสอบ' : '➕ เพิ่มข้อสอบใหม่ (Manual)'}
                        </h4>
                      </div>

                      {availableSubjects.length === 0 ? (
                           <div className="text-red-500 text-center p-4">กรุณาสร้างรายวิชาก่อนเพิ่มข้อสอบ</div>
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
                                <div className="w-full p-2 rounded-lg border border-gray-200 bg-gray-100 text-gray-600 font-bold">{GRADE_LABELS[qGrade] || qGrade}</div>
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
    
                  {/* Subject Filter Chips */}
                  {!showMyQuestionsOnly && (
                      <div className="flex flex-wrap gap-2 mb-6">
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
    
                  {/* Question List */}
                  {(qBankSubject || showMyQuestionsOnly) ? (
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                           <div className="p-4 bg-gray-50 font-bold text-gray-700">รายการข้อสอบ ({filteredQuestions.length})</div>
                           <div className="divide-y divide-gray-100">
                               {currentQuestions.map((q, idx) => (
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
                               ))}
                           </div>
                           
                           {/* Pagination */}
                           {filteredQuestions.length > ITEMS_PER_PAGE && (
                               <div className="p-4 border-t flex justify-center gap-2">
                                   <button disabled={qBankPage===1} onClick={()=>setQBankPage(p=>p-1)} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16}/></button>
                                   <span className="p-2 text-sm text-gray-500">หน้า {qBankPage}</span>
                                   <button disabled={qBankPage * ITEMS_PER_PAGE >= filteredQuestions.length} onClick={()=>setQBankPage(p=>p+1)} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16}/></button>
                               </div>
                           )}
                      </div>
                  ) : (
                      <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-2xl bg-gray-50">
                          กรุณาเลือกวิชา หรือกด "ของฉัน" เพื่อดูข้อสอบ
                      </div>
                  )}
               </div>
            )}
            
            {/* OTHER TABS (Students, Stats) */}
            {activeTab === 'students' && (
                <div className="max-w-4xl mx-auto">
                     <div className={`p-6 rounded-2xl border mb-8 shadow-sm transition-colors ${editingStudentId ? 'bg-orange-50 border-orange-100' : 'bg-purple-50 border-purple-100'}`}>
                         <h4 className={`font-bold mb-4 flex items-center gap-2 ${editingStudentId ? 'text-orange-800' : 'text-purple-800'}`}>
                            {editingStudentId ? <><Edit size={20}/> แก้ไขข้อมูลนักเรียน</> : <><UserPlus size={20}/> ลงทะเบียนนักเรียนใหม่</>}
                         </h4>
                         <div className="flex flex-col md:flex-row gap-3 mb-4">
                             <input type="text" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} className="flex-1 p-3 border rounded-xl bg-white" placeholder="ชื่อ-นามสกุล นักเรียน"/>
                             <div className="flex gap-1 overflow-x-auto p-1 bg-white border rounded-xl max-w-full md:max-w-[300px]">
                                 {['👦','👧','🧒','🧑','👓','🦄','🦁','🐼'].map(emoji => (
                                     <button key={emoji} onClick={()=>setNewStudentAvatar(emoji)} className={`p-2 rounded-lg border-2 transition text-xl ${newStudentAvatar===emoji?'border-purple-500 bg-purple-100 scale-110':'border-transparent hover:bg-gray-100'}`}>{emoji}</button>
                                 ))}
                             </div>
                         </div>
                         <div className="flex gap-2">
                             {editingStudentId && (
                                 <button onClick={handleCancelEdit} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition">ยกเลิก</button>
                             )}
                             <button onClick={handleSaveStudent} disabled={isSaving || !newStudentName} className={`flex-1 text-white py-3 rounded-xl font-bold shadow transition flex items-center justify-center gap-2 ${editingStudentId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                 {isSaving ? <RefreshCw className="animate-spin" /> : <Save size={20} />}
                                 {isSaving ? 'กำลังบันทึก...' : (editingStudentId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล')}
                             </button>
                         </div>
                     </div>
                     
                     <h4 className="font-bold text-gray-700 mb-2">รายชื่อนักเรียน ({students.length})</h4>
                     <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                         {students.length === 0 ? <div className="p-8 text-center text-gray-400">ยังไม่มีนักเรียน</div> : students.map(s => (
                             <div key={s.id} className="p-3 border-b last:border-0 hover:bg-gray-50 flex items-center justify-between group">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-xl shadow-sm border border-purple-100">{s.avatar}</div>
                                     <div>
                                         <div className="font-bold text-gray-800">{s.name}</div>
                                         <div className="text-xs text-gray-400 font-mono">ID: {s.id}</div>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 hidden md:inline-block">{GRADE_LABELS[s.grade || 'P6'] || s.grade}</span>
                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditStudent(s)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="แก้ไข"><Edit size={16}/></button>
                                        <button onClick={() => handleDeleteStudent(s.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition" title="ลบ"><Trash2 size={16}/></button>
                                    </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                </div>
            )}
            
            {activeTab === 'stats' && (
                <div className="p-4 text-center text-gray-400 py-20">
                    <BarChart2 size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>ระบบแสดงผลคะแนนสอบ (สามารถดูได้ที่หน้า Dashboard ปกติ)</p>
                </div>
            )}
        </div>
      )}
      
      {/* Modal for viewing assignment details */}
      {selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Calendar size={20} className="text-blue-600"/> รายละเอียดการส่งงาน</h3>
                      <button onClick={() => setSelectedAssignment(null)} className="text-gray-400 hover:text-red-500 transition"><X size={24}/></button>
                  </div>
                  <div className="p-4 bg-blue-50 border-b">
                      <div className="font-bold text-blue-900 text-lg">{selectedAssignment.title || selectedAssignment.subject}</div>
                      <div className="text-sm text-blue-700 mt-1 flex gap-4">
                          <span>วิชา: <b>{selectedAssignment.subject}</b></span>
                          <span>ข้อสอบ: <b>{selectedAssignment.questionCount} ข้อ</b></span>
                          <span>กำหนดส่ง: <b>{formatDate(selectedAssignment.deadline)}</b></span>
                      </div>
                  </div>

                  {/* TABS */}
                  <div className="flex border-b">
                     <button 
                        onClick={() => setAssignmentModalTab('status')} 
                        className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 ${assignmentModalTab === 'status' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                     >
                        <Users size={16}/> สถานะการส่ง
                     </button>
                     <button 
                        onClick={() => setAssignmentModalTab('questions')} 
                        className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 ${assignmentModalTab === 'questions' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                     >
                        <List size={16}/> ข้อสอบที่ใช้
                     </button>
                  </div>

                  <div className="overflow-y-auto p-4 flex-1 bg-gray-50">
                      
                      {/* STATUS TAB */}
                      {assignmentModalTab === 'status' && (
                          students.length === 0 ? <div className="text-center py-10 text-gray-400">ไม่มีนักเรียนในโรงเรียนนี้</div> : (
                          <table className="w-full text-sm text-left bg-white rounded-xl shadow-sm">
                              <thead>
                                  <tr className="text-gray-600 border-b bg-gray-100"><th className="p-3 rounded-tl-xl">ชื่อนักเรียน</th><th className="p-3 text-center">สถานะ</th><th className="p-3 text-right">คะแนน</th><th className="p-3 text-right rounded-tr-xl">เวลาที่ส่ง</th></tr>
                              </thead>
                              <tbody>
                                  {students.map(s => {
                                      // หาผลสอบของการบ้านชิ้นนี้ (เอาล่าสุด)
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
                          )
                      )}

                      {/* QUESTIONS TAB */}
                      {assignmentModalTab === 'questions' && (
                          <div className="space-y-3">
                              {getAssignmentQuestions(selectedAssignment).map((q, idx) => (
                                  <div key={q.id || idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                      <div className="flex gap-3">
                                          <div className="bg-blue-100 text-blue-700 font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                                              {idx + 1}
                                          </div>
                                          <div className="flex-1">
                                              <div className="font-bold text-gray-800 mb-2">{q.text}</div>
                                              {q.image && <img src={q.image} className="h-20 object-contain mb-2 rounded bg-gray-50 border"/>}
                                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                                                  {q.choices.map((c, i) => (
                                                      <div key={i} className={`p-2 rounded border ${String(i+1) === String(q.correctChoiceId) ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-gray-50 border-gray-100'}`}>
                                                          {['ก','ข','ค','ง'][i]}. {c.text}
                                                      </div>
                                                  ))}
                                              </div>
                                              <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                                                  <span className="font-bold">เฉลย:</span> {q.explanation || '-'}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                              {getAssignmentQuestions(selectedAssignment).length === 0 && (
                                  <div className="text-center text-gray-400 py-10">ไม่พบข้อมูลข้อสอบ</div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
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