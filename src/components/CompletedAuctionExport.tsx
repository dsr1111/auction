"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import * as XLSX from 'xlsx';

type CompletedAuctionItem = {
  id: number;
  name: string; // base_equipment_name 대신 name
  price: string; // number 대신 string
  current_bid: string; // number | null 대신 string
  end_time: string;
  created_at: string;
  last_bidder_nickname?: string; // 추가
  quantity?: number; // 추가
  remaining_quantity?: number; // 추가
  bid_history: Array<{
    id: number;
    bid_amount: number;
    bid_quantity: number;
    bidder_nickname: string;
    bidder_discord_id: string | null;
    bidder_discord_name: string | null;
    created_at: string;
  }>;
  winning_bids: Array<{ // 낙찰 정보 추가
    id: number;
    bid_amount: number;
    bid_quantity: number;
    bidder_nickname: string;
    bidder_discord_id: string | null;
    bidder_discord_name: string | null;
    created_at: string;
    quantity_used: number; // 실제 사용된 수량
  }>;
};

const CompletedAuctionExport = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 관리자 권한 확인
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  if (!isAdmin) {
    return null; // 관리자가 아니면 컴포넌트를 렌더링하지 않음
  }

  const exportToExcel = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('엑셀 다운로드 시작');
      
      // 마감된 아이템 정보 가져오기
      const response = await fetch('/api/auction/completed');
      console.log('API 응답:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 에러 응답:', errorText);
        throw new Error(`마감된 아이템 정보를 가져오는데 실패했습니다. (${response.status}: ${response.statusText})`);
      }

      const responseData = await response.json();
      console.log('API 응답 데이터:', responseData);
      
      const { data: completedItems, message, sourceTable } = responseData;

      if (!completedItems || completedItems.length === 0) {
        alert(message || '마감된 아이템이 없습니다.');
        return;
      }

      console.log(`${completedItems.length}개의 아이템을 엑셀로 변환 중... (테이블: ${sourceTable})`);

      // 엑셀 데이터 준비 - 핵심 정보만 포함
      const excelData: Array<{
        '아이템명': string;
        '입찰자 닉네임': string;
        'Discord 닉네임': string;
        '갯수': number | string;
        '개당 입찰가(10%포함)': string;
        '총 입찰가(10%포함)': string;
      }> = [];
      
      completedItems.forEach((item: CompletedAuctionItem) => {
        if (item.winning_bids && item.winning_bids.length > 0) {
          // 낙찰이 있는 경우: 각 낙찰별로 행 생성
          item.winning_bids.forEach((winningBid) => {
            // 10% 수수료 포함 금액 계산
            const bidAmountWithFee = Math.round(winningBid.bid_amount * 1.1);
            const totalAmountWithFee = bidAmountWithFee * winningBid.quantity_used;
            
            excelData.push({
              '아이템명': item.name,
              '입찰자 닉네임': winningBid.bidder_nickname,
              'Discord 닉네임': winningBid.bidder_discord_name || '',
              '갯수': winningBid.quantity_used,
              '개당 입찰가(10%포함)': bidAmountWithFee.toLocaleString(),
              '총 입찰가(10%포함)': totalAmountWithFee.toLocaleString(),
            });
          });
        } else {
          // 낙찰이 없는 경우: 아이템 정보만 표시
          excelData.push({
            '아이템명': item.name,
            '입찰자 닉네임': '낙찰 없음',
            'Discord 닉네임': '',
            '갯수': item.quantity || 'N/A',
            '개당 입찰가(10%포함)': 'N/A',
            '총 입찰가(10%포함)': 'N/A',
          });
        }
        
        // 아이템 사이에 빈 행 추가 (가독성 향상)
        excelData.push({
          '아이템명': '',
          '입찰자 닉네임': '',
          'Discord 닉네임': '',
          '갯수': '',
          '개당 입찰가(10%포함)': '',
          '총 입찰가(10%포함)': '',
        });
      });
      
      // 마지막 빈 행 제거
      if (excelData.length > 0) {
        excelData.pop();
      }

      console.log('엑셀 데이터 준비 완료:', excelData.length);

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 자동 조정 (6개 컬럼으로 증가)
      const columnWidths = [
        { wch: 25 }, // 아이템명
        { wch: 20 }, // 입찰자 닉네임
        { wch: 20 }, // Discord 닉네임
        { wch: 10 }, // 갯수
        { wch: 20 }, // 개당 입찰가(10%포함)
        { wch: 20 }, // 총 입찰가(10%포함)
      ];
      worksheet['!cols'] = columnWidths;

      // 스타일링 적용
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      // 헤더 행 스타일링 (첫 번째 행)
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = {};
        }
        
        // 헤더 스타일: 배경색, 글자색, 굵은 글씨, 가운데 정렬
        worksheet[cellAddress].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: '4472C4' } // 파란색 배경
          },
          font: {
            bold: true,
            color: { rgb: 'FFFFFF' } // 흰색 글자
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };
      }

      // 데이터 행 스타일링
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (worksheet[cellAddress] && worksheet[cellAddress].v !== '') {
            // 데이터가 있는 셀에만 테두리 적용
            worksheet[cellAddress].s = {
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center'
              }
            };
          }
        }
      }

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '낙찰 상세 내역');

      // 파일명 생성 (현재 날짜 포함)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `낙찰상세내역_${dateStr}.xlsx`;

      console.log('엑셀 파일 다운로드 시작:', fileName);

      // 엑셀 파일 다운로드
      XLSX.writeFile(workbook, fileName);

      console.log('엑셀 다운로드 완료');
      alert(`${excelData.length}개의 낙찰 정보가 엑셀로 다운로드되었습니다. (테이블: ${sourceTable})`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('엑셀 다운로드 에러:', err);
      setError(errorMessage);
      alert(`엑셀 다운로드에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-blue-800 font-medium">낙찰 내역 다운로드</span>
        </div>
        <button
          onClick={exportToExcel}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-full transition-colors duration-200 flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>처리 중...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>엑셀 다운로드</span>
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default CompletedAuctionExport;
