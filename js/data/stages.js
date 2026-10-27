/**
 * stages.js — Danh sách bối cảnh (màn chiến đấu)
 * Mỗi stage có màu sắc riêng, được vẽ bằng Canvas 2D.
 */

export const STAGES = [
  {
    id: 'beach',
    name: 'Bãi Biển',
    description: 'Quán biển bên bờ cát, tranh vẽ tay màu dịu (giống video gốc).',
    unlocked: true,
    wpCost: 0,
    skyTop: '#1A0A30',
    skyBot: '#C04020',
    groundTop: '#D4A060',
    groundBot: '#A07040',
    buildingColor: '#301850',
    buildingHighlight: '#502870',
    windowColor: 'rgba(255, 150, 50, 0.3)',
    ambientColor: 'rgba(200, 80, 20, 0.2)',
    effectHue: 50,
  },
  {
    id: 'village',
    name: 'Làng Quê Hoàng Hôn',
    description: 'Xóm làng ven ao lúc hoàng hôn vàng.',
    unlocked: true,
    wpCost: 0,
    skyTop: '#3a5a6a',
    skyBot: '#f0a050',
    groundTop: '#8aa05a',
    groundBot: '#5a7a3a',
    buildingColor: '#4a3a2a',
    buildingHighlight: '#6a5236',
    windowColor: 'rgba(255, 190, 80, 0.35)',
    ambientColor: 'rgba(240, 160, 60, 0.18)',
    effectHue: 40,
  },
  {
    id: 'valley',
    name: 'Thung Lũng Ven Hồ',
    description: 'Thung lũng xanh bên mặt nước trong veo.',
    unlocked: true,
    wpCost: 0,
    skyTop: '#5a8aa8',
    skyBot: '#f6dc9a',
    groundTop: '#7ab060',
    groundBot: '#4e8444',
    buildingColor: '#3a5a4a',
    buildingHighlight: '#527a62',
    windowColor: 'rgba(255, 230, 150, 0.3)',
    ambientColor: 'rgba(255, 220, 130, 0.15)',
    effectHue: 90,
  },
  {
    id: 'street',
    name: 'Phố Thị',
    description: 'Con phố nhộn nhịp với tiếng ồn vang vọng.',
    unlocked: true,
    wpCost: 0,
    /** Màu gradient bầu trời (trên → dưới) */
    skyTop: '#4A3A2A',
    skyBot: '#7A6040',
    /** Màu mặt đất */
    groundTop: '#5D4E38',
    groundBot: '#3A2E1A',
    /** Màu tòa nhà */
    buildingColor: '#3A2A1E',
    buildingHighlight: '#5A4030',
    /** Màu ánh sáng cửa sổ */
    windowColor: 'rgba(255, 210, 80, 0.25)',
    /** Màu tổng thể overlay (tạo không khí) */
    ambientColor: 'rgba(139, 100, 50, 0.15)',
    /** Màu chữ BARK text */
    effectHue: 30,
  },
  {
    id: 'temple',
    name: 'Đền Cổ Linh Thiêng',
    description: 'Âm thanh vang vọng ngàn năm, linh khí tụ về.',
    unlocked: false,
    wpCost: 300,
    skyTop: '#050A15',
    skyBot: '#0A2010',
    groundTop: '#1E3010',
    groundBot: '#0A1805',
    buildingColor: '#1A2A0E',
    buildingHighlight: '#2A4018',
    windowColor: 'rgba(100, 255, 100, 0.15)',
    ambientColor: 'rgba(30, 100, 30, 0.2)',
    effectHue: 120,
  },
];

/** Lấy stage ngẫu nhiên trong danh sách đã unlock */
export function getRandomStage(unlockedIds = []) {
  const available = STAGES.filter(s => s.unlocked || unlockedIds.includes(s.id));
  return available[Math.floor(Math.random() * available.length)] || STAGES[0];
}

export function getStageById(id) {
  return STAGES.find(s => s.id === id) || STAGES[0];
}
