"use client";

import { useState } from 'react';
import Link from 'next/link';

// 임시 판매 중인 아이템 데이터
const mockSellingItems = [
  {
    id: 1,
    name: "전설의 검",
    type: "무기",
    rarity: "전설",
    level: 85,
    price: 1500000,
    status: "판매중",
    listedAt: "2024-01-15",
    image: "⚔️",
    stats: { attack: 150, critical: 25 }
  },
  {
    id: 2,
    name: "용의 갑옷",
    type: "방어구",
    rarity: "희귀",
    level: 80,
    price: 800000,
    status: "판매중",
    listedAt: "2024-01-14",
    image: "🛡️",
    stats: { defense: 120, hp: 500 }
  }
];

export default function EquipmentSellPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  
  // 등록 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    type: '무기',
    rarity: '고급',
    level: 1,
    price: '',
    description: '',
    stats: {
      attack: '',
      defense: '',
      magic: '',
      hp: '',
      mp: '',
      speed: '',
      critical: '',
      agility: ''
    }
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case '전설': return 'text-orange-600 bg-orange-100 border-orange-200';
      case '희귀': return 'text-purple-600 bg-purple-100 border-purple-200';
      case '고급': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '판매중': return 'text-green-600 bg-green-100 border-green-200';
      case '예약중': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case '판매완료': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + ' 골드';
  };

  const handleFormChange = (field: string, value: any) => {
    if (field.startsWith('stats.')) {
      const statField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          [statField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 여기에 실제 등록 로직 추가
    // 등록할 아이템
    setShowRegisterForm(false);
    setFormData({
      name: '',
      type: '무기',
      rarity: '고급',
      level: 1,
      price: '',
      description: '',
      stats: {
        attack: '',
        defense: '',
        magic: '',
        hp: '',
        mp: '',
        speed: '',
        critical: '',
        agility: ''
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/trade" className="text-blue-600 hover:text-blue-700">
              ← 아이템 거래
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/trade/equipment" className="text-blue-600 hover:text-blue-700">
              장비 거래
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900">판매</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">장비 판매</h1>
          <p className="text-gray-600">보유한 장비를 등록하고 판매하세요</p>
        </div>

        {/* 탭 메뉴 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              판매 중인 아이템
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'register'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              새 아이템 등록
            </button>
          </div>

          {activeTab === 'list' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">판매 중인 아이템</h2>
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  + 새 아이템 등록
                </button>
              </div>

              {/* 판매 중인 아이템 목록 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockSellingItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* 아이템 이미지 */}
                    <div className="p-6 text-center bg-gradient-to-br from-gray-50 to-gray-100">
                      <div className="text-4xl mb-2">{item.image}</div>
                      <div className="flex justify-center space-x-2 mb-2">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRarityColor(item.rarity)}`}>
                          {item.rarity}
                        </div>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </div>
                      </div>
                    </div>

                    {/* 아이템 정보 */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{item.name}</h3>
                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        <div className="flex justify-between">
                          <span>타입:</span>
                          <span>{item.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>레벨:</span>
                          <span>{item.level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>등록일:</span>
                          <span>{item.listedAt}</span>
                        </div>
                      </div>

                      {/* 스탯 정보 */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs font-medium text-gray-700 mb-2">주요 스탯</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(item.stats).map(([stat, value]) => (
                            <div key={stat} className="flex justify-between">
                              <span className="capitalize">{stat}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 가격 및 액션 버튼 */}
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-green-600">
                          {formatPrice(item.price)}
                        </div>
                        <div className="flex space-x-2">
                          <button className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs font-medium rounded-md transition-colors duration-200">
                            수정
                          </button>
                          <button className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-md transition-colors duration-200">
                            내리기
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {mockSellingItems.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">판매 중인 아이템이 없습니다</h3>
                  <p className="text-gray-600 mb-4">새로운 아이템을 등록해보세요</p>
                  <button
                    onClick={() => setShowRegisterForm(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                  >
                    아이템 등록하기
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'register' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">새 아이템 등록</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 기본 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">아이템명 *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="아이템명을 입력하세요"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">타입 *</label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => handleFormChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="무기">무기</option>
                      <option value="방어구">방어구</option>
                      <option value="액세서리">액세서리</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">희귀도 *</label>
                    <select
                      required
                      value={formData.rarity}
                      onChange={(e) => handleFormChange('rarity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="고급">고급</option>
                      <option value="희귀">희귀</option>
                      <option value="전설">전설</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">레벨 *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={formData.level}
                      onChange={(e) => handleFormChange('level', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">가격 (골드) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.price}
                      onChange={(e) => handleFormChange('price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="가격을 입력하세요"
                    />
                  </div>
                </div>

                {/* 스탯 정보 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">스탯 정보</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(formData.stats).map(([stat, value]) => (
                      <div key={stat}>
                        <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{stat}</label>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => handleFormChange(`stats.${stat}`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="아이템에 대한 설명을 입력하세요 (선택사항)"
                  />
                </div>

                {/* 제출 버튼 */}
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                  >
                    등록하기
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
