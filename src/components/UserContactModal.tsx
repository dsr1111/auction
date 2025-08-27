"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { createClient } from '@/lib/supabase/client';

interface UserContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserContact {
  user_id: string;
  kakao_openchat_url: string | null;
  updated_at: string;
}

export default function UserContactModal({ isOpen, onClose }: UserContactModalProps) {
  const { data: session } = useSession();
  const [contact, setContact] = useState<UserContact>({
    user_id: '',
    kakao_openchat_url: '',
    updated_at: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const supabase = createClient();

  // 현재 사용자의 연락처 정보 불러오기
  useEffect(() => {
    if (isOpen && session?.user && (session.user as { id?: string }).id) {
      fetchUserContact();
    }
  }, [isOpen, session?.user]);

  const fetchUserContact = async () => {
    if (!session?.user || !(session.user as { id?: string }).id) return;
    
    const userId = (session.user as { id?: string }).id;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_contacts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116는 데이터가 없는 경우
        console.error('연락처 정보를 불러오는데 실패했습니다:', error);
        // 에러 메시지를 표시하지 않고 기본값으로 설정
      }

      if (data) {
        setContact(data);
      } else {
        // 새로운 사용자인 경우 기본값 설정
        setContact({
          user_id: userId!,
          kakao_openchat_url: '',
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('연락처 정보를 불러오는데 실패했습니다:', error);
      // 에러 메시지를 표시하지 않고 기본값으로 설정
      setContact({
        user_id: userId!,
        kakao_openchat_url: '',
        updated_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !(session.user as { id?: string }).id) return;

    const userId = (session.user as { id?: string }).id;
    setSaving(true);
    setMessage('');

    try {
      const contactData = {
        ...contact,
        user_id: userId!,
        updated_at: new Date().toISOString()
      };

      console.log('저장하려는 데이터:', contactData);

      const { data, error } = await supabase
        .from('user_contacts')
        .upsert(contactData, { onConflict: 'user_id' });

      if (error) {
        console.error('Supabase 에러:', error);
        throw error;
      }

      console.log('저장 성공:', data);
      setMessage('연락처 정보가 저장되었습니다!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('연락처 정보 저장에 실패했습니다:', error);
      setMessage(`연락처 정보 저장에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof UserContact, value: string) => {
    setContact(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
       <div className="bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">연락처 정보 설정</h2>
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카카오톡 오픈톡 주소
                </label>
                <input
                  type="url"
                  value={contact.kakao_openchat_url || ''}
                  onChange={(e) => handleInputChange('kakao_openchat_url', e.target.value)}
                  placeholder="https://open.kakao.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>



              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.includes('실패') 
                    ? 'bg-red-100 text-red-700 border border-red-200' 
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}>
                  {message}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
