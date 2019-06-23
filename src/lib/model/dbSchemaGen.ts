import constructSchema from './constructSchema'
import { getPool, simpleQuery } from '../connection'
import { v4 as uuid } from 'uuid'

/**
 * Copy everything using SHOW TABLES
 * Will eventually be replaced by Towel.Schema
 */
export function syncDbSchema() {
  return new Promise((resolveSchema, rejectSchema) => {
    constructSchema() // Refresh the in-memory schema object
      .then((tables) => {
        return Promise.all([
          tables,
          simpleQuery(
            `SHOW TABLES WHERE NOT Tables_in_${process.env.DB_DB} LIKE '%_list'`
          )
        ])
      })
      .then(([tables, allTables]) => {
        const flaggedKeyFields = []
        Promise.all(
          allTables.map((table) => {
            return new Promise(
              (resolveTableDescription, rejectTableDescription) => {
                const tableName = table['Tables_in_' + process.env.DB_DB]
                let currTableId = ''
                // if (tables[tableName] && tables[tableName].tableId !== '') {
                //   console.log(
                //     'Table %s already exists in table schema with %s',
                //     tableName,
                //     inspect(tables[tableName], false, 1)
                //   )

                //   return
                // } else {
                //   console.log('Table %s does not exist in current schema', tableName)
                createTableIfNotExists(tableName)
                  .then((tableId) => {
                    currTableId = tableId
                    return simpleQuery('DESCRIBE ??', [tableName])
                  })
                  .then((columns) => {
                    // const existingColumns = existingTables[tableName].columns
                    const allColumns: string[] = [
                      'sys_id',
                      'reference_id',
                      'column_name',
                      'visible',
                      'admin_view',
                      'readonly',
                      'nullable',
                      'label',
                      'hint',
                      'type',
                      'len',
                      'default_value',
                      'required_on_create',
                      'required_on_update',
                      'table_name',
                      'default_view',
                      'update_key',
                      'col_order',
                      'enum',
                      'display_field'
                    ]
                    let hasSetDisplay = false
                    let theseColumns = columns.map((col, i) => {
                      if (tables[tableName].columns[col.Field]) {
                        return // Column already defined
                      } else {
                        console.log('Column %s is not defined', col.Field)

                        let displayField = false
                        if (col.Field !== 'sys_id' && hasSetDisplay === false) {
                          displayField = true
                          hasSetDisplay = true
                        }

                        if (col.Key === 'MUL') {
                          flaggedKeyFields.push({
                            table: tableName,
                            field: col.Field
                          })
                        }

                        return [
                          uuid(), // sys_id
                          null, // reference_id
                          col.Field, // column_name,
                          true, // visible
                          false, // admin_view
                          false, // readonly
                          col.Null === 'NO', // nullable
                          col.Field, // label
                          null, // hint
                          parseType(col.Type).dataType.toUpperCase(), // type
                          parseType(col.Type).dataLength, // len
                          col.Default, // default_value
                          true, // required_on_create
                          false, // required_on_update
                          currTableId, // table_name
                          true, // default_view
                          col.Key === 'PRI' ? true : false, // update_key
                          100, // col_order
                          null, // enum
                          displayField // display_field
                        ]
                      }
                    })

                    theseColumns = theseColumns.filter((val) => {
                      return val !== undefined
                    })

                    if (theseColumns.length > 0) {
                      return simpleQuery(
                        'INSERT INTO sys_db_dictionary (??) VALUES ?',
                        [allColumns, theseColumns]
                      )
                    } else {
                      // If we aren't doing anything, then we just need to move on so that we can resolve the whole function
                      return new Promise((resolve) => {
                        resolve()
                      })
                    }
                  })
                  .then(() => {
                    resolveTableDescription()
                    // console.log(
                    //   '[CONSTRUCT_SCHEMA] Generated all schema descriptions'
                    // )
                  })
                  .catch((err) => {
                    console.error(
                      '[CONSTRUCT_SCHEMA] Error inserting table descriptions'
                    )
                    console.error(err)
                  })
              }
            )
          })
        )
      })
      .then(() => {
        resolveSchema()
      })
      .catch((err) => {
        console.error(
          `[CONSTRUCT_SCHEMA] CRITICAL ERROR WHEN STARTING SERVER ${
            err.message
          }`
        )
        rejectSchema(err)
        getPool().end()
      })
  })

  function parseType(sqlType: string) {
    function getLen(type) {
      const len = parseInt(type.match(/[^\(\)]+(?=\))/g)[0], 10)
      if (isNaN(len)) {
        return 0
      } else {
        return len
      }
    }

    const returnType = {
      dataType: 'tinyint',
      dataLength: 0
    }
    const switchVal = sqlType.slice(0, 3)
    switch (switchVal) {
      case 'cha': {
        returnType.dataType = sqlType.slice(0, 4)
        returnType.dataLength = getLen(sqlType)
        break
      }
      case 'var': {
        returnType.dataType = sqlType.slice(0, 7)
        returnType.dataLength = getLen(sqlType)
        break
      }
      case 'int': {
        returnType.dataType = sqlType.slice(0, 3)
        returnType.dataLength = getLen(sqlType)
        break
      }
      case 'big': {
        returnType.dataType = sqlType.slice(0, 6)
        returnType.dataLength = getLen(sqlType)
        break
      }
      case 'tex': {
        returnType.dataType = sqlType.slice(0, 4)
        returnType.dataLength = 65535
        break
      }
      case 'blo': {
        returnType.dataType = sqlType.slice(0, 4)
        returnType.dataLength = 65535
        break
      }
      case 'tin': {
        returnType.dataType = 'boolean'
        returnType.dataLength = null
        break
      }
      case 'enu': {
        returnType.dataType = 'varchar'
        returnType.dataLength = 40 // Maxlength of an enum
        break
      }
      default: {
        returnType.dataType = sqlType
        returnType.dataLength = null
      }
    }
    return returnType
  }
}

async function createTableIfNotExists(tableName: string) {
  const table = await simpleQuery(
    'SELECT sys_id FROM sys_db_object where name = ?',
    [tableName]
  )
  if (table && table.length > 0) {
    return table[0].sys_id
  } else {
    // const id = uuid()
    // await simpleQuery('INSERT INTO sys_db_object VALUES (?)', [
    //   [id, tableName, tableName, null, null]
    // ])
    const tableInfo = await simpleQuery(
      `INSERT INTO sys_db_object (name, label, sys_id) VALUES ?`,
      [[[tableName, tableName, uuid()]]]
    )
    return tableInfo[0].sys_id
  }
}