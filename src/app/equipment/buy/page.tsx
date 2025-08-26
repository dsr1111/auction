"use client";

import { useState } from 'react';
import Link from 'next/link';

// 임시 장비 데이터
const mockEquipment = [
  {
    id: 1,
    name: "전설의 검",
    type: "무기",
    rarity: "전설",
    level: 85,
    price: 1500000,
    seller: "전사킹",
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
    seller: "탱커마스터",
    image: "🛡️",
    stats: { defense: 120, hp: 500 }
  },
  {
    id: 3,
    name: "마법사의 지팡이",
    type: "무기",
    rarity: "전설",
    level: 82,
    price: 1200000,
    seller: "마법사킹",
    image: "🔮",
    stats: { magic: 180, mp: 300 }
  },
  {
    id: 4,
    name: "신속의 부츠",
    type: "액세서리",
    rarity: "희귀",
    level: 75,
    price: 450000,
    seller: "어쌔신",
    image: "👢",
    stats: { speed: 50, agility: 30 }
  }
];

export default function EquipmentBuyPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [sortBy, setSortBy] = useState('price');

  const filteredEquipment = mockEquipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.seller.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesRarity = selectedRarity === 'all' || item.rarity === selectedRarity;
    
    return matchesSearch && matchesType && matchesRarity;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.price - b.price;
      case 'level':
        return b.level - a.level;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
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

  const formatPrice = (price: number) => {
    return price.toLocaleString() + ' 골드';
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
            <span className="text-gray-900">구매</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">장비 구매</h1>
          <p className="text-gray-600">원하는 장비를 찾아보고 구매하세요</p>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
              <input
                type="text"
                placeholder="아이템명 또는 판매자"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 타입 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">타입</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                <option value="무기">무기</option>
                <option value="방어구">방어구</option>
                <option value="액세서리">액세서리</option>
              </select>
            </div>

            {/* 희귀도 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">희귀도</label>
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                <option value="전설">전설</option>
                <option value="희귀">희귀</option>
                <option value="고급">고급</option>
              </select>
            </div>

            {/* 정렬 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">정렬</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="price">가격순</option>
                <option value="level">레벨순</option>
                <option value="name">이름순</option>
              </select>
            </div>
          </div>
        </div>

        {/* 아이템 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEquipment.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
              {/* 아이템 이미지 */}
              <div className="p-6 text-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-4xl mb-2">{item.image}</div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRarityColor(item.rarity)}`}>
                  {item.rarity}
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
                    <span>판매자:</span>
                    <span className="text-blue-600">{item.seller}</span>
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

                {/* 가격 및 구매 버튼 */}
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">
                    {formatPrice(item.price)}
                  </div>
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200">
                    구매하기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredEquipment.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-600">다른 검색어나 필터를 시도해보세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
