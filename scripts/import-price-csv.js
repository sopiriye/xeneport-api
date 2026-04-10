require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');

async function main() {
  const csvPathArg = process.argv[2];
  const priceDateArg = process.argv[3];

  if (!csvPathArg) {
    throw new Error(
      'CSV file path is required. Usage: node scripts/import-price-csv.js <csv-path> [YYYY-MM-DD]',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const csvPath = path.resolve(csvPathArg);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file was not found at: ${csvPath}`);
  }

  const pricingTimestamp = resolvePricingTimestamp(priceDateArg);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvContent);

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  const [header, ...dataRows] = rows;
  const headerIndex = buildHeaderIndex(header);

  if (headerIndex.ticker === -1 || headerIndex.price === -1) {
    throw new Error(
      'CSV must include ticker and price columns. Accepted price headers include Price, Close, Close Price, Closing Price, or Closed Price.',
    );
  }

  const skippedRows = [];
  const parsedRows = dataRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .flatMap((row, index) => {
      const lineNumber = index + 2;
      const ticker = (row[headerIndex.ticker] || '').trim().toUpperCase();
      const rawPrice = (row[headerIndex.price] || '').trim();

      if (!ticker) {
        throw new Error(
          `Invalid row at line ${lineNumber}: ticker is required`,
        );
      }

      if (!rawPrice) {
        skippedRows.push({
          lineNumber,
          ticker,
          reason: 'price is empty',
        });
        return [];
      }

      const price = Number.parseFloat(rawPrice.replace(/,/g, ''));

      if (!Number.isFinite(price) || price < 0) {
        throw new Error(
          `Invalid price at line ${lineNumber}: "${rawPrice}" is not a valid non-negative number`,
        );
      }

      return {
        ticker,
        price: Number(price.toFixed(2)),
      };
    });

  if (parsedRows.length === 0) {
    throw new Error(
      'No valid price rows were found in the CSV. Every price cell was empty or invalid.',
    );
  }

  const dedupedRows = dedupeByTicker(parsedRows);
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query('BEGIN');

    const securitiesResult = await client.query(
      'select id, ticker from securities where ticker = any($1)',
      [dedupedRows.map((row) => row.ticker)],
    );

    const securityIdByTicker = new Map(
      securitiesResult.rows.map((row) => [row.ticker, row.id]),
    );

    const missingTickers = dedupedRows
      .map((row) => row.ticker)
      .filter((ticker) => !securityIdByTicker.has(ticker));

    if (missingTickers.length > 0) {
      throw new Error(
        `The following tickers were not found in securities: ${missingTickers.join(', ')}`,
      );
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const row of dedupedRows) {
      const result = await client.query(
        `
          insert into prices (
            id,
            security_id,
            price,
            timestamp,
            created_at
          )
          values ($1, $2, $3, $4, now())
          on conflict (security_id, timestamp)
          do update
          set price = excluded.price
          returning (xmax = 0) as inserted
        `,
        [
          crypto.randomUUID(),
          securityIdByTicker.get(row.ticker),
          row.price,
          pricingTimestamp.toISOString(),
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
          pricingDate: pricingTimestamp.toISOString(),
          totalRowsRead: parsedRows.length,
          uniqueTickersProcessed: dedupedRows.length,
          insertedCount,
          updatedCount,
          skippedCount: skippedRows.length,
          skippedRows,
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

function resolvePricingTimestamp(dateArg) {
  if (!dateArg) {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateArg);

  if (!match) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function dedupeByTicker(rows) {
  const byTicker = new Map();

  for (const row of rows) {
    byTicker.set(row.ticker, row);
  }

  return [...byTicker.values()];
}

function buildHeaderIndex(header) {
  const normalizedHeader = header.map((value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, ' '),
  );

  return {
    ticker: normalizedHeader.findIndex((value) => value === 'ticker'),
    price: normalizedHeader.findIndex((value) =>
      [
        'price',
        'close',
        'close price',
        'closing price',
        'closed price',
      ].includes(value),
    ),
  };
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
