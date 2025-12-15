"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';

type CompletedAuctionItem = {
  id: number;
  name: string;
  price: string;
  current_bid: string;
  end_time: string;
  created_at: string;
  last_bidder_nickname?: string;
  quantity?: number;
  remaining_quantity?: number;
  bid_history: Array<{
    id: number;
    bid_amount: number;
    bid_quantity: number;
    bidder_nickname: string;
    bidder_discord_id: string | null;
    bidder_discord_name: string | null;
    created_at: string;
  }>;
  winning_bids: Array<{
    id: number;
    bid_amount: number;
    bid_quantity: number;
    bidder_nickname: string;
    bidder_discord_id: string | null;
    bidder_discord_name: string | null;
    created_at: string;
    quantity_used: number;
  }>;
};

type RowByBidder = {
  bidderNickname: string;
  bidderDiscordName: string;
  itemName: string;
  quantity: number;
  unitWithFee: number;
  totalWithFee: number;
  totalWithoutFee: number;
};

type ProcessedData = {
  bidderToRows: Map<string, RowByBidder[]>;
  bidderToTotalWithFee: Map<string, number>;
  bidderToTotalWithoutFee: Map<string, number>;
  sortedKeys: string[];
  grandTotalWithFee: number;
  grandTotalWithoutFee: number;
};

type CompletedAuctionExportProps = {
  guildType?: 'guild1' | 'guild2';
};

const CompletedAuctionExport = ({ guildType = 'guild1' }: CompletedAuctionExportProps) => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [previewData, setPreviewData] = useState<ProcessedData | null>(null);

  // 관리자 권한 확인
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  if (!isAdmin) {
    return null;
  }

  const fetchCompletedItems = async () => {
    const response = await fetch(`/api/auction/completed?guildType=${guildType}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`마감된 아이템 정보를 가져오는데 실패했습니다. (${response.status}: ${response.statusText})`);
    }
    const responseData = await response.json();
    const { data: completedItems, message } = responseData;

    if (!completedItems || completedItems.length === 0) {
      throw new Error(message || '마감된 아이템이 없습니다.');
    }
    return completedItems as CompletedAuctionItem[];
  };

  const processData = (items: CompletedAuctionItem[]): ProcessedData => {
    const bidderToRows = new Map<string, RowByBidder[]>();
    const bidderToTotalWithFee = new Map<string, number>();
    const bidderToTotalWithoutFee = new Map<string, number>();

    items.forEach((item) => {
      if (!item.winning_bids || item.winning_bids.length === 0) {
        return;
      }
      item.winning_bids.forEach((wb) => {
        const unitWithFee = Math.round(wb.bid_amount * 1.1);
        const totalWithFee = unitWithFee * wb.quantity_used;
        const totalWithoutFee = wb.bid_amount * wb.quantity_used;
        const bidderNickname = wb.bidder_nickname || '';
        const bidderDiscordName = wb.bidder_discord_name || '';
        const key = `${bidderNickname}||${bidderDiscordName}`;

        const list = bidderToRows.get(key) || [];
        list.push({
          bidderNickname,
          bidderDiscordName,
          itemName: item.name,
          quantity: wb.quantity_used,
          unitWithFee,
          totalWithFee,
          totalWithoutFee,
        });
        bidderToRows.set(key, list);
        bidderToTotalWithFee.set(key, (bidderToTotalWithFee.get(key) || 0) + totalWithFee);
        bidderToTotalWithoutFee.set(key, (bidderToTotalWithoutFee.get(key) || 0) + totalWithoutFee);
      });
    });

    let grandTotalWithFee = 0;
    let grandTotalWithoutFee = 0;
    for (const val of bidderToTotalWithFee.values()) grandTotalWithFee += val;
    for (const val of bidderToTotalWithoutFee.values()) grandTotalWithoutFee += val;

    const sortedKeys = Array.from(bidderToRows.keys()).sort((a, b) => {
      const [aName] = a.split('||');
      const [bName] = b.split('||');
      return aName.localeCompare(bName, 'ko');
    });

    return {
      bidderToRows,
      bidderToTotalWithFee,
      bidderToTotalWithoutFee,
      sortedKeys,
      grandTotalWithFee,
      grandTotalWithoutFee
    };
  };

  const handleOpenPreview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const completedItems = await fetchCompletedItems();
      const processed = processData(completedItems);
      setPreviewData(processed);
      setShowModal(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('데이터 로드 실패:', err);
      // 에러 발생 시 붉은 창(setError) 대신 alert만 표시
      alert(`데이터 로드 실패: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-blue-800 font-medium">낙찰 내역 관리</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleOpenPreview}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-full transition-colors duration-200 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>낙찰 내역 보기</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {showModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-800">낙찰 내역 미리보기</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto p-6 flex-1">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-blue-600 text-white sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2">입찰자</th>
                    <th className="border border-gray-300 px-4 py-2">아이템명</th>
                    <th className="border border-gray-300 px-4 py-2">갯수</th>
                    <th className="border border-gray-300 px-4 py-2">개당 입찰가(10%포함)</th>
                    <th className="border border-gray-300 px-4 py-2">총 입찰가(10%포함)</th>
                    <th className="border border-gray-300 px-4 py-2">총 입찰가(수수료 제외)</th>
                  </tr>
                </thead>
                {previewData.sortedKeys.map((key) => {
                  const [bidderNickname, bidderDiscordName] = key.split('||');
                  const rows = previewData.bidderToRows.get(key) || [];
                  const subtotalWithFee = previewData.bidderToTotalWithFee.get(key) || 0;
                  const subtotalWithoutFee = previewData.bidderToTotalWithoutFee.get(key) || 0;
                  const bidderDisplay = bidderDiscordName ? `${bidderNickname} (${bidderDiscordName})` : bidderNickname;

                  return (
                    <tbody key={key}>
                      {rows.sort((a, b) => a.itemName.localeCompare(b.itemName, 'ko')).map((row, idx) => (
                        <tr key={`${key}-${idx}`} className="hover:bg-gray-50">
                          {idx === 0 && (
                            <td
                              className="border border-gray-300 px-4 py-2 font-bold bg-gray-50 text-center align-middle"
                              rowSpan={rows.length + 1}
                            >
                              {bidderDisplay}
                            </td>
                          )}
                          <td className="border border-gray-300 px-4 py-2">{row.itemName}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{row.quantity}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{row.unitWithFee.toLocaleString()}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{row.totalWithFee.toLocaleString()}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{row.totalWithoutFee.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-bold">
                        <td className="border border-gray-300 px-4 py-2 text-center text-gray-700">합계</td>
                        <td className="border border-gray-300 px-4 py-2"></td>
                        <td className="border border-gray-300 px-4 py-2"></td>
                        <td className="border border-gray-300 px-4 py-2 text-right text-black">{subtotalWithFee.toLocaleString()}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right text-black">{subtotalWithoutFee.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  );
                })}
                <tfoot>
                  <tr className="bg-yellow-100 font-bold text-base border-t-2 border-black">
                    <td className="border border-gray-300 px-4 py-3 text-center">전체 합계</td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3 text-right">{previewData.grandTotalWithFee.toLocaleString()}</td>
                    <td className="border border-gray-300 px-4 py-3 text-right">{previewData.grandTotalWithoutFee.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompletedAuctionExport;
