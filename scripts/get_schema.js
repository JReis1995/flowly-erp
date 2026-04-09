const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Get connection string from environment or command line argument
const connectionString = process.argv[2] || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: DATABASE_URL not found.');
  console.error('Usage: node scripts/get_schema.js "postgresql://user:pass@host:port/db"');
  process.exit(1);
}

console.log('Connecting to Supabase...');

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function getSchema() {
  try {
    await client.connect();
    console.log('Connected. Extracting schema...\n');

    const schemas = ['public', 'auth', 'storage'];
    let output = '# Supabase Database Schema\n';
    output += 'Generated: ' + new Date().toISOString() + '\n';
    output += '=' .repeat(80) + '\n\n';

    for (const schema of schemas) {
      output += `## Schema: ${schema}\n`;
      output += '-'.repeat(80) + '\n\n';

      // Get all tables in schema
      const tablesQuery = `
        SELECT 
          t.table_name,
          obj_description(pgc.oid, 'pg_class') as table_description
        FROM information_schema.tables t
        JOIN pg_class pgc ON pgc.relname = t.table_name
        JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = t.table_schema
        WHERE t.table_schema = $1
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name;
      `;

      const tablesRes = await client.query(tablesQuery, [schema]);

      if (tablesRes.rows.length === 0) {
        output += '*No tables found*\n\n';
        continue;
      }

      for (const table of tablesRes.rows) {
        output += `### Table: ${schema}.${table.table_name}\n`;
        if (table.table_description) {
          output += `Description: ${table.table_description}\n`;
        }
        output += '\n';

        // Get columns for this table
        const columnsQuery = `
          SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            pg_catalog.col_description(pgc.oid, c.ordinal_position) as column_description
          FROM information_schema.columns c
          JOIN pg_class pgc ON pgc.relname = c.table_name
          JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
          WHERE c.table_schema = $1
            AND c.table_name = $2
          ORDER BY c.ordinal_position;
        `;

        const columnsRes = await client.query(columnsQuery, [schema, table.table_name]);

        output += '#### Columns:\n';
        output += '| Column | Type | Nullable | Default | Description |\n';
        output += '|--------|------|----------|---------|-------------|\n';

        for (const col of columnsRes.rows) {
          let dataType = col.data_type;
          if (col.character_maximum_length) {
            dataType += `(${col.character_maximum_length})`;
          } else if (col.numeric_precision) {
            dataType += `(${col.numeric_precision},${col.numeric_scale || 0})`;
          }

          const nullable = col.is_nullable === 'YES' ? 'YES' : 'NO';
          const defaultVal = col.column_default || '-';
          const description = col.column_description || '-';

          output += `| ${col.column_name} | ${dataType} | ${nullable} | ${defaultVal} | ${description} |\n`;
        }
        output += '\n';

        // Get Primary Keys
        const pkQuery = `
          SELECT 
            kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = $1
            AND tc.table_name = $2
            AND tc.constraint_type = 'PRIMARY KEY'
          ORDER BY kcu.ordinal_position;
        `;

        const pkRes = await client.query(pkQuery, [schema, table.table_name]);

        if (pkRes.rows.length > 0) {
          output += '#### Primary Key:\n';
          output += pkRes.rows.map(r => r.column_name).join(', ') + '\n\n';
        }

        // Get Foreign Keys
        const fkQuery = `
          SELECT 
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.table_schema = $1
            AND tc.table_name = $2
            AND tc.constraint_type = 'FOREIGN KEY';
        `;

        const fkRes = await client.query(fkQuery, [schema, table.table_name]);

        if (fkRes.rows.length > 0) {
          output += '#### Foreign Keys:\n';
          for (const fk of fkRes.rows) {
            output += `- **${fk.constraint_name}**: `;
            output += `${fk.column_name} → ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})\n`;
          }
          output += '\n';
        }

        // Get Indexes
        const indexQuery = `
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes
          WHERE schemaname = $1
            AND tablename = $2;
        `;

        const indexRes = await client.query(indexQuery, [schema, table.table_name]);

        if (indexRes.rows.length > 0) {
          output += '#### Indexes:\n';
          for (const idx of indexRes.rows) {
            // Skip primary key indexes (already shown above)
            if (!idx.indexname.endsWith('_pkey')) {
              output += `- ${idx.indexname}\n`;
            }
          }
          output += '\n';
        }

        output += '\n';
      }
    }

    // Write output to file
    const outputPath = path.join(__dirname, '..', 'docs', 'supabase_full_schema.txt');
    fs.writeFileSync(outputPath, output);

    console.log('\n✅ Schema extracted successfully!');
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`📊 Total tables processed: ${tablesRes.rows.length}`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

getSchema();
