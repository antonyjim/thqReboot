/**
 * lib/ql/schema/constructSchema.ts
 * Create a schema object from the sys_db_dictionary and sys_db_object tables
 */

// Node Modules
import { EventEmitter } from 'events'

// NPM Modules
import { clone } from 'lodash'

// Local Modules
import { simpleQuery } from '@lib/connection'
import { ITableField, ITableSchema } from '@osm/forms'
import { IDictionary } from '@osm/server'

// Constants and global module variables
const SYS_DB_OBJECT = 'sys_db_object'
const SYS_DB_DICTIONARY = 'sys_db_dictionary'

// This will eventually become the schema object
let tables: IDictionary<ITableSchema> = {}

// This will store references that have to be resolved separately
const references = []

function getTableDescription(tableName: {
  name: string
  sys_id: string
}): Promise<ITableSchema> {
  return new Promise((resolveTableDetails, rejectTableDetails) => {
    let tableDescription: ITableSchema = {
      columns: {},
      defaultFields: [],
      displayField: '',
      primaryKey: '',
      tableId: '',
      tableName: tableName.name
    }

    // First check for the existence of the table in sys_db_object
    // Find the column name, reference field,
    // selectablility, table_name, table_display_name
    const statement =
      'SELECT `t1`.??, `t1`.??, `t1`.??, `t1`.??, `t1`.??, `t1`.??, `t1`.??,   \
      `t1`.??, `t1`.??, `t1`.??, `t1`.??, `t1`.??, `t1`.??, `t1`.??,  \
      `t2`.?? AS ??, `t3`.?? AS ??, `t4`.?? AS ?? FROM ?? `t1` LEFT   \
      JOIN ?? `t2` ON `t1`.?? = `t2`.?? INNER JOIN ?? `t3` ON `t1`.?? \
      = `t3`.?? LEFT JOIN ?? `t4` ON `t2`.?? = `t4`.?? WHERE `t3`.??  \
      = ? ORDER BY `t1`.??'
    const params = [
      'column_name',
      'display_field',
      'nullable',
      'label',
      'type',
      'table_name',
      'required_on_update',
      'required_on_create',
      'default_view',
      'column_order',
      'update_key',
      'len',
      'readonly',
      'visible',
      'column_name',
      /* AS */ 'reference_id_display',
      'name',
      /* AS */ 'table_name_display',
      'name',
      /* AS */ 'reference_id_table_name_display',
      SYS_DB_DICTIONARY,
      SYS_DB_DICTIONARY,
      'reference_id',
      'sys_id',
      'sys_db_object',
      'table_name',
      'sys_id',
      'sys_db_object',
      'table_name',
      'sys_id',
      'name',
      tableName.name,
      'column_order'
    ]

    simpleQuery(statement, params)
      .then((tableColumns) => {
        if (tableColumns.length === 0) {
          console.error(
            'Table %s does not have any fields associated with it',
            tableName
          )
          return resolveTableDetails(tableDescription)
        }

        // Set the sys_id and all other data
        tableDescription.tableId = tableColumns[0].table_name
        if (tableColumns) {
          tableColumns.forEach((col) => {
            tableDescription.columns[col.column_name] = {
              type: sqlToJsType(col.type),
              nullable: col.nullable,
              readonly: col.readonly,
              maxLength: col.len,
              reference: col.reference_id_display || false,
              refTable: col.reference_id_table_name_display,
              label: col.label,
              visible: col.visible || false,
              requiredUpdate: col.required_on_update,
              requiredCreate: col.required_on_create,
              order: col.column_order
            }
            if (col.default_view) {
              tableDescription.defaultFields.push(col.column_name)
            }
            if (col.reference_id_display) {
              references.push({
                col: col.column_name,
                table: tableName,
                refTable: col.reference_id_table_name_display,
                refCol: col.reference_id_display
              })
            }

            if (col.display_field) {
              tableDescription.displayField = col.column_name
            }
            if (col.update_key) {
              tableDescription.primaryKey = col.column_name
            }
          })
        }
        return resolveTableDetails(tableDescription)
      })
      .catch((err) => {
        rejectTableDetails(err)
      })
  })
}

/**
 * Converts an sql data type such as VARCHAR, INT
 * into a valid javascript data type such as
 * string, number, boolean.
 * @param type SQL Data Type
 */
export function sqlToJsType(type: string) {
  let returnType: string = ''
  let swType
  if (type) swType = type.toUpperCase()
  else swType = type
  switch (swType) {
    case 'VARCHAR': {
      returnType = 'string'
      break
    }
    case 'CHAR': {
      returnType = 'string'
      break
    }
    case 'BOOLEAN': {
      returnType = 'boolean'
      break
    }
    case 'INT': {
      returnType = 'number'
      break
    }
    case 'FLOAT': {
      returnType = 'number'
      break
    }
    default: {
      returnType = 'string'
    }
  }
  return returnType
}

export default function constructSchema(): Promise<IDictionary<ITableSchema>> {
  return new Promise((resolveTables, rejectTables) => {
    tables = {}
    const tableConstructorEmitter = new EventEmitter()
    /**
     * Wait for all of the normal field to be populated in the
     * table object, then add in all of the reference columns.
     */
    tableConstructorEmitter.once('done', () => {
      references.forEach((ref) => {
        // const colName = ref.col + '_display'
        const colName = ref.col
        const colTable = ref.table.name
        const refTable = ref.refTable
        const refCol = ref.refCol
        const colDetails = tables[refTable].columns[refCol]
        tables[colTable].columns[colName] = {
          label: colDetails.label || colName,
          visible: true,
          type: colDetails.type,
          readonly: colDetails.readonly,
          localRef: ref.col, // The name of the id for JOIN ON
          displayAs:
            tables[refTable].displayField || tables[refTable].primaryKey,
          reference: refCol, // Foreign reference column
          refTable // Foreign reference table
        }
        if (tables[colTable].defaultFields.indexOf(ref.col) > -1) {
          tables[colTable].defaultFields.push(colName)
        }
      })
      return resolveTables(tables)
    })

    simpleQuery('SELECT ??, ?? FROM ??', ['sys_id', 'name', SYS_DB_OBJECT])
      .then((gotTables: any[]) => {
        // if (!Array.isArray(gotTables) || gotTables.length === 0) {
        //   throw new Error('No tables found')
        // }
        return Promise.all(
          gotTables.map(getTableDescription as (
            ...args: any
          ) => Promise<ITableSchema>)
        )
      })
      .then((allDescriptions: ITableSchema[]) => {
        allDescriptions.forEach((tableDescription: ITableSchema) => {
          tables[tableDescription.tableName] = tableDescription
        })
        tableConstructorEmitter.emit('done')
      })
      .catch((err) => {
        console.error('Error at: %s ', __dirname + __filename)
        console.error(err)
        rejectTables(err)
      })
  })
}

export function getTables(
  tableName?: string
): IDictionary<ITableSchema> | ITableSchema {
  if (tables && Object.keys(tables).length > 0) {
    if (tableName) {
      return tables[tableName]
    }
    // if (process.env.NODE_ENV === 'development') constructSchema()
    return tables
  } else {
    // This should not ever happen
    throw new Error(
      '[CONSTRUCT_SCHEMA] getTables was called before schema was initialized.'
    )
  }
}

export { tables }
