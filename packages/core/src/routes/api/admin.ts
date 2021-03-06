/**
 * routes.api.admin.ts
 * Provide routes for administrative duties
 */

// Node Modules

// NPM Modules
import { Router, Request, Response } from 'express'

// Local Modules
// import { NavigationSettings } from '../../types/roles'
import { IStatusMessage } from '../../types/server'
import { Roles } from '../../app/users/roles'
import { Querynator } from '../../lib/queries'
import { authorize } from '../middleware/authorization'
import { getServerStats } from '../../app/administration/meta/hostInfo'
import { workers } from '../loadPackages'
import { ChildProcess } from 'child_process'

// Constants and global variables
const adminRoutes = Router()

// adminRoutes.get('/getRoles', (req: Request, res: Response) => {
//   new Roles()
//     .get()
//     .then((roles) => {
//       res.status(200).json(roles)
//     })
//     .catch((err) => {
//       console.error(err)
//       res.status(200).json(err)
//     })
// })

// adminRoutes.get('/getPrivs', (req: Request, res: Response) => {
//   new Roles()
//     .getPrivs(req.query.role)
//     .then((privs) => {
//       res.status(200).json(privs)
//     })
//     .catch((err) => {
//       res.status(200).json(err)
//     })
// })

// adminRoutes.get('/getRoute', (req: Request, res: Response) => {
//   const route = req.query.route || req.body.route
//   if (!route) {
//     res.status(200).json({
//       error: true,
//       message: 'No route provided'
//     })
//   } else {
//     new Navigation({ linkInfo: [route] })
//       .getLink()
//       .then(
//         (onLinkSearched: IStatusMessage) => {
//           res.status(200).json(onLinkSearched)
//         },
//         (onLinkSearchFailure: IStatusMessage) => {
//           res.status(200).json(onLinkSearchFailure)
//         }
//       )
//       .catch((err: IStatusMessage) => {
//         res.status(200).json(err)
//       })
//   }
// })

// adminRoutes.get('/getAllRoutes', (req: Request, res: Response) => {
//   new Navigation({})
//     .getAllLinks()
//     .then(
//       (onSuccess) => {
//         res.status(200).json(onSuccess)
//       },
//       (onFailure) => {
//         res.status(200).json(onFailure)
//       }
//     )
//     .catch((err) => {
//       console.log(JSON.stringify(err))
//       res.status(500).json(err)
//     })
// })

// adminRoutes.post('/addRoute', (req: Request, res: Response) => {
//   if (req.body && req.body.length > 0) {
//     new Navigation({ linkInfo: req.body })
//       .addLinks()
//       .then((onLinksAdded: IStatusMessage) => {
//         res.status(200).json(onLinksAdded)
//       })
//       .catch((err) => {
//         res.status(500).json(err)
//       })
//   } else {
//     res.status(200).json({
//       error: true,
//       message: 'No valid data provided'
//     })
//   }
// })

// adminRoutes.post('/updateRoute', (req: Request, res: Response) => {
//   if (req.body) {
//     new Navigation({ linkInfo: [req.body] })
//       .updateLink()
//       .then(
//         (onLinkUpdated: IStatusMessage) => {
//           res.status(200).json(onLinkUpdated)
//         },
//         (onLinkNotUpdated: IStatusMessage) => {
//           res.status(200).json(onLinkNotUpdated)
//         }
//       )
//       .catch((err: Error) => {
//         res.status(200).json(err)
//       })
//   } else {
//     res.status(200).json({
//       error: true,
//       message: 'No link provided, or provided in wrong format',
//       details: req.body
//     })
//   }
// })

// adminRoutes.post('/roles/:action', (req: Request, res: Response) => {
//   const rpId = req.query.rpId
//   const rolePriv = req.query.rpPriv
//   const action = req.params.action
//   if (action === 'remove' || action === 'add') {
//     new Roles({ rpId, role_priv: rolePriv })
//       .update(action)
//       .then(
//         (onChanged: IStatusMessage) => {
//           res.status(200).json(onChanged)
//         },
//         (onNotChanged: IStatusMessage) => {
//           res.status(200).json(onNotChanged)
//         }
//       )
//       .catch((err: Error) => {
//         console.error(err)
//         res.status(500).send()
//       })
//   } else {
//     res.status(200).json({
//       error: true,
//       message:
//         "Invalid action supplied. Please use 'remove' or 'update' to modify a role or privilege"
//     })
//   }
// })

adminRoutes.get(
  '/stats',
  authorize('administrator', (req: Request, res: Response) => {
    getServerStats()
      .then((stats) => {
        res.status(200).json(stats)
      })
      .catch((err) => {
        res.status(500).json({ error: err })
      })
  })
)

adminRoutes.get(
  '/server-processes',
  authorize('administrator', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      body: [...workers]
    })
  })
)

adminRoutes.get(
  '/server-processes/kill/:pid?',
  authorize('administrator', (req: Request, res: Response) => {
    if (!req.params.pid) {
      res.status(400).json({
        error: {
          message: 'No PID provided to kill()',
          code: 400
        },
        success: false
      })
    } else {
      let killed: boolean = false
      workers.forEach((w: ChildProcess) => {
        if (w[1].pid.toString() === req.params.pid) {
          w[1].kill()
          killed = true
        }
      })

      res.status(200).json({ success: killed })
    }
  })
)

adminRoutes.post('/sql', (req: Request, res: Response) => {
  new Querynator({ req, res })
    .createQ(
      {
        query: req.body.query
      },
      'CALL'
    )
    .then((results) => {
      res.status(200).json(results)
    })
    .catch((e) => {
      res.status(500).json({ message: e.message })
    })
})

export { adminRoutes }
