/**
 * characters.js — Danh sách nhân vật chó
 * Thêm nhân vật mới: copy một object và chỉnh các thuộc tính.
 */

export const CHARACTERS = [
  {
    id: 'shiba',
    name: 'Shiba Inu',
    title: 'Chiến Binh Cân Bằng',
    emoji: '🐕',
    /** Màu thân chính */
    color: '#E8943A',
    /** Màu thứ cấp (tai, chân sau, điểm nhấn) */
    altColor: '#C4642A',
    /** Màu bụng / snout */
    bellyColor: '#F5D5A0',
    description: 'Cân bằng mọi mặt. Phù hợp người mới bắt đầu.',
    stats: {
      /** 1-5: lực mỗi tiếng sủa */
      power: 3,
      /** 1-5: tốc độ — cao = thưởng lực khi sủa liền nhau (tới +20%); với nút chạm/AI còn là nhịp sủa (250–450ms). Mic không bị chặn. */
      speed: 3,
      /** 1-5: combo — cao = giữ combo lâu hơn và mỗi bậc cộng nhiều hơn */
      combo: 3,
    },
    /** Loại tai để vẽ: 'pointy' | 'floppy' | 'round' */
    earType: 'pointy',
    unlocked: true,
    wpCost: 0,
    /** Từ bay ra khi sủa */
    barkWords: ['GÂU!', 'GÂU GÂU!', 'AU AU!', 'SỦA!', 'WOF!'],
    /** Màu chữ bark */
    barkColor: 'hsl(35, 90%, 60%)',
    /** Đặc điểm đặc biệt (null = không có) */
    special: null,
    /** Mô tả special */
    specialDesc: '',
  },
  {
    id: 'pug',
    name: 'Pug Chiến',
    title: 'Kẻ Đấm Chậm Mà Đau',
    emoji: '🐶',
    color: '#C49A6C',
    altColor: '#8B6340',
    bellyColor: '#E8C99A',
    description: 'Mỗi cú sủa cực mạnh, nhưng sủa chậm và combo ngắn. Hợp người sủa to, thưa.',
    stats: { power: 5, speed: 1, combo: 2 },
    earType: 'floppy',
    unlocked: false,
    wpCost: 200,
    barkWords: ['WOOF!', 'BARK!', 'BOW!', 'GRR!', 'BẦU!'],
    barkColor: 'hsl(0, 85%, 60%)',
    special: 'heavyHitter',
    specialDesc: '+30% lực mỗi bark khi combo < 2',
  },
  {
    id: 'corgi',
    name: 'Corgi Flash',
    title: 'Tốc Độ Ánh Sáng',
    emoji: '🦊',
    color: '#F0A030',
    altColor: '#C07010',
    bellyColor: '#FFF0D0',
    description: 'Sủa dồn dập, giữ combo rất lâu, nhưng mỗi tiếng khá nhẹ. Hợp người sủa nhanh.',
    stats: { power: 2, speed: 5, combo: 5 },
    earType: 'pointy',
    unlocked: false,
    wpCost: 200,
    barkWords: ['YIP!', 'ARF!', 'YIPE!', 'WEF!', 'KÊU!'],
    barkColor: 'hsl(50, 90%, 55%)',
    special: 'fastCombo',
    specialDesc: 'Combo window +50%, dễ lên combo hơn',
  },
  {
    id: 'chow',
    name: 'Chow Chow Boss',
    title: 'Huyền Thoại Sủa',
    emoji: '🦁',
    color: '#8B4513',
    altColor: '#5C2D0A',
    bellyColor: '#C07040',
    description: 'Sủa nhỏ vẫn đẩy mạnh, tốc độ vừa phải. Boss level.',
    stats: { power: 4, speed: 2, combo: 3 },
    earType: 'round',
    unlocked: false,
    wpCost: 500,
    barkWords: ['GRRR!', 'ROAR!', 'HOWL!', 'RÚ!', 'RẦMM!'],
    barkColor: 'hsl(15, 95%, 55%)',
    special: 'volumeBoost',
    specialDesc: 'Volume được nhân x1.15 khi tính lực đẩy',
  },
  {
    id: 'golden',
    name: 'Golden Retriever',
    title: 'Chú Chó Thân Thiện',
    emoji: '🦮',
    color: '#E8A850', altColor: '#C27A2A', bellyColor: '#F6D9A0',
    description: 'Sủa đều tay, lực khá, combo bền. Chơi ổn định cả trận.',
    stats: { power: 4, speed: 3, combo: 3 },
    earType: 'floppy', unlocked: true, wpCost: 0,
    barkWords: ['GÂU!', 'WOOF!', 'GÂU GÂU!', 'AU!', 'WOF WOF!'],
    barkColor: 'hsl(38, 92%, 58%)', special: null, specialDesc: '',
  },
  {
    id: 'husky',
    name: 'Husky',
    title: 'Ca Sĩ Tuyết Sơn',
    emoji: '🐺',
    color: '#8A93A3', altColor: '#4E5663', bellyColor: '#F2F2F4',
    description: 'Hú dài, combo dai. Sủa liên tục thì rất đáng gờm.',
    stats: { power: 3, speed: 3, combo: 4 },
    earType: 'pointy', unlocked: false, wpCost: 150,
    barkWords: ['AWOO!', 'HÚÚ!', 'GÂU!', 'AROO!', 'WOO!'],
    barkColor: 'hsl(205, 85%, 62%)', special: null, specialDesc: '',
  },
  {
    id: 'poodle',
    name: 'Poodle Bông',
    title: 'Cục Bông Nóng Tính',
    emoji: '🐩',
    color: '#F1E1D3', altColor: '#D8BFA9', bellyColor: '#FFF7EE',
    description: 'Sủa the thé, cực nhanh nhưng nhẹ. Hợp người sủa dồn dập.',
    stats: { power: 2, speed: 5, combo: 4 },
    earType: 'round', unlocked: false, wpCost: 150,
    barkWords: ['YIP!', 'ÂU ÂU!', 'YAP!', 'GÂU!', 'ARF!'],
    barkColor: 'hsl(285, 70%, 65%)', special: null, specialDesc: '',
  },
  {
    id: 'beagle',
    name: 'Beagle',
    title: 'Thám Tử Mũi Thính',
    emoji: '🐕‍🦺',
    color: '#D98C3E', altColor: '#7A4A22', bellyColor: '#FFF1DC',
    description: 'Cân bằng, thiên về nhịp sủa nhanh và combo.',
    stats: { power: 3, speed: 4, combo: 4 },
    earType: 'floppy', unlocked: false, wpCost: 200,
    barkWords: ['BAROO!', 'AU!', 'GÂU!', 'BOW WOW!', 'ÂU!'],
    barkColor: 'hsl(22, 90%, 58%)', special: null, specialDesc: '',
  },
  {
    id: 'labrador',
    name: 'Labrador Đen',
    title: 'Bóng Đêm Gầm Gừ',
    emoji: '🐕',
    color: '#34323A', altColor: '#1C1B20', bellyColor: '#5A5760',
    description: 'Giọng trầm, lực mạnh, nhịp trung bình.',
    stats: { power: 5, speed: 2, combo: 3 },
    earType: 'floppy', unlocked: false, wpCost: 250,
    barkWords: ['GRRR!', 'BOW!', 'GÂU!', 'WOOF!', 'BẦU!'],
    barkColor: 'hsl(355, 80%, 58%)', special: null, specialDesc: '',
  },
  {
    id: 'malamute',
    name: 'Alaskan Malamute',
    title: 'Sói Tuyết Cứng Cựa',
    emoji: '🐺',
    color: '#8C8F98', altColor: '#555963', bellyColor: '#F0EEEE',
    description: 'To xác, lực mạnh và combo dai, đổi lại hơi chậm.',
    stats: { power: 4, speed: 2, combo: 4 },
    earType: 'pointy', unlocked: false, wpCost: 400,
    barkWords: ['AROO!', 'GRRR!', 'HÚÚ!', 'WOOF!', 'ROAR!'],
    barkColor: 'hsl(160, 60%, 50%)', special: null, specialDesc: '',
  },
];

/** Lấy character theo ID */
export function getCharById(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

/** Lấy danh sách đã unlock */
export function getUnlockedChars(unlockedIds = []) {
  return CHARACTERS.filter(c => c.unlocked || unlockedIds.includes(c.id));
}
