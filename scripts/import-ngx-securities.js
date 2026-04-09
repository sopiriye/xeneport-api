require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');

const DEFAULT_CSV_PATH =
  'C:\\Users\\Sopiriye Robinson\\Downloads\\top80_ngx_stocks.csv';
const DEFAULT_EXCHANGE_ID = '775ed46f-f383-45e2-8ec8-858a36ef4f68';

async function main() {
  // const csvPath = path.resolve(process.argv[2] || DEFAULT_CSV_PATH);
  const csvPath = path.resolve(DEFAULT_CSV_PATH);
  // const exchangeId = process.argv[3] || DEFAULT_EXCHANGE_ID;
  const exchangeId = DEFAULT_EXCHANGE_ID;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file was not found at: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvContent);

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  const [header, ...dataRows] = rows;
  const normalizedHeader = header.map((value) => value.trim().toLowerCase());

  if (
    normalizedHeader.length < 2 ||
    normalizedHeader[0] !== 'ticker' ||
    normalizedHeader[1] !== 'company name'
  ) {
    throw new Error('CSV header must start with: Ticker,Company Name');
  }

  const securities = dataRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row, index) => {
      const ticker = (row[0] || '').trim().toUpperCase();
      const companyName = (row[1] || '').trim();

      if (!ticker || !companyName) {
        throw new Error(
          `Invalid row at line ${index + 2}: ticker and company name are required`,
        );
      }

      return {
        ticker,
        companyName,
      };
    });

  const dedupedSecurities = dedupeByTicker(securities);
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query('BEGIN');

    const exchangeCheck = await client.query(
      'select id, ticker_prefix, name from exchanges where id = $1',
      [exchangeId],
    );

    if (exchangeCheck.rowCount !== 1) {
      throw new Error(
        `Exchange id ${exchangeId} was not found in the exchanges table`,
      );
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const security of dedupedSecurities) {
      const result = await client.query(
        `
          insert into securities (
            id,
            exchange_id,
            security_type,
            ticker,
            company_name,
            created_at,
            updated_at
          )
          values ($1, $2, 'stock', $3, $4, now(), now())
          on conflict (exchange_id, ticker)
          do update
          set company_name = excluded.company_name,
              updated_at = now()
          returning (xmax = 0) as inserted
        `,
        [
          crypto.randomUUID(),
          exchangeId,
          security.ticker,
          security.companyName,
        ],
      );

      if (result.rows[0]?.inserted) {
        insertedCount += 1;
      } else {
        updatedCount += 1;
      }
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          csvPath,
          exchange: exchangeCheck.rows[0],
          totalRowsRead: securities.length,
          uniqueTickersProcessed: dedupedSecurities.length,
          insertedCount,
          updatedCount,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

function dedupeByTicker(securities) {
  const dedupedMap = new Map();

  for (const security of securities) {
    dedupedMap.set(security.ticker, security);
  }

  return [...dedupedMap.values()];
}

function parseCsv(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const character = content[i];
    const nextCharacter = content[i + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        i += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter(
    (row) => !(row.length === 1 && row[0].trim().length === 0),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
