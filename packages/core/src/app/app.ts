/**
 * app.ts
 * Provide an entry point for the THQ application
 */

// Node Modules
import * as cluster from 'cluster'
import { cpus } from 'os'
import { createReadStream } from 'fs'
import { resolve } from 'path'
import { Server } from 'http'

// NPM Modules
import * as express from 'express'

// Local Modules
import { getRoutes } from '../routes/index'
import { Log } from '../lib/log'
import { getPool } from '../lib/connection'
import constructSchema from './model/constructSchema'
import { constructForms } from './model/constructForms'
import generateHooks from './model/generateHooks'
import { initSchema } from './model/init'
import { debug } from '@lib/log'

let app: express.Application
const logger = debug('app:startup')

/**
 * Starts requiring all of the routes for the core plus any activated modules.
 */
export function initOsmHttpListener() {
  /**
   * Check for production environment, if found:
   * - Start web server as cluster
   */
  if (process.env.NODE_ENV === 'production') {
    const cores: number = cpus().length
    if (cluster.isMaster) {
      console.log('Started cluster, master process as ' + process.pid)
      let i: number = parseInt(process.env.CLUSTER_COUNT, 10) || cores
      while (i >= 0) {
        cluster.fork()
        i--
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker process ${worker.process.pid} crashed`)
      })
    } else {
      listen()
    }
  } else {
    listen()
  }

  function listen() {
    // Constants and global variables
    app = express()
    const port = parseInt(process.env.SERVER_PORT, 10) || 8080
    let server: Server
    // Routes
    app.disable('x-powered-by')
    process.on('SIGTERM', (e) => {
      getPool().end()
      server.close()
      new Log('Pool connections closed').info()
    })

    // @ts-ignore
    global.app = app

    initSchema()
      .then((tables) => {
        // We need to assign the resulting tables object to **something** so that
        // the garbage collector does not collect it.
        //@ts-ignore
        app.schema = tables
        logger('Completed bulding schema')
        server = app.listen(port, () => {
          new Log(`Listening at port ${port} on process ${process.pid}`).info()
        })
        return constructForms()
      })
      .then(() => {
        logger('Finished constructing forms')
        generateHooks()
        return getRoutes()
      })
      .then((router: express.Router) => {
        app.use('/', router)
      })
      .catch((err) => {
        console.error(`CRITICAL ERROR WHEN STARTING SERVER ${err.message}`)
        getPool().end()
      })
  }
}

/**
 * Exports a simple html page telling the user to come back with a warrant.
 */
export function internalError() {
  const app = express()
  const port = parseInt(process.env.SERVER_PORT, 10) || 8020
  // app.set('view engine', 'ejs')

  app.get('*', (req, res) => {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      createReadStream(resolve(__dirname, '../../static/error505.html')).pipe(
        res
      )
    } catch (err) {
      res.send('<html>Internal server error</html>')
    }
  })

  app.listen(port, () => {
    console.log('Listening for fallback on port %d', port)
  })
}

export { app }
