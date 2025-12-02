
import React, { useState } from 'react';
import { Teacher } from '../types';
import { ArrowLeft, GraduationCap, Lock, School, UserPlus, X, CreditCard, User } from 'lucide-react';
import { teacherLogin, requestRegistration } from '../services/api';

interface TeacherLoginProps {
  onLoginSuccess: (teacher: Teacher) => void;
  onBack: () => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Registration Modal State
  const [showRegister, setShowRegister] = useState(false);
  const [regCitizenId, setRegCitizenId] = useState('');
  const [regName, setRegName] = useState('');
  const [regSurname, setRegSurname] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await teacherLogin(username, password);
      if (result.success && result.teacher) {
        onLoginSuccess(result.teacher);
      } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setPassword('');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regCitizenId || !regName || !regSurname) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      if (regCitizenId.length !== 13) return alert('เลขบัตรประชาชนต้องมี 13 หลัก');

      setRegLoading(true);
      const res = await requestRegistration(regCitizenId, regName, regSurname);
      setRegLoading(false);

      if (res.success) {
          alert(res.message);
          setShowRegister(false);
          setRegCitizenId(''); setRegName(''); setRegSurname('');
      } else {
          alert(res.message);
      }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] relative">
      
      {/* REGISTER MODAL */}
      {showRegister && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex justify-between items-center text-white">
                      <h3 className="font-bold text-xl flex items-center gap-2"><UserPlus size={24}/> สมัครสมาชิกใหม่</h3>
                      <button onClick={() => setShowRegister(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-gray-500 text-sm mb-4">กรุณากรอกข้อมูลจริงเพื่อรอการยืนยันจากผู้ดูแลระบบ</p>
                      <form onSubmit={handleRegister} className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">เลขประจำตัวประชาชน (ใช้เป็น Username)</label>
                              <div className="relative">
                                  <input type="text" maxLength={13} value={regCitizenId} onChange={e => setRegCitizenId(e.target.value.replace(/[^0-9]/g, ''))} className="w-full p-3 pl-10 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none transition" placeholder="เลข 13 หลัก" />
                                  <CreditCard className="absolute left-3 top-3.5 text-gray-400" size={18} />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อ</label>
                                  <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none" placeholder="สมชาย" />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">นามสกุล</label>
                                  <input type="text" value={regSurname} onChange={e => setRegSurname(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none" placeholder="ใจดี" />
                              </div>
                          </div>
                          
                          <button disabled={regLoading} type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50 mt-2">
                              {regLoading ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอสมัครสมาชิก'}
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border-t-4 border-purple-500">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> กลับหน้าหลัก
        </button>

        <div className="text-center mb-8">
          <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
            <School size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">LittleSchool Teacher</h2>
          <p className="text-gray-500 text-sm">ระบบจัดการการเรียนรู้สำหรับคุณครู</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้ / เลขบัตรประชาชน</label>
            <div className="relative">
                <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition"
                placeholder="Username"
                required
                />
                <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
            <div className="relative">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition pl-10"
                placeholder="••••••"
                required
              />
              <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all 
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 hover:shadow-purple-200 active:scale-95'}
            `}
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
           <p className="text-xs text-gray-400 mb-2">ยังไม่มีบัญชีใช่ไหม?</p>
           <button onClick={() => setShowRegister(true)} className="text-purple-600 font-bold text-sm hover:underline hover:text-purple-800 transition">
               สมัครสมาชิกใหม่ (สำหรับครู)
           </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherLogin;
