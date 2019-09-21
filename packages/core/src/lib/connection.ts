/**
 * connection.ts
 * Provide the sql connection string
 */

// Node Modules
import { resolve } from 'path'
import { MysqlError } from 'mysql'

// NPM Modules
import { Pool, PoolConfig, createPool } from 'mysql'
import { IDictionary } from '@osm/server'
import { poolConfig } from 'config'

// Local Modules

// Constants and global variables
const jwtSecret = process.env.JWT_KEY || 'secret'
const HOOKS_DIR = resolve(__dirname, './hooks')

let pool: Pool
function getPool(refresh?: boolean): Pool {
  if (pool && !refresh) {
    return pool
  }
  console.log(
    '[SQL_CONNECTION] Creating new connection with username %s and host %s',
    poolConfig.user,
    poolConfig.host
  )

  pool = createPool(poolConfig)
  return pool
}

/**
 * @description Performs a query with no authorization. To be used for system calls
 * @param query String with SQL
 * @param params Unescaped values to be injected
 */
async function simpleQuery(query: string, params?: any[]): Promise<any> {
  return new Promise((resolveQuery, rejectQuery) => {
    getPool().getConnection((err, conn) => {
      if (err) {
        if (conn) {
          try {
            conn.release()
          } catch (er) {
            // Attempt to reconnect
            // since this usually errors out due to
            // connection being closed
            pool = getPool(true)
            return rejectQuery(er)
          }
        }
        return rejectQuery(err)
      }
      if (query.indexOf('FROM  LIMIT') > -1) {
        console.error(query)
        return rejectQuery('Blank query')
      }
      try {
        if (!params) {
          console.log('[SQL_SIMPLE] No params provided for statement %s', query)
          params = ['']
        }
        // console.log('[SQL_SIMPLE] %s', conn.format(query, params))
      } catch (e) {
        console.error('[SQL_SIMPLE] %s', e.message)
        console.error(e)
        return rejectQuery(e)
      }
      try {
        conn.release()
      } catch (e) {
        // Attempt to reconnect
        // since this usually errors out due to
        // connection being closed
        pool = getPool(true)
        return rejectQuery(e)
      }
    })
    // console.log('[SQL_SIMPLE] %s %s', query, params)
    getPool().query(query, params, (err: MysqlError, results: any[]) => {
      if (err) {
        // Attempt to reconnect
        // since this usually errors out due to
        // connection being closed
        if (err.code === 'POOL_CLOSED') {
          pool = getPool(true)
        }
        return rejectQuery(err)
      }

      if (query.slice(0, 4) === 'CALL') {
        return resolveQuery(results[0])
      }
      return resolveQuery(results)
    })
  })
}

export async function transaction(queries: { query: string; params: any }[]) {
  return new Promise((resolveTransaction, rejectTransaction) => {
    getPool().getConnection((getConnectionErr, conn) => {
      if (getConnectionErr) {
        rejectTransaction(getConnectionErr)
      } else {
        conn.beginTransaction((beginTransactionErr) => {
          if (beginTransactionErr) {
            rejectTransaction(beginTransactionErr)
          } else {
            Promise.all(
              queries.map((query) => {
                return new Promise((resolveStatement, rejectStatement) => {
                  conn.query(query.query, query.params, (err, results) => {
                    if (err) {
                      rejectStatement(err)
                    } else {
                      resolveStatement()
                    }
                  })
                })
              })
            )
              .then(() => {
                conn.commit((commitErr) => {
                  if (commitErr) {
                    rejectTransaction(commitErr)
                  } else {
                    resolveTransaction()
                  }
                })
              })
              .catch((err) => {
                conn.rollback((rollbackErr) => {
                  rejectTransaction(err)
                })
              })
          }
        })
      }
    })
  })
}

/**
 * Validate the database connection
 */
async function testConnection(): Promise<boolean> {
  return new Promise((resolveDbConnection) => {
    try {
      getPool().getConnection((err, conn) => {
        if (err) {
          console.error(err)
          return resolveDbConnection(false)
        } else {
          conn.release()
          return resolveDbConnection(true)
        }
      })
    } catch (err) {
      return resolveDbConnection(false)
    }
  })
}

export { getPool, jwtSecret, simpleQuery, testConnection, HOOKS_DIR }