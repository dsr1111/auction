"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SellerContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerUserId: string;
  sellerNickname: string;
}

interface UserContact {
  user_id: string;
  kakao_openchat_url: string | null;
  updated_at: string;
}

export default function SellerContactModal({ 
  isOpen, 
  onClose, 
  sellerUserId, 
  sellerNickname 
}: SellerContactModalProps) {
  const [contact, setContact] = useState<UserContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  // 판매자의 연락처 정보 불러오기
  useEffect(() => {
    if (isOpen && sellerUserId) {
      fetchSellerContact();
    }
  }, [isOpen, sellerUserId]);

  const fetchSellerContact = async () => {
    if (!sellerUserId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('user_contacts')
        .select('*')
        .eq('user_id', sellerUserId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116는 데이터가 없는 경우
        console.error('판매자 연락처 정보를 불러오는데 실패했습니다:', error);
        // 에러 메시지를 표시하지 않고 null로 설정
      }

      setContact(data);
    } catch (error) {
      console.error('판매자 연락처 정보를 불러오는데 실패했습니다:', error);
      // 에러 메시지를 표시하지 않고 null로 설정
      setContact(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${type}이 클립보드에 복사되었습니다!`);
    } catch (error) {
      console.error('클립보드 복사에 실패했습니다:', error);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const handleOpenKakaoChat = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
       <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {sellerNickname}님 연락처
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-600">연락처 정보를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-red-600 mb-2">오류가 발생했습니다</p>
              <p className="text-gray-600 text-sm">{error}</p>
            </div>
          ) : !contact ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-2">연락처 정보가 없습니다</p>
              <p className="text-gray-500 text-sm">
                {sellerNickname}님이 아직 연락처 정보를 설정하지 않았습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 카카오톡 오픈톡 */}
              {contact.kakao_openchat_url && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-yellow-800">카카오톡 오픈톡</h3>
                    <button
                      onClick={() => handleCopyToClipboard(contact.kakao_openchat_url!, '카카오톡 오픈톡 주소')}
                      className="text-yellow-600 hover:text-yellow-800 text-sm"
                    >
                      복사
                    </button>
                  </div>
                  <button
                    onClick={() => handleOpenKakaoChat(contact.kakao_openchat_url!)}
                    className="w-full text-left text-yellow-700 hover:text-yellow-900 break-all"
                  >
                    {contact.kakao_openchat_url}
                  </button>
                </div>
              )}

              

                             {/* 연락처 정보가 없는 경우 */}
               {!contact.kakao_openchat_url && (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2">연락처 정보가 없습니다</p>
                  <p className="text-gray-500 text-sm">
                    {sellerNickname}님이 아직 연락처 정보를 설정하지 않았습니다.
                  </p>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
