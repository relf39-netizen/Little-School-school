
import React, { useState } from 'react';
import { Student, ShopItem } from '../types';
import { ArrowLeft, Star, ShoppingBag, Gift, CheckCircle, Lock, AlertCircle, X, Sparkles } from 'lucide-react';
import { speak } from '../utils/soundUtils';
import { supabase } from '../services/firebaseConfig';

interface RewardShopProps {
  student: Student;
  onBack: () => void;
  onPurchase: (updatedStudent: Student) => void;
}

// 🟢 รายการของรางวัล 16 อย่าง (เน้นสร้างสรรค์ จินตนาการ และเชิงบวก)
const SHOP_ITEMS: ShopItem[] = [
    // --- หมวด 1: ของวิเศษ & แฟนตาซี (Fantasy Items) ---
    { id: 'i1', name: 'ลูกอมพลังบวก', description: 'กินแล้วสดชื่น (ในจินตนาการ) พร้อมเรียนรู้วันใหม่', price: 30, icon: '🍬', type: 'DIGITAL', color: 'bg-pink-50 border-pink-200 text-pink-600' },
    { id: 'i2', name: 'ดินสอเขียนสวย', description: 'ไอเทมที่ช่วยให้ตั้งใจคัดลายมือมากขึ้น', price: 40, icon: '✏️', type: 'DIGITAL', color: 'bg-yellow-50 border-yellow-200 text-yellow-600' },
    { id: 'i3', name: 'คฑาวิเศษ', description: 'เสกความรู้เข้าสมอง (แต่ต้องอ่านหนังสือด้วยนะ)', price: 80, icon: '🪄', type: 'DIGITAL', color: 'bg-purple-50 border-purple-200 text-purple-600' },
    { id: 'i4', name: 'เสื้อคลุมล่องหน', description: 'ใส่แล้วรู้สึกเบาสบาย เหมือนลอยตัวได้', price: 100, icon: '🧥', type: 'DIGITAL', color: 'bg-gray-50 border-gray-200 text-gray-600' },
    { id: 'i5', name: 'ดาบผู้กล้า', description: 'อาวุธในตำนานสำหรับผู้มีความกล้าหาญ', price: 120, icon: '⚔️', type: 'DIGITAL', color: 'bg-red-50 border-red-200 text-red-600' },

    // --- หมวด 2: สัตว์เลี้ยงน่ารัก (Cute Pets) ---
    { id: 'i6', name: 'ลูกแมวนำโชค', description: 'แมวน้อยน่ารัก คอยให้กำลังใจเวลาทำการบ้าน', price: 150, icon: '🐱', type: 'DIGITAL', color: 'bg-orange-50 border-orange-200 text-orange-600' },
    { id: 'i7', name: 'กระต่ายดวงจันทร์', description: 'กระต่ายน้อยหูยาว กระโดดดึ๋งๆ น่ากอด', price: 150, icon: '🐰', type: 'DIGITAL', color: 'bg-pink-50 border-pink-200 text-pink-600' },
    { id: 'i8', name: 'มังกรจิ๋วพ่นไฟ', description: 'สัตว์เลี้ยงในตำนาน (ระวังร้อนนะ!)', price: 300, icon: '🐉', type: 'DIGITAL', color: 'bg-emerald-50 border-emerald-200 text-emerald-600' },

    // --- หมวด 3: ซูเปอร์ฮีโร่ & ผู้กล้า (Heroes) ---
    { id: 'i9', name: 'หน้ากากฮีโร่', description: 'สวมใส่เพื่อผดุงความยุติธรรมในห้องเรียน', price: 200, icon: '🎭', type: 'DIGITAL', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { id: 'i10', name: 'โล่กัปตัน', description: 'ป้องกันความเกียจคร้าน แข็งแกร่งที่สุด', price: 250, icon: '🛡️', type: 'DIGITAL', color: 'bg-red-50 border-red-200 text-red-700' },
    { id: 'i11', name: 'มงกุฎพระราชา', description: 'สวมใส่เพื่อแสดงความเป็นผู้นำที่ยิ่งใหญ่', price: 400, icon: '👑', type: 'DIGITAL', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { id: 'i12', name: 'หุ่นยนต์พิทักษ์โลก', description: 'หุ่นรบสุดเท่ คอยดูแลความสงบสุข', price: 500, icon: '🤖', type: 'DIGITAL', color: 'bg-indigo-50 border-indigo-200 text-indigo-600' },

    // --- หมวด 4: ยานพาหนะในฝัน (Dream Vehicles) ---
    { id: 'i13', name: 'จักรยานสายฟ้า', description: 'ปั่นเร็วปานสายฟ้าแลบ ไปโรงเรียนทันเวลา', price: 300, icon: '🚲', type: 'DIGITAL', color: 'bg-green-50 border-green-200 text-green-600' },
    { id: 'i14', name: 'มอเตอร์ไซค์อนาคต', description: 'ดีไซน์ล้ำยุค ขับเคลื่อนด้วยพลังแสงอาทิตย์', price: 450, icon: '🏍️', type: 'DIGITAL', color: 'bg-cyan-50 border-cyan-200 text-cyan-600' },
    { id: 'i15', name: 'เครื่องบินเจ็ท', description: 'บินลัดฟ้าพาไปเที่ยวรอบโลกในจินตนาการ', price: 600, icon: '✈️', type: 'DIGITAL', color: 'bg-sky-50 border-sky-200 text-sky-600' },
    { id: 'i16', name: 'จรวดไปดาวอังคาร', description: 'ยานพาหนะสุดยอด สำหรับนักสำรวจอวกาศ', price: 800, icon: '🚀', type: 'DIGITAL', color: 'bg-gray-50 border-gray-200 text-gray-800' },
];

const RewardShop: React.FC<RewardShopProps> = ({ student, onBack, onPurchase }) => {
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [santaReward, setSantaReward] = useState<ShopItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. กดเลือกของ -> แสดงหน้าต่างยืนยัน
  const handleSelect = (item: ShopItem) => {
      if (student.stars < item.price) {
          speak('ดาวไม่พอครับ');
          return;
      }
      if (student.inventory?.includes(item.name)) {
          speak('มีไอเทมนี้แล้วครับ');
          return;
      }
      setConfirmItem(item);
  };

  // 2. กดยืนยัน -> ตัดแต้ม -> แสดงซานตาคลอส
  const handleConfirmPurchase = async () => {
      if (!confirmItem) return;
      setIsProcessing(true);
      
      try {
          const newStars = student.stars - confirmItem.price;
          const itemNameToStore = confirmItem.name;
            
          const newInventory = [...(student.inventory || []), itemNameToStore];

          // Update DB
          const { error } = await supabase.from('students').update({
              stars: newStars,
              inventory: newInventory
          }).eq('id', student.id);

          if (error) throw error;

          // Update Local
          const updatedStudent = { ...student, stars: newStars, inventory: newInventory };
          onPurchase(updatedStudent);
          
          speak('แลกรางวัลสำเร็จ ยินดีด้วยครับ');
          
          // Show Santa
          setSantaReward(confirmItem); 
          setConfirmItem(null); // Close confirm modal

      } catch (e) {
          console.error(e);
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleCloseSanta = () => {
      setSantaReward(null);
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-fade-in relative">
        
        {/* 🔥 1. CONFIRMATION MODAL */}
        {confirmItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl transform scale-100 transition-all">
                    <div className="p-6 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl shadow-inner border-4 border-white">
                            {confirmItem.icon}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ยืนยันการแลกรางวัล?</h3>
                        <p className="text-gray-500 text-sm mb-4">คุณต้องการใช้ <span className="font-bold text-yellow-500 bg-yellow-50 px-2 rounded-lg">{confirmItem.price} ดาว</span> <br/>เพื่อแลก "{confirmItem.name}" ใช่ไหม?</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmItem(null)} 
                                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                onClick={handleConfirmPurchase}
                                disabled={isProcessing}
                                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition flex items-center justify-center gap-2"
                            >
                                {isProcessing ? 'กำลังแลก...' : 'ยืนยัน!'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* 🎅 2. SANTA SUCCESS MODAL */}
        {santaReward && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-bounce-in">
                <div className="relative bg-gradient-to-b from-red-600 to-red-800 rounded-[40px] w-full max-w-sm p-1 shadow-2xl border-4 border-yellow-400 overflow-visible text-center">
                    
                    {/* Background Rays */}
                    <div className="absolute inset-0 overflow-hidden rounded-[36px]">
                        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg_at_50%_50%,rgba(255,255,255,0.1)_0deg,transparent_60deg,rgba(255,255,255,0.1)_120deg,transparent_180deg,rgba(255,255,255,0.1)_240deg,transparent_300deg,rgba(255,255,255,0.1)_360deg)] animate-[spin_10s_linear_infinite]"></div>
                    </div>

                    {/* Decor */}
                    <Sparkles className="absolute top-4 left-4 text-yellow-300 animate-pulse" size={32}/>
                    <Sparkles className="absolute bottom-4 right-4 text-yellow-300 animate-pulse" size={32} style={{animationDelay: '0.5s'}}/>

                    <div className="relative bg-white/10 backdrop-blur-sm rounded-[36px] p-6 pt-20">
                        {/* Santa Image (Floating on top) */}
                        <div className="absolute -top-24 left-1/2 transform -translate-x-1/2 w-48 drop-shadow-2xl animate-bounce">
                            <img src="https://cdn-icons-png.flaticon.com/512/744/744546.png" alt="Santa" className="w-full h-full object-contain"/>
                        </div>

                        <h2 className="text-3xl font-black text-white drop-shadow-md mb-2 mt-4">โฮ่ โฮ่ โฮ่!</h2>
                        <p className="text-red-100 font-medium mb-6">ยินดีด้วย! รับรางวัลไปเลยเด็กดี</p>

                        <div className="bg-white rounded-2xl p-6 shadow-xl transform rotate-1 hover:rotate-0 transition duration-300 border-b-4 border-gray-200">
                            <div className="text-6xl mb-2">{santaReward.icon}</div>
                            <h3 className="text-xl font-bold text-gray-800">{santaReward.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">ไอเทมสะสมสุดพิเศษ</p>
                        </div>

                        <button 
                            onClick={handleCloseSanta}
                            className="mt-8 w-full bg-yellow-400 text-red-900 font-black py-4 rounded-2xl shadow-[0_4px_0_rgb(180,83,9)] active:shadow-none active:translate-y-1 transition text-xl uppercase tracking-wider"
                        >
                            รับของขวัญ
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- MAIN UI --- */}
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
            <ArrowLeft size={20} /> กลับหน้าหลัก
        </button>

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden mb-8">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                        <ShoppingBag size={40} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold mb-1">ร้านค้าแลกรางวัล</h2>
                        <p className="text-pink-100 text-sm">ใช้ความพยายามของคุณ แลกของรางวัลสุดสร้างสรรค์!</p>
                    </div>
                </div>
                
                <div className="bg-black/30 px-6 py-3 rounded-full flex items-center gap-3 border-2 border-yellow-400/50 shadow-lg">
                    <div className="text-yellow-300 font-bold uppercase text-xs tracking-wider">Balance</div>
                    <div className="flex items-center gap-2">
                        <Star className="text-yellow-400 fill-yellow-400 animate-pulse" size={24} />
                        <span className="text-3xl font-black">{student.stars}</span>
                    </div>
                </div>
            </div>
            <Star className="absolute top-4 right-20 text-white/10 w-24 h-24 rotate-12" />
            <Gift className="absolute -bottom-4 -left-4 text-white/10 w-32 h-32 -rotate-12" />
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {SHOP_ITEMS.map((item) => {
                const canAfford = student.stars >= item.price;
                const isOwned = student.inventory?.includes(item.name);
                
                return (
                    <div 
                        key={item.id} 
                        className={`group relative bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col ${isOwned ? 'border-gray-200 opacity-80' : canAfford ? 'border-gray-100 hover:border-purple-400 hover:shadow-xl hover:-translate-y-1' : 'border-gray-200 opacity-60 grayscale'}`}
                    >
                        {/* Card Header & Icon */}
                        <div className={`p-6 flex flex-col items-center justify-center flex-1 ${item.color.split(' ')[0]}`}>
                            <div className="text-5xl md:text-6xl drop-shadow-md group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                            {isOwned && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                    <CheckCircle size={10} /> OWNED
                                </div>
                            )}
                        </div>

                        {/* Details & Action */}
                        <div className="p-4 flex flex-col gap-2">
                            <h3 className="font-bold text-gray-800 text-sm md:text-lg leading-tight truncate">{item.name}</h3>
                            <p className="text-xs text-gray-500 h-8 line-clamp-2">{item.description}</p>
                            
                            <button
                                onClick={() => handleSelect(item)}
                                disabled={!canAfford || !!isOwned || isProcessing}
                                className={`w-full py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all mt-2
                                    ${isOwned 
                                        ? 'bg-gray-100 text-gray-400 cursor-default' 
                                        : canAfford 
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:shadow-purple-200 active:scale-95' 
                                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    }
                                `}
                            >
                                {isOwned ? (
                                    'แลกแล้ว'
                                ) : (
                                    <>
                                        {canAfford ? 'แลกรางวัล' : <><Lock size={14}/> ล็อค</>}
                                        <span className={`px-1.5 py-0.5 rounded ${canAfford ? 'bg-white/20' : 'bg-transparent'}`}>
                                            ⭐ {item.price}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
        
        {!SHOP_ITEMS.some(i => student.stars >= i.price) && (
            <div className="mt-8 text-center bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-yellow-800 flex items-center justify-center gap-2 animate-pulse">
                <AlertCircle size={20}/> คะแนนดาวไม่พอแลกรางวัล พยายามทำข้อสอบ O-NET เพิ่มเพื่อสะสมดาวนะ!
            </div>
        )}
    </div>
  );
};

export default RewardShop;
