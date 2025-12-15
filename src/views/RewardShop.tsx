
import React, { useState } from 'react';
import { Student, ShopItem } from '../types';
import { ArrowLeft, Star, ShoppingBag, Gift, Ticket, CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { speak } from '../utils/soundUtils';
import { supabase } from '../services/firebaseConfig';

interface RewardShopProps {
  student: Student;
  onBack: () => void;
  onPurchase: (updatedStudent: Student) => void;
}

// 🟢 รายการของรางวัล (ออกแบบให้ดึงดูดใจ ป.6 - ม.3)
const SHOP_ITEMS: ShopItem[] = [
    // --- ระดับ 1: Digital Collectibles (ราคาถูก) ---
    { id: 'item_sword', name: 'ดาบผู้กล้า O-NET', description: 'อาวุธในตำนานสำหรับนักรบวิชาการ', price: 50, icon: '⚔️', type: 'DIGITAL', color: 'bg-red-50 border-red-200 text-red-600' },
    { id: 'item_shield', name: 'โล่กันลืม', description: 'ป้องกันการลืมสูตรคูณและมาตราตัวสะกด', price: 50, icon: '🛡️', type: 'DIGITAL', color: 'bg-blue-50 border-blue-200 text-blue-600' },
    { id: 'item_crown', name: 'มงกุฎราชาสอบผ่าน', description: 'สวมใส่เพื่อแสดงความเป็นหนึ่งในปฐพี', price: 100, icon: '👑', type: 'DIGITAL', color: 'bg-yellow-50 border-yellow-200 text-yellow-600' },
    { id: 'item_dragon', name: 'มังกรเฝ้าสมบัติ', description: 'สัตว์เลี้ยงระดับตำนาน หายากมาก', price: 150, icon: '🐉', type: 'DIGITAL', color: 'bg-purple-50 border-purple-200 text-purple-600' },

    // --- ระดับ 2: Privilege Coupons (ราคาแพง - สิทธิพิเศษจริง) ---
    { id: 'coupon_homework', name: 'บัตรผ่านการบ้าน 1 ชิ้น', description: 'ใช้ยื่นครูเพื่อของดส่งการบ้าน 1 ครั้ง (เฉพาะวิชาที่ร่วมรายการ)', price: 300, icon: '🎟️', type: 'PRIVILEGE', color: 'bg-green-50 border-green-200 text-green-700' },
    { id: 'coupon_music', name: 'ดีเจจำเป็น (ขอเพลงในคาบ)', description: 'สิทธิ์ขอเปิดเพลงที่ชอบระหว่างทำงานในคาบเรียน', price: 200, icon: '🎵', type: 'PRIVILEGE', color: 'bg-pink-50 border-pink-200 text-pink-600' },
    { id: 'coupon_seat', name: 'บัตรเลือกที่นั่ง V.I.P.', description: 'สิทธิ์ย้ายไปนั่งตรงไหนก็ได้ในห้องเรียน 1 วัน', price: 250, icon: '🪑', type: 'PRIVILEGE', color: 'bg-orange-50 border-orange-200 text-orange-600' },
    { id: 'coupon_score', name: 'คะแนนช่วยชีวิต (+1)', description: 'บวกคะแนนเก็บเพิ่ม 1 คะแนน (สะสมได้สูงสุด 5 ใบ)', price: 500, icon: '💯', type: 'PRIVILEGE', color: 'bg-indigo-50 border-indigo-200 text-indigo-600' },
];

const RewardShop: React.FC<RewardShopProps> = ({ student, onBack, onPurchase }) => {
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCoupon, setShowCoupon] = useState<ShopItem | null>(null);

  const handleBuy = async (item: ShopItem) => {
      if (student.stars < item.price) {
          speak('ดาวสะสมไม่พอครับ พยายามทำข้อสอบเพิ่มนะ');
          return;
      }

      if (student.inventory?.includes(item.name) && item.type === 'DIGITAL') {
          speak('คุณมีไอเทมนี้แล้ว');
          return;
      }

      if (!confirm(`ยืนยันการแลก "${item.name}" ด้วย ${item.price} ดาว?`)) return;

      setIsProcessing(true);
      
      try {
          const newStars = student.stars - item.price;
          // Item name to store (Append timestamp for privileges to allow multiples)
          const itemNameToStore = item.type === 'PRIVILEGE' 
            ? `${item.name} #${Date.now().toString().slice(-4)}` 
            : item.name;
            
          const newInventory = [...(student.inventory || []), itemNameToStore];

          // Update Supabase
          const { error } = await supabase.from('students').update({
              stars: newStars,
              inventory: newInventory
          }).eq('id', student.id);

          if (error) throw error;

          // Update Local State
          const updatedStudent = { ...student, stars: newStars, inventory: newInventory };
          onPurchase(updatedStudent);
          
          speak(`แลกของรางวัลสำเร็จ ยินดีด้วยครับ`);
          
          if (item.type === 'PRIVILEGE') {
              setShowCoupon(item);
          } else {
              alert(`🎉 ได้รับ "${item.name}" แล้ว! เช็คในกระเป๋าของฉันได้เลย`);
          }
          
          setSelectedItem(null);

      } catch (e) {
          console.error(e);
          alert('เกิดข้อผิดพลาดในการแลกของรางวัล');
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in relative">
        
        {/* COUPON MODAL */}
        {showCoupon && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-bounce-in">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-center pt-10 pb-16 relative">
                        <div className="absolute top-4 left-4 text-white/50 text-xs font-bold tracking-widest">COUPON</div>
                        <h3 className="text-3xl font-black text-white drop-shadow-md">{showCoupon.name}</h3>
                        <p className="text-white/90 text-sm mt-2">{showCoupon.description}</p>
                        
                        {/* Cutout Circles */}
                        <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-gray-900 rounded-full"></div>
                        <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-gray-900 rounded-full"></div>
                    </div>
                    <div className="bg-white p-6 text-center pt-10">
                        <div className="text-6xl mb-4">{showCoupon.icon}</div>
                        <div className="bg-gray-100 p-4 rounded-xl border-2 border-dashed border-gray-300 mb-6">
                            <div className="text-xs text-gray-400 uppercase font-bold mb-1">CODE</div>
                            <div className="text-2xl font-mono font-bold text-gray-700 tracking-widest">
                                {Math.random().toString(36).substring(2, 8).toUpperCase()}
                            </div>
                        </div>
                        <p className="text-xs text-red-500 mb-4">* แคปหน้าจอนี้ไว้เพื่อยื่นให้คุณครู *</p>
                        <button onClick={() => setShowCoupon(null)} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold">ปิดหน้าต่าง</button>
                    </div>
                </div>
            </div>
        )}

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
                        <p className="text-pink-100 text-sm">ใช้ความพยายามของคุณ แลกของรางวัลสุดพิเศษ!</p>
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
            
            {/* Background Decorations */}
            <Star className="absolute top-4 right-20 text-white/10 w-24 h-24 rotate-12" />
            <Gift className="absolute -bottom-4 -left-4 text-white/10 w-32 h-32 -rotate-12" />
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHOP_ITEMS.map((item) => {
                const canAfford = student.stars >= item.price;
                const isOwned = item.type === 'DIGITAL' && student.inventory?.includes(item.name);
                
                return (
                    <div 
                        key={item.id} 
                        className={`group relative bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col ${isOwned ? 'border-gray-200 opacity-80' : canAfford ? 'border-gray-100 hover:border-purple-400 hover:shadow-xl hover:-translate-y-1' : 'border-gray-200 opacity-60 grayscale'}`}
                    >
                        {/* Card Header & Icon */}
                        <div className={`p-6 flex flex-col items-center justify-center flex-1 ${item.color.split(' ')[0]}`}>
                            <div className="text-6xl drop-shadow-md group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                            {isOwned && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                    <CheckCircle size={10} /> OWNED
                                </div>
                            )}
                            {item.type === 'PRIVILEGE' && (
                                <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                                    COUPON
                                </div>
                            )}
                        </div>

                        {/* Details & Action */}
                        <div className="p-4 flex flex-col gap-2">
                            <h3 className="font-bold text-gray-800 text-lg leading-tight">{item.name}</h3>
                            <p className="text-xs text-gray-500 h-8 line-clamp-2">{item.description}</p>
                            
                            <button
                                onClick={() => handleBuy(item)}
                                disabled={!canAfford || !!isOwned || isProcessing}
                                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-2
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
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${canAfford ? 'bg-white/20' : 'bg-transparent'}`}>
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
