
import React, { useState } from 'react';
import { Teacher } from '../types';
import { ArrowLeft, GraduationCap, Lock } from 'lucide-react';
import { teacherLogin } from '../services/api';

interface TeacherLoginProps {
  onLoginSuccess: (teacher: Teacher) => void;
  onBack: () => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border-t-4 border-purple-500">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> กลับหน้าหลัก
        </button>

        <div className="text-center mb-8">
          <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
            <GraduationCap size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">ระบบจัดการคุณครู</h2>
          <p className="text-gray-500 text-sm">เข้าสู่ระบบเพื่อจัดการข้อมูลนักเรียน</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition"
              placeholder="Username"
              required
            />
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
           <p className="text-xs text-gray-400">สำหรับแอดมิน: เพิ่มรายชื่อครูใน Sheet 'Teachers'</p>
        </div>
      </div>
    </div>
  );
};

export default TeacherLogin;
