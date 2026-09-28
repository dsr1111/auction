import 'server-only';

import { google } from 'googleapis';

type GuildType = 'guild1' | 'guild2';

const DEFAULT_SPREADSHEET_ID = '1xqbdYmgjB_gBiGobUJQsOMSiYAi2qFj704vaqqOQj9c';

const SHEET_RANGES: Record<GuildType, string> = {
  guild1: '세계수!M2',
  guild2: '크랙!M2',
};

function getGoogleSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets server credentials are not configured');
  }

  return { spreadsheetId, clientEmail, privateKey };
}

export async function updateAuctionWinningTotal(guildType: GuildType, totalWinningAmount: number) {
  if (!Number.isSafeInteger(totalWinningAmount) || totalWinningAmount < 0) {
    throw new Error('Invalid auction winning total');
  }

  const { spreadsheetId, clientEmail, privateKey } = getGoogleSheetsConfig();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const range = SHEET_RANGES[guildType];

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      majorDimension: 'ROWS',
      values: [[totalWinningAmount]],
    },
  });

  if (response.data.updatedCells !== 1) {
    throw new Error(`Google Sheets update did not modify exactly one cell (${range})`);
  }

  return {
    range,
    updatedCells: response.data.updatedCells,
    totalWinningAmount,
    spreadsheetAmount: totalWinningAmount,
  };
}
